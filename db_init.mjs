import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { generateEmbedding } from './src/config/llm.js';

dotenv.config();

const { Client, Pool } = pg;

const newDbUrl = process.env.DATABASE_URL;
const oldDbUrl = process.env.OLD_DATABASE_URL;
const oldVectorDbUrl = process.env.OLD_VECTOR_DATABASE_URL;

if (!newDbUrl || !oldDbUrl || !oldVectorDbUrl) {
  console.error('FATAL ERROR: DATABASE_URL, OLD_DATABASE_URL, or OLD_VECTOR_DATABASE_URL is missing in .env!');
  process.exit(1);
}

async function run() {
  console.log('===========================================================');
  console.log('INDRIYA AI SEARCH - SAFE DATABASE CONSOLIDATION & BOOTSTRAP');
  console.log('===========================================================');
  
  const getSslConfig = (url) => {
    if (url.includes('proxy.rlwy.net') || url.includes('localhost') || url.includes('127.0.0.1')) {
      return false;
    }
    return { rejectUnauthorized: false };
  };

  // Connect exclusively to NEW DB for schema execution (WRITE target)
  const targetPool = new Pool({
    connectionString: newDbUrl,
    ssl: getSslConfig(newDbUrl)
  });
  
  // Connect to Old databases as STRICTLY READ-ONLY sources
  const oldRelationalClient = new Client({
    connectionString: oldDbUrl,
    ssl: getSslConfig(oldDbUrl)
  });
  
  const oldVectorClient = new Client({
    connectionString: oldVectorDbUrl,
    ssl: getSslConfig(oldVectorDbUrl)
  });

  try {
    console.log('\nStep 1: Connecting to target and source databases...');
    await targetPool.connect();
    await oldRelationalClient.connect();
    await oldVectorClient.connect();
    console.log('Successfully connected to all databases.');

    console.log('\nStep 2: Initializing foolproof schema on target database...');
    const schemaSql = fs.readFileSync(path.resolve('./schema.sql'), 'utf8');
    await targetPool.query(schemaSql);
    console.log('Foolproof SQL Schema successfully applied to the new database.');

    // ------------------------------------------------------------------------
    // MIGRATION PHASE: Treated as Read-Only from Sources, Write strictly to Target
    // ------------------------------------------------------------------------

    // A. Migrate Users
    console.log('\nStep 3: Migrating Users...');
    const usersRes = await oldRelationalClient.query('SELECT * FROM "users" ORDER BY id');
    console.log(`Found ${usersRes.rows.length} users to migrate.`);
    for (const u of usersRes.rows) {
      await targetPool.query(
        'INSERT INTO "users" (id, name, store_location, role) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
        [u.id, u.name, u.store_location, u.role]
      );
    }
    console.log('Users migration finished.');

    // B. Migrate Daily Metal Rates
    console.log('\nStep 4: Migrating Daily Metal Rates...');
    const ratesRes = await oldRelationalClient.query('SELECT * FROM "daily_metal_rates" ORDER BY id');
    console.log(`Found ${ratesRes.rows.length} metal rates to migrate.`);
    for (const r of ratesRes.rows) {
      await targetPool.query(
        'INSERT INTO "daily_metal_rates" (id, record_date, metal_type, rate_per_gram) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [r.id, r.record_date, r.metal_type, r.rate_per_gram]
      );
    }
    // Seed standard baseline if empty
    const checkRates = await targetPool.query('SELECT COUNT(*) FROM "daily_metal_rates"');
    if (parseInt(checkRates.rows[0].count) === 0) {
      console.log('Seeding baseline metal rates...');
      await targetPool.query(`
        INSERT INTO "daily_metal_rates" (record_date, metal_type, rate_per_gram) VALUES 
        (CURRENT_DATE, '22KT Gold', 7335.00),
        (CURRENT_DATE, '18KT Gold', 6001.00),
        (CURRENT_DATE, '14KT Gold', 4668.00),
        (CURRENT_DATE, 'Platinum', 3550.00),
        (CURRENT_DATE, 'Silver', 88.00)
        ON CONFLICT DO NOTHING;
      `);
    }
    console.log('Metal rates migration finished.');

    // C. Migrate System Prompts
    console.log('\nStep 5: Migrating System Prompts...');
    const promptsRes = await oldRelationalClient.query('SELECT * FROM "system_prompts"');
    console.log(`Found ${promptsRes.rows.length} system prompts to migrate.`);
    for (const p of promptsRes.rows) {
      await targetPool.query(
        'INSERT INTO "system_prompts" (agent_name, instructions, prompt_metadata) VALUES ($1, $2, $3) ON CONFLICT (agent_name) DO UPDATE SET instructions = EXCLUDED.instructions',
        [p.agent_name, p.instructions, p.prompt_metadata || {}]
      );
    }
    console.log('System prompts migration finished.');

    // D. Migrate Search Ontology
    console.log('\nStep 6: Migrating Search Ontology...');
    const ontologyRes = await oldRelationalClient.query('SELECT * FROM "search_ontology"');
    console.log(`Found ${ontologyRes.rows.length} ontology terms to migrate.`);
    for (const o of ontologyRes.rows) {
      await targetPool.query(
        'INSERT INTO "search_ontology" (id, domain, synonym, target_value) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
        [o.id, o.domain, o.synonym, o.target_value]
      );
    }
    console.log('Search ontology migration finished.');

    // E. Migrate Knowledge Base
    console.log('\nStep 7: Migrating Knowledge Base Glossary & Metadata...');
    const kbMetaRes = await oldVectorClient.query('SELECT * FROM "knowledge_source_metadata"');
    for (const kbm of kbMetaRes.rows) {
      await targetPool.query(
        'INSERT INTO "knowledge_source_metadata" (source_name, original_url, summary) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [kbm.source_name, kbm.source_url || kbm.original_preview, kbm.summary]
      );
    }
    
    const kbRes = await oldVectorClient.query('SELECT id, source_name, content, embedding, parent_id FROM "knowledge_base"');
    console.log(`Found ${kbRes.rows.length} knowledge base chunks to migrate.`);
    for (const chunk of kbRes.rows) {
      // Cast the source vector array representation safely to halfvec(384)
      let embeddingStr = null;
      if (chunk.embedding) {
        // Embeddings in the vector DB are standard float arrays. Convert to string formatted vector for PostgreSQL query
        const vectorArray = typeof chunk.embedding === 'string' ? JSON.parse(chunk.embedding) : chunk.embedding;
        embeddingStr = `[${vectorArray.slice(0, 384).join(',')}]`;
      }
      
      await targetPool.query(
        'INSERT INTO "knowledge_base" (id, source_name, content, embedding, parent_id) VALUES ($1, $2, $3, $4::halfvec, $5) ON CONFLICT DO NOTHING',
        [chunk.id, chunk.source_name, chunk.content, embeddingStr, chunk.parent_id]
      );
    }
    console.log('Knowledge base migration finished.');

    // F. Migrate Slang Synonym Terms (Merging from both DBs)
    console.log('\nStep 8: Migrating and Merging regional Slang Synonyms...');
    const oldRelSlang = await oldRelationalClient.query('SELECT term, meaning, embedding FROM "slang_vectors"');
    const oldVecSlang = await oldVectorClient.query('SELECT term, meaning, embedding FROM "slang_vectors"');
    
    // Combine terms, prioritizing oldVecSlang (which has richer descriptions and vectors)
    const slangMap = new Map();
    oldRelSlang.rows.forEach(r => slangMap.set(r.term.toLowerCase(), r));
    oldVecSlang.rows.forEach(r => slangMap.set(r.term.toLowerCase(), r));
    
    console.log(`Merged ${slangMap.size} unique vernacular terms from both original databases.`);
    
    for (const [term, data] of slangMap.entries()) {
      let embeddingStr = null;
      
      if (data.embedding) {
        const vectorArray = typeof data.embedding === 'string' ? JSON.parse(data.embedding) : data.embedding;
        embeddingStr = `[${vectorArray.slice(0, 384).join(',')}]`;
      } else {
        // Fallback: If embedding is missing, generate it natively on-the-fly!
        try {
          const generatedVec = await generateEmbedding(`${term}: ${data.meaning}`);
          if (generatedVec) {
            embeddingStr = `[${generatedVec.join(',')}]`;
          }
        } catch (err) {
          console.warn(`Failed to generate local embedding for slang term "${term}":`, err.message);
        }
      }
      
      await targetPool.query(
        'INSERT INTO "slang_vectors" (term, meaning, embedding) VALUES ($1, $2, $3::halfvec) ON CONFLICT (term) DO NOTHING',
        [term, data.meaning, embeddingStr]
      );
    }
    console.log('Slang vectors migration finished.');

    // G. Migrate Consolidated Catalog Products (High Volume Batching)
    console.log('\nStep 9: Migrating Consolidated Products Catalog...');
    
    // Select everything from yamabiko's detailed catalog_products
    const totalProdCountRes = await oldVectorClient.query('SELECT COUNT(*) FROM "catalog_products"');
    const totalProducts = parseInt(totalProdCountRes.rows[0].count);
    console.log(`Discovered ${totalProducts} catalog products to migrate in batches.`);
    
    const batchSize = 100;
    let offset = 0;
    
    while (offset < totalProducts) {
      console.log(`Migrating batch of products: ${offset} to ${offset + batchSize}...`);
      const batchQuery = `
        SELECT id, sku, name, category, price, gold_weight, diamond_details, metals, 
               product_specifications, description, availability, image_urls, product_url, 
               base_price, base_gold_rate, ai_description, embedding, gold_weight_numeric, 
               diamond_weight_numeric, gemstone_weight_numeric, occasion, gender, metal_color, 
               purity, collection, design_theme, product_type, platinum_weight_numeric, 
               silver_weight_numeric, jewellery_type
        FROM "catalog_products"
        ORDER BY id
        LIMIT $1 OFFSET $2
      `;
      const prodBatch = await oldVectorClient.query(batchQuery, [batchSize, offset]);
      
      for (const p of prodBatch.rows) {
        // Format embedding
        let embeddingStr = null;
        if (p.embedding) {
          const vectorArray = typeof p.embedding === 'string' ? JSON.parse(p.embedding) : p.embedding;
          embeddingStr = `[${vectorArray.slice(0, 384).join(',')}]`;
        } else {
          // Robust fallback: Generate local embedding for any catalog item missing one!
          try {
            const embeddingText = `${p.name}. ${p.description || ''} ${p.product_specifications || ''}`;
            const generatedVec = await generateEmbedding(embeddingText);
            if (generatedVec) {
              embeddingStr = `[${generatedVec.join(',')}]`;
            }
          } catch (err) {
            console.warn(`Embedding generate failed for product ID ${p.id}:`, err.message);
          }
        }
        
        // Parse raw string lists for hard negation arrays
        const gemstonesArray = [];
        const nameLower = (p.name || '').toLowerCase();
        const descLower = (p.description || '').toLowerCase();
        const rawGemType = (p.gemstone_type || '').toLowerCase();
        const isPolki = nameLower.includes('polki') || descLower.includes('polki') || rawGemType.includes('polki');

        if (p.diamond_weight_numeric > 0) gemstonesArray.push('diamond');
        if (p.gemstone_weight_numeric > 0 && p.gemstone_type) {
          const rawGem = p.gemstone_type.toLowerCase();
          if (rawGem.includes('ruby')) gemstonesArray.push('ruby');
          if (rawGem.includes('emerald')) gemstonesArray.push('emerald');
          if (rawGem.includes('pearl')) gemstonesArray.push('pearl');
          if (rawGem.includes('sapphire')) gemstonesArray.push('sapphire');
          if (rawGem.includes('synthetic')) gemstonesArray.push('synthetic');
        }
        if (isPolki && !gemstonesArray.includes('polki')) {
          gemstonesArray.push('polki');
        }
        if (gemstonesArray.length === 0) gemstonesArray.push('none');

        // Estimate visual fractional percentages based on weights if missing (Dynamic visual splits)
        const totalWeight = (parseFloat(p.gold_weight_numeric) || 0) + 
                            ((parseFloat(p.diamond_weight_numeric) || 0) * 0.2) + 
                            ((parseFloat(p.gemstone_weight_numeric) || 0) * 0.2); // carats to grams: ~0.2g per ct
        
        let goldPct = 0;
        let diamondPct = 0;
        let gemstonePct = 0;
        
        if (totalWeight > 0) {
          goldPct = parseFloat((((parseFloat(p.gold_weight_numeric) || 0) / totalWeight) * 100).toFixed(2));
          diamondPct = parseFloat(((((parseFloat(p.diamond_weight_numeric) || 0) * 0.2) / totalWeight) * 100).toFixed(2));
          gemstonePct = parseFloat(((((parseFloat(p.gemstone_weight_numeric) || 0) * 0.2) / totalWeight) * 100).toFixed(2));
        }

        let polkiPct = 0;
        let enamelPct = 0;
        if (isPolki) {
          polkiPct = gemstonePct > 0 ? gemstonePct : 20.00;
          if (gemstonePct === 0) {
            const remaining = 100.00 - polkiPct;
            goldPct = parseFloat((goldPct * (remaining / 100)).toFixed(2));
            diamondPct = parseFloat((diamondPct * (remaining / 100)).toFixed(2));
          }
        } else {
          enamelPct = gemstonePct > 0 ? gemstonePct : 0.00;
        }

        // Subcategory map
        const subCat = p.jewellery_type || p.category || '';
        
        // Comma list to SQL text array
        const imageList = p.image_urls ? p.image_urls.split(',').map(img => img.trim()) : [];

        // Save catalog products to NEW database
        const insertQuery = `
          INSERT INTO "catalog_products" (
            id, sku, name, category, sub_category, collection, gender, occasion, design_theme, 
            description, ai_description, image_urls, product_url, availability,
            gold_weight_numeric, purity, platinum_weight_numeric, silver_weight_numeric,
            diamond_weight_numeric, diamond_clarity, diamond_color, gemstone_weight_numeric, gemstone_type,
            making_charge_type, making_charge_value, diamond_rate_per_carat, gemstone_rate_per_carat,
            base_price, base_gold_rate,
            visible_gold_pct, visible_diamond_pct, visible_polki_pct, visible_enamel_pct,
            all_gemstones_array, all_motifs_array, all_craftsmanship_array,
            embedding
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, 
            $10, $11, $12, $13, $14,
            $15, $16, $17, $18,
            $19, $20, $21, $22, $23,
            $24, $25, $26, $27,
            $28, $29,
            $30, $31, $32, $33,
            $34, $35, $36,
            $37::halfvec
          ) ON CONFLICT (id) DO NOTHING;
        `;
        
        // Hardcode a fair transparent pricing formula baseline if missing
        const makingChargeType = 'per_gram';
        const makingChargeValue = 490.00; // Flat INR 490 labor per gram of gold
        const diamondRate = 85000.00; // INR 85k average per carat of diamond
        const gemstoneRate = 12000.00; // INR 12k average per carat of gemstone

        const params = [
          p.id, p.sku, p.name, p.category, subCat, p.collection, p.gender || 'Women', p.occasion, p.design_theme,
          p.description, p.ai_description, imageList, p.product_url, p.availability || 'In Stock',
          p.gold_weight_numeric || 0.000, p.purity || '22K', p.platinum_weight_numeric || 0.000, p.silver_weight_numeric || 0.000,
          p.diamond_weight_numeric || 0.000, p.diamond_clarity || 'SI', p.diamond_color || 'G-H', p.gemstone_weight_numeric || 0.000, p.gemstone_type,
          makingChargeType, makingChargeValue, diamondRate, gemstoneRate,
          p.base_price || p.price, p.base_gold_rate || 7335.00,
          goldPct, diamondPct, polkiPct, enamelPct,
          gemstonesArray, ['traditional'], ['jaali'],
          embeddingStr
        ];

        await targetPool.query(insertQuery, params);
      }
      
      offset += batchSize;
    }
    
    console.log('\nProducts migration completed successfully!');
    console.log('\n===========================================================');
    console.log('BOOTSTRAP COMPLETED: DATABASE CONSOLIDATED NATIVELY!');
    console.log('===========================================================');

  } catch (error) {
    console.error('FATAL CONSOLIDATION ERROR:', error);
    process.exit(1);
  } finally {
    // Gracefully shut down pools
    await targetPool.end();
    await oldRelationalClient.end();
    await oldVectorClient.end();
  }
}

run();
