import { query } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { generateEmbedding } from '../config/llm.js';
import { parseQuery, loadOntologyAndSlang } from '../utils/terminology.js';

// Pre-load ontology and slang dictionaries on boot
loadOntologyAndSlang();

/**
 * Robust helper to reconstruct Scene7 and other image URLs whose query parameters
 * got split by commas (e.g., during array parsing or database seeding).
 */
export function repairImageUrls(urls) {
  const rawArray = Array.isArray(urls)
    ? urls
    : (typeof urls === 'string' ? urls.split(',') : []);
  
  const repaired = [];
  for (let i = 0; i < rawArray.length; i++) {
    const url = rawArray[i]?.trim();
    if (!url) continue;
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      repaired.push(url);
    } else if (repaired.length > 0) {
      // It's a query parameter fragment that got split on a comma!
      repaired[repaired.length - 1] = repaired[repaired.length - 1] + ',' + url;
    } else {
      repaired.push(url);
    }
  }
  return repaired;
}


/**
 * Fetches the latest dynamic metal rates per gram from Postgres with a fallback to Redis or baseline defaults.
 * @returns {Promise<object>}
 */
export async function getLatestMetalRates() {
  try {
    const cached = await redisClient.get('latest_metal_rates');
    if (cached) return JSON.parse(cached);
  } catch (err) {
    console.warn('Redis read error for metal rates:', err.message);
  }

  try {
    const res = await query(`
      SELECT DISTINCT ON (metal_type) metal_type, rate_per_gram 
      FROM daily_metal_rates 
      ORDER BY metal_type, record_date DESC
    `);

    const rates = {
      '22K': 13080.00,
      '18K': 10710.00,
      '14K': 8330.00,
      '24K': 14270.00,
      'Platinum': 3550.00,
      'Silver': 88.00
    };

    res.rows.forEach(r => {
      const type = r.metal_type;
      if (type.includes('22K')) rates['22K'] = parseFloat(r.rate_per_gram);
      else if (type.includes('18K')) rates['18K'] = parseFloat(r.rate_per_gram);
      else if (type.includes('14K')) rates['14K'] = parseFloat(r.rate_per_gram);
      else if (type.includes('24K')) rates['24K'] = parseFloat(r.rate_per_gram);
      else if (type.toLowerCase().includes('platinum')) rates['Platinum'] = parseFloat(r.rate_per_gram);
      else if (type.toLowerCase().includes('silver')) rates['Silver'] = parseFloat(r.rate_per_gram);
    });

    try {
      await redisClient.set('latest_metal_rates', JSON.stringify(rates), { EX: 3600 }); // Cache for 1 hour
    } catch (err) {
      console.warn('Redis cache write failed:', err.message);
    }

    return rates;
  } catch (error) {
    console.warn('Database error while fetching metal rates, using fallback baseline:', error.message);
    return {
      '22K': 13080.00,
      '18K': 10710.00,
      '14K': 8330.00,
      '24K': 14270.00,
      'Platinum': 3550.00,
      'Silver': 88.00
    };
  }
}

/**
 * Builds a dynamic SQL pricing formula block reflecting live metal rates, making charges, and diamond/gem charges.
 * Includes the 3% standard Indian GST.
 * @param {object} rates - Current active gold, platinum, and silver rates per gram
 * @returns {string} - SQL calculation block
 */
export function buildDynamicPriceSQL(rates) {
  const goldRate = rates['22K'] || 0;
  
  // Luxury Stability Formula: 
  // We prefer: BasePrice + (GoldWeight * (CurrentRate - BaseGoldRate) * 1.03)
  // This preserves the expensive diamond/stone value and adds GST-corrected delta.
  
  return `COALESCE(
    CASE 
      WHEN base_price > 0 AND base_gold_rate > 0 
      THEN (base_price + (COALESCE(gold_weight_numeric, 0) * (${goldRate} - base_gold_rate) * 1.03))
      ELSE NULL 
    END,
    (
      (
        -- Material metal cost
        CASE 
          WHEN purity = '22K' THEN COALESCE(gold_weight_numeric, 0) * ${rates['22K'] || 0}
          WHEN purity = '18K' THEN COALESCE(gold_weight_numeric, 0) * ${rates['18K'] || 0}
          WHEN purity = '14K' THEN COALESCE(gold_weight_numeric, 0) * ${rates['14K'] || 0}
          WHEN purity = '24K' THEN COALESCE(gold_weight_numeric, 0) * ${rates['24K'] || 0}
          ELSE COALESCE(gold_weight_numeric, 0) * ${rates['22K'] || 0}
        END +
        (COALESCE(platinum_weight_numeric, 0) * ${rates['Platinum'] || 0}) +
        (COALESCE(silver_weight_numeric, 0) * ${rates['Silver'] || 0})
      ) +
      -- Diamond component value
      (COALESCE(diamond_weight_numeric, 0) * COALESCE(diamond_rate_per_carat, 0)) +
      -- Color Gemstone component value
      (COALESCE(gemstone_weight_numeric, 0) * COALESCE(gemstone_rate_per_carat, 0)) +
      -- Labour / Making charges
      (
        CASE 
          WHEN making_charge_type = 'per_gram' THEN COALESCE(gold_weight_numeric, 0) * COALESCE(making_charge_value, 0)
          WHEN making_charge_type = 'percentage' THEN (COALESCE(gold_weight_numeric, 0) * ${rates['22K'] || 0}) * (COALESCE(making_charge_value, 0) / 100)
          ELSE COALESCE(making_charge_value, 0)
        END
      )
    ) * 1.03
  )`;
}

