import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { query } from '../config/db.js';
import { generateEmbedding } from '../config/llm.js';
import { DB_SCHEMA, loadSchema, OFFICIAL_CATEGORIES } from '../services/discoveryService.js';
import { QueryBuilder, getRawSql } from '../utils/QueryBuilder.js';
import { resolveTerminology } from '../utils/terminology.js';
import { getLatestMetalRates, buildDynamicPriceSQL } from '../services/searchService.js';

/**
 * Detects if the user has a specific visual dominance intent (e.g. "mostly gold", "only diamond").
 */
function detectVisualIntent(queryText) {
    if (!queryText) return [];
    const lowQuery = queryText.toLowerCase();
    const intents = [];
    
    const diamondKeywords = ['diamond', 'diamonds', 'heera', 'hira', 'solitaire'];
    const goldKeywords = ['gold', 'sona', 'metal', 'plain gold', 'only gold', 'pure gold'];
    const enamelKeywords = ['enamel', 'meenakari', 'minakari', 'enamelled'];
    
    if (diamondKeywords.some(kw => lowQuery.includes(kw)) && (lowQuery.includes('only') || lowQuery.includes('mostly') || lowQuery.includes('heavy'))) {
        intents.push({ type: 'diamond', weight: 0.7 });
    }
    if (goldKeywords.some(kw => lowQuery.includes(kw)) && (lowQuery.includes('plain') || lowQuery.includes('only') || lowQuery.includes('mostly'))) {
        intents.push({ type: 'gold', weight: 0.7 });
    }
    if (enamelKeywords.some(kw => lowQuery.includes(kw))) {
        intents.push({ type: 'enamel', weight: 0.1 });
    }
    
    return intents;
}

export const queryDatabaseTool = createTool({
    id: 'queryDatabase',
    description: 'Searches the Indriya jewellery catalogue using hybrid vector + structured search. Returns { results, metadata }. Use gemstone/motif filters for specific materials/designs. Supports negativeKeywords for exclusions.',
    inputSchema: z.object({
        semanticQuery: z.string().describe('The user query for vector search.'),
        category: z.string().nullable().optional(),
        negativeKeywords: z.array(z.string()).nullable().optional(),
        limit: z.number().nullable().optional().default(12),
        price_max: z.number().nullable().optional(),
        price_min: z.number().nullable().optional(),
        gemstone: z.string().nullable().optional(),
        motif: z.string().nullable().optional(),
        gender: z.enum(['Men', 'Women', 'Unisex']).nullable().optional(),
        occasion: z.string().nullable().optional(),
        sortBy: z.enum(['price_asc', 'price_desc', 'weight_desc', 'weight_asc']).nullable().optional()
    }),
    execute: async (params) => {
        try {
            await loadSchema();
            const { semanticQuery, category, negativeKeywords, limit, price_max, price_min, gemstone, motif, gender, occasion, sortBy } = params;
            
            // 1. Resolve terminology & detect visual intent
            const resolved = await resolveTerminology(semanticQuery, { negativeKeywords });
            const visualIntents = detectVisualIntent(semanticQuery);
            
            // 2. Generate embedding & Get rates
            const embedding = await generateEmbedding(semanticQuery);
            const rates = await getLatestMetalRates();
            const dynamicPriceSQL = buildDynamicPriceSQL(rates);
            
            // 3. Build Query
            const qb = new QueryBuilder();
            qb.setDynamicPriceSQL(dynamicPriceSQL);
            qb.setEmbedding(embedding);
            qb.setFtsQuery(semanticQuery);
            qb.limit = limit || 12;

            // Apply Resolved Filters
            const finalCategory = category || resolved.category;
            const finalGemstone = gemstone || resolved.gemstone;
            const finalMotif = motif || resolved.motif;

            if (finalCategory) qb.addStringFilter('category', '=', finalCategory);
            if (gender) qb.addStringFilter('gender', '=', gender);
            if (price_max) qb.addNumericFilter('price', '<=', price_max);
            if (price_min) qb.addNumericFilter('price', '>=', price_min);
            if (finalGemstone) qb.addStringFilter('gemstone', '=', finalGemstone);
            if (finalMotif) qb.addStringFilter('motif', '=', finalMotif);
            if (occasion) qb.addStringFilter('occasion', '=', occasion);

            // Apply Visual Intent Weighting
            visualIntents.forEach(intent => {
                if (intent.type === 'gold') qb.addNumericFilter('visible_gold_pct', '>=', 60);
                if (intent.type === 'diamond') qb.addNumericFilter('visible_diamond_pct', '>=', 40);
                if (intent.type === 'enamel') qb.addNumericFilter('visible_enamel_pct', '>', 0);
            });

            // Apply Negations
            const finalNegatives = [...(negativeKeywords || []), ...(resolved.negativeKeywordsToAdd || [])];
            finalNegatives.forEach(nk => {
                // Determine the most likely column for the negative keyword
                if (OFFICIAL_CATEGORIES.some(c => c.toLowerCase() === nk.toLowerCase())) {
                    qb.addStringFilter('category', '!=', nk, true);
                } else if (DB_SCHEMA.gemstones.some(g => g.toLowerCase() === nk.toLowerCase())) {
                    qb.addStringFilter('gemstone', '!=', nk, true);
                } else if (DB_SCHEMA.motifs.some(m => m.toLowerCase() === nk.toLowerCase())) {
                    qb.addStringFilter('motif', '!=', nk, true);
                } else {
                    qb.addStringFilter('name', 'NOT ILIKE', nk, true);
                }
            });

            if (sortBy === 'price_asc') qb.orderBy = 'p.base_price ASC';
            else if (sortBy === 'price_desc') qb.orderBy = 'p.base_price DESC';

            const { sql, values } = qb.build();
            const rawSql = getRawSql(sql, values);
            console.log("[SEARCH] SQL:", rawSql.replace(/\s+/g, ' ').trim());

            let res = await query(sql, values);
            let rows = res.rows;
            let relaxationType = 'none';

            // 4. Relaxation logic
            if (rows.length === 0) {
                console.log("[SEARCH] Zero results. Relaxing filters...");
                const qbRelaxed = new QueryBuilder();
                qbRelaxed.setEmbedding(embedding);
                qbRelaxed.setFtsQuery(semanticQuery);
                qbRelaxed.limit = limit || 12;
                
                // Keep only essential filters
                if (finalCategory) qbRelaxed.addStringFilter('category', '=', finalCategory);
                
                const relaxed = qbRelaxed.build();
                const relaxedRes = await query(relaxed.sql, relaxed.values);
                rows = relaxedRes.rows;
                relaxationType = 'partial';
                
                if (rows.length === 0) {
                   const qbNuclear = new QueryBuilder();
                   qbNuclear.setEmbedding(embedding);
                   qbNuclear.setFtsQuery(semanticQuery);
                   qbNuclear.limit = limit || 12;
                   const nuclear = qbNuclear.build();
                   const nuclearRes = await query(nuclear.sql, nuclear.values);
                   rows = nuclearRes.rows;
                   relaxationType = 'nuclear';
                }
            }

            return {
                results: rows,
                metadata: {
                    relaxation: relaxationType,
                    count: rows.length,
                    sql: rawSql
                }
            };
        } catch (error) {
            console.error("[SEARCH_ERROR]", error.message);
            return { error: error.message };
        }
    }
});