/**
 * High-Performance Adaptive Query Router.
 * Performs parallel relational constraints-based searches and pgvector similarity match
 * with Reciprocal Rank Fusion (RRF) for 100% precision.
 * @param {object} params
 * @param {string} params.queryText - Customer input query
 * @param {number} params.limit - Maximum products to return (default 12)
 * @returns {Promise<object>}
 */
export async function searchCatalogue({ queryText, limit = 12, existingFilters = null }) {
  // 0. Cache Check
  const cacheKeyPayload = existingFilters 
    ? `${queryText.toLowerCase().trim()}:${JSON.stringify(existingFilters)}` 
    : queryText.toLowerCase().trim();
  const cacheKey = `search:${Buffer.from(cacheKeyPayload).toString('base64')}:${limit}`;
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsedCached = JSON.parse(cached);
        console.log(`🚀 [CACHE_HIT] "${queryText}" in 1ms`);
        return { ...parsedCached, cache: true };
      }
    }
  } catch (err) {
    console.warn('⚡ [CACHE] Read Error:', err.message);
  }

  const start = Date.now();

  // 1. Pre-parse search query lexical structures and fetch rates
  const parsedRaw = await parseQuery(queryText);
  let parsed = parsedRaw;
  if (existingFilters) {
    const { mergeFilters } = await import('../utils/sessionMerge.js');
    parsed = mergeFilters(existingFilters, parsedRaw);
  }
  const rates = await getLatestMetalRates();
  const dynamicPriceSQL = buildDynamicPriceSQL(rates);

  // 2. Map parsed query parameters to SQL filters and value bindings
  const filters = [];
  const bindings = [];
  let paramCounter = 1;

  if (parsed.product_type === 'platinum') {
    filters.push(`platinum_weight_numeric > 0`);
  } else if (parsed.product_type === 'silver') {
    filters.push(`silver_weight_numeric > 0`);
  } else if (parsed.product_type === 'gold') {
    filters.push(`gold_weight_numeric > 0`);
  }

  if (parsed.category) {
    filters.push(`category = $${paramCounter++}`);
    bindings.push(parsed.category);
  }
  if (parsed.subCategory) {
    filters.push(`sub_category = $${paramCounter++}`);
    bindings.push(parsed.subCategory);
  }
  if (parsed.purity) {
    filters.push(`purity = $${paramCounter++}`);
    bindings.push(parsed.purity);
  }
  if (parsed.metalColor) {
    filters.push(`metal_color = $${paramCounter++}`);
    bindings.push(parsed.metalColor);
  }
  if (parsed.occasion) {
    filters.push(`(occasion ILIKE $${paramCounter} OR EXISTS (SELECT 1 FROM product_occasions WHERE product_id = catalog_products.id AND occasion ILIKE $${paramCounter}))`);
    bindings.push(`%${parsed.occasion}%`);
    paramCounter++;
  }
  if (parsed.gender) {
    if (parsed.gender === 'Men') {
      filters.push(`gender IN ('Men', 'Unisex')`);
    } else if (parsed.gender === 'Women') {
      filters.push(`gender IN ('Women', 'Unisex')`);
    } else {
      filters.push(`gender = $${paramCounter++}`);
      bindings.push(parsed.gender);
    }
  }
  if (parsed.motifs && parsed.motifs.length > 0) {
    parsed.motifs.forEach(m => {
      filters.push(`(all_motifs_array @> ARRAY[$${paramCounter}]::text[] OR EXISTS (SELECT 1 FROM product_motifs WHERE product_id = catalog_products.id AND motif ILIKE $${paramCounter}))`);
      bindings.push(m);
      paramCounter++;
    });
  }

  // Hard Negations/Exclusions (Using GIN index array matching)
  if (parsed.exclusions && parsed.exclusions.length > 0) {
    parsed.exclusions.forEach(ex => {
      if (ex === 'gemstone') {
        filters.push(`NOT (all_gemstones_array && ARRAY['ruby', 'emerald', 'pearl', 'sapphire', 'synthetic']::text[])`);
      } else if (ex === 'platinum') {
        filters.push(`platinum_weight_numeric = 0`);
      } else if (ex === 'gold') {
        if (parsed.product_type !== 'platinum') {
          filters.push(`gold_weight_numeric = 0`);
        }
      } else if (ex === 'silver') {
        filters.push(`silver_weight_numeric = 0`);
      } else {
        filters.push(`NOT (all_gemstones_array @> ARRAY[$${paramCounter++}]::text[])`);
        bindings.push(ex);
      }
    });
  }

  // Matched positive gemstones (Must include)
  if (parsed.matchedGemstones && parsed.matchedGemstones.length > 0) {
    parsed.matchedGemstones.forEach(gem => {
      filters.push(`all_gemstones_array @> ARRAY[$${paramCounter++}]::text[]`);
      bindings.push(gem);
    });
  }

  // Visual percentages split filters
  if (parsed.visualSplits.visible_gold_pct) {
    filters.push(`visible_gold_pct >= $${paramCounter++}`);
    bindings.push(parsed.visualSplits.visible_gold_pct);
  }
  if (parsed.visualSplits.visible_diamond_pct) {
    filters.push(`visible_diamond_pct >= $${paramCounter++}`);
    bindings.push(parsed.visualSplits.visible_diamond_pct);
  }
  if (parsed.visualSplits.visible_enamel_pct) {
    filters.push(`visible_enamel_pct >= $${paramCounter++}`);
    bindings.push(parsed.visualSplits.visible_enamel_pct);
  }

  // Price Boundary Constraints
  if (parsed.minPrice !== null) {
    filters.push(`${dynamicPriceSQL} >= $${paramCounter++}`);
    bindings.push(parsed.minPrice);
  }
  if (parsed.maxPrice !== null) {
    filters.push(`${dynamicPriceSQL} <= $${paramCounter++}`);
    bindings.push(parsed.maxPrice);
  }

  // Diamond Carat Constraint
  if (parsed.minDiamondCarat !== null) {
    filters.push(`diamond_weight_numeric >= $${paramCounter++}`);
    bindings.push(parsed.minDiamondCarat);
  }

  const relationalFiltersClause = filters.length > 0 ? 'AND ' + filters.join(' AND ') : '';

  // Order By Strategy
  let orderByClause = '';
  let vectorOrderByClause = `ORDER BY embedding <=> $${paramCounter}::halfvec`;
  if (parsed.sortBy === 'price_desc') {
    orderByClause = `ORDER BY calculated_price DESC NULLS LAST`;
    vectorOrderByClause = `ORDER BY calculated_price DESC NULLS LAST, embedding <=> $${paramCounter}::halfvec`;
  } else if (parsed.sortBy === 'price_asc') {
    orderByClause = `ORDER BY calculated_price ASC NULLS LAST`;
    vectorOrderByClause = `ORDER BY calculated_price ASC NULLS LAST, embedding <=> $${paramCounter}::halfvec`;
  } else if (parsed.sortBy === 'weight_desc') {
    orderByClause = `ORDER BY gold_weight_numeric DESC NULLS LAST`;
    vectorOrderByClause = `ORDER BY gold_weight_numeric DESC NULLS LAST, embedding <=> $${paramCounter}::halfvec`;
  } else if (parsed.sortBy === 'weight_asc') {
    orderByClause = `ORDER BY gold_weight_numeric ASC NULLS LAST`;
    vectorOrderByClause = `ORDER BY gold_weight_numeric ASC NULLS LAST, embedding <=> $${paramCounter}::halfvec`;
  }

  // Query Limit (default 12 unless custom specified)
  const actualLimit = parsed.customLimit ? parsed.customLimit : limit;

  // 3. Strategy A: Local pgvector Semantic Search
  let vectorResults = [];
  try {
    const embedding = await generateEmbedding(queryText);
    if (embedding) {
      const embeddingStr = `[${embedding.join(',')}]`;
      const vectorQuery = `
        SELECT id, sku, name, category, sub_category, collection, gender, description, image_urls, product_url, availability,
               gold_weight_numeric, purity, platinum_weight_numeric, silver_weight_numeric,
               diamond_weight_numeric, diamond_rate_per_carat, gemstone_weight_numeric, gemstone_rate_per_carat, gemstone_type,
               making_charge_type, making_charge_value,
               visible_gold_pct, visible_diamond_pct, visible_enamel_pct, all_gemstones_array,
               base_price, base_gold_rate,
               (1 - (embedding <=> $${paramCounter}::halfvec)) AS similarity,
               ${dynamicPriceSQL} AS calculated_price
        FROM catalog_products
        WHERE availability = 'In Stock'
          ${relationalFiltersClause}
        ${vectorOrderByClause}
        LIMIT $${paramCounter + 1}
      `;
      const vectorRes = await query(vectorQuery, [...bindings, embeddingStr, actualLimit * 2]);
      vectorResults = vectorRes.rows;
    }
  } catch (err) {
    console.error('Local vector search execution failed:', err.message);
  }

  // 4. Strategy B: Exact Lexical ILIKE Keyword Search
  let textResults = [];
  try {
    const textQueryIdx = paramCounter;
    const textQuery = `
      SELECT id, sku, name, category, sub_category, collection, gender, description, image_urls, product_url, availability,
             gold_weight_numeric, purity, platinum_weight_numeric, silver_weight_numeric,
             diamond_weight_numeric, diamond_rate_per_carat, gemstone_weight_numeric, gemstone_rate_per_carat, gemstone_type,
             making_charge_type, making_charge_value,
             visible_gold_pct, visible_diamond_pct, visible_enamel_pct, all_gemstones_array,
             base_price, base_gold_rate,
             0.5 AS similarity,
             ${dynamicPriceSQL} AS calculated_price
      FROM catalog_products
      WHERE availability = 'In Stock'
        AND (name ILIKE $${textQueryIdx} OR description ILIKE $${textQueryIdx} OR category ILIKE $${textQueryIdx} OR sub_category ILIKE $${textQueryIdx})
        ${relationalFiltersClause}
      ${orderByClause}
      LIMIT $${textQueryIdx + 1}
    `;
    const wildcardQuery = `%${queryText}%`;
    const textRes = await query(textQuery, [...bindings, wildcardQuery, actualLimit * 2]);
    textResults = textRes.rows;
  } catch (err) {
    console.error('Exact text keyword search failed:', err.message);
  }

  // 5. Merge strategies via Reciprocal Rank Fusion (RRF)
  const rrfScores = {};
  const productsMap = {};

  const processRRF = (list) => {
    list.forEach((item, idx) => {
      const id = item.id;
      if (!productsMap[id]) {
        productsMap[id] = item;
      }
      if (!rrfScores[id]) {
        rrfScores[id] = 0;
      }
      // RRF Rank Score = 1 / (60 + Rank)
      rrfScores[id] += 1 / (60 + idx);
    });
  };

  processRRF(vectorResults);
  processRRF(textResults);

  // Compile final sorted results list
  let mergedProducts = Object.keys(rrfScores)
    .map(id => ({
      ...productsMap[id],
      image_urls: repairImageUrls(productsMap[id].image_urls),
      rrfScore: rrfScores[id]
    }));

  // Re-apply sorting if explicitly requested (because RRF might shuffle the order)
  if (parsed.sortBy === 'price_desc') {
    mergedProducts.sort((a, b) => b.calculated_price - a.calculated_price);
  } else if (parsed.sortBy === 'price_asc') {
    mergedProducts.sort((a, b) => a.calculated_price - b.calculated_price);
  } else if (parsed.sortBy === 'weight_desc') {
    mergedProducts.sort((a, b) => parseFloat(b.gold_weight_numeric || 0) - parseFloat(a.gold_weight_numeric || 0));
  } else if (parsed.sortBy === 'weight_asc') {
    mergedProducts.sort((a, b) => parseFloat(a.gold_weight_numeric || 0) - parseFloat(b.gold_weight_numeric || 0));
  } else {
    // Default RRF score sorting
    mergedProducts.sort((a, b) => b.rrfScore - a.rrfScore);
  }

  mergedProducts = mergedProducts.slice(0, actualLimit);

  const duration = Date.now() - start;
  console.log(`✨ [SEARCH] "${queryText}" → ${mergedProducts.length} items [${duration}ms]`);

  const finalResult = {
    parsedFilters: parsed,
    products: mergedProducts,
    rates,
    latencyMs: duration,
    queryText
  };

  // 6. Cache for future hits (TTL 1 Hour)
  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResult));
    }
  } catch (err) {
    console.warn('⚡ [CACHE] Write Error:', err.message);
  }

  return finalResult;
}
