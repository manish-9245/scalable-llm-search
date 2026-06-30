import { query } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import cron from 'node-cron';
import { log } from '../utils/logger.js';

export let OFFICIAL_CATEGORIES = []; 
export let DB_SCHEMA = { numericColumns: [], stringColumns: [], gemstones: [], motifs: [], ontology: {}, categoricalValues: {} };

/**
 * Update the dynamic schema metadata from the database.
 * This enables "self-healing" agents that know what's in the inventory without hardcoding.
 */
export async function updateDiscovery() {
    try {
        log.info("[DISCOVERY] Querying database for fresh schema metadata...");
        
        // 1. Update Categories (From Ontology or Data)
        const catRes = await query("SELECT DISTINCT target_value FROM search_ontology WHERE domain = 'category'");
        let categories = catRes.rows.map(r => r.target_value);
        
        if (categories.length === 0) {
            // Fallback to product data if ontology is empty
            const prodCatRes = await query("SELECT DISTINCT category FROM catalog_products WHERE category IS NOT NULL");
            categories = prodCatRes.rows.map(r => r.category);
        }

        if (categories.length > 0) {
            OFFICIAL_CATEGORIES.length = 0;
            OFFICIAL_CATEGORIES.push(...new Set(categories));
        }

        // 2. Update Schema (for self-healing filters)
        const schemaRes = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'catalog_products'
        `);
        
        const numericTypes = ['integer', 'numeric', 'real', 'double precision', 'bigint', 'smallint'];
        const numericCols = [];
        const stringCols = [];

        schemaRes.rows.forEach(col => {
            const name = col.column_name;
            const type = col.data_type.toLowerCase();
            
            if (numericTypes.some(t => type.includes(t))) {
                numericCols.push(name);
            } else {
                stringCols.push(name);
            }
        });

        // 3. Discover available gemstones and motifs from normalized tables
        let gemstones = [];
        let motifs = [];
        try {
            const gemRes = await query('SELECT DISTINCT stone_category as gemstone FROM product_gemstone_metrics ORDER BY gemstone');
            gemstones = gemRes.rows.map(r => r.gemstone);
        } catch (e) {
            log.warn("[DISCOVERY] product_gemstone_metrics table not found or empty", { error: e.message });
        }
        if (gemstones.length === 0) {
            gemstones = ['Diamond', 'Ruby', 'Emerald', 'Sapphire', 'Pearl', 'Polki', 'Synthetic'];
        }

        try {
            const motifRes = await query('SELECT DISTINCT motif FROM product_motifs ORDER BY motif');
            motifs = motifRes.rows.map(r => r.motif);
        } catch (e) {
            log.warn("[DISCOVERY] product_motifs table not found or empty", { error: e.message });
        }
        if (motifs.length === 0) {
            motifs = ['Peacock', 'Lotus', 'Floral', 'Crescent', 'Elephant', 'Mango', 'Kalka', 'Geometric', 'Chevron', 'Matsya', 'Fish'];
        }

        // 4. Load Ontology mappings
        const ontologyRes = await query('SELECT synonym as term, domain as mapping_type, target_value FROM search_ontology');
        const ontology = {};
        ontologyRes.rows.forEach(row => {
            if (!ontology[row.mapping_type]) ontology[row.mapping_type] = {};
            ontology[row.mapping_type][row.term.toLowerCase()] = row.target_value;
        });

        // 5. Discover distinct categorical values
        const categoricalValues = {};
        const categoricalCols = ['metal_color', 'purity', 'gender', 'occasion', 'category', 'collection'];
        for (const col of categoricalCols) {
            try {
                const res = await query(`SELECT DISTINCT ${col} FROM catalog_products WHERE ${col} IS NOT NULL`);
                categoricalValues[col] = res.rows.map(r => r[col]);
            } catch (e) {
                log.warn(`[DISCOVERY] Failed to discover values for ${col}`);
            }
        }

        // Update in-memory schema
        DB_SCHEMA.numericColumns = numericCols.filter(c => !['id', 'embedding'].includes(c));
        DB_SCHEMA.stringColumns = stringCols.filter(c => !['id', 'embedding', 'image_urls', 'product_url', 'ai_description'].includes(c));
        DB_SCHEMA.gemstones = gemstones;
        DB_SCHEMA.motifs = motifs;
        DB_SCHEMA.ontology = ontology;
        DB_SCHEMA.categoricalValues = categoricalValues;

        log.info("[DISCOVERY] Dynamic schema updated", {
            categories: OFFICIAL_CATEGORIES.length,
            gemstones: gemstones.length,
            motifs: motifs.length
        });

        // Cache in Redis
        try {
            if (redisClient.isOpen) {
                const payload = JSON.stringify({ DB_SCHEMA, OFFICIAL_CATEGORIES });
                await redisClient.set('schema:metadata', payload, { EX: 86400 }); // 24h
            }
        } catch (redisErr) {
            log.warn("[DISCOVERY] Failed to cache schema in Redis", { error: redisErr.message });
        }

    } catch (e) {
        log.error('[DISCOVERY] Failed to update discovery', { error: e.message });
    }
}

/**
 * Lazy loads the schema from Redis if possible.
 */
export async function loadSchema() {
    if (DB_SCHEMA.gemstones && DB_SCHEMA.gemstones.length > 0) return;

    try {
        if (redisClient.isOpen) {
            const cached = await redisClient.get('schema:metadata');
            if (cached) {
                const { DB_SCHEMA: cachedSchema, OFFICIAL_CATEGORIES: cachedCats } = JSON.parse(cached);
                Object.assign(DB_SCHEMA, cachedSchema);
                OFFICIAL_CATEGORIES.length = 0;
                OFFICIAL_CATEGORIES.push(...cachedCats);
                return;
            }
        }
    } catch (e) {
        console.warn("[DISCOVERY] Failed to read schema from Redis:", e.message);
    }

    await updateDiscovery();
}

/**
 * Returns dynamic context for agent instructions.
 */
export function getDynamicContext() {
    let context = "\n[DATABASE SCHEMA CONTEXT (DISCOVERED)]:\n";
    if (OFFICIAL_CATEGORIES.length > 0) context += `- **Valid categories**: ${OFFICIAL_CATEGORIES.join(", ")}\n`;
    if (DB_SCHEMA.gemstones?.length > 0) context += `- **Available Gemstones**: ${DB_SCHEMA.gemstones.slice(0, 30).join(", ")}\n`;
    if (DB_SCHEMA.motifs?.length > 0) context += `- **Available Motifs**: ${DB_SCHEMA.motifs.slice(0, 30).join(", ")}\n`;
    
    if (DB_SCHEMA.categoricalValues) {
        Object.entries(DB_SCHEMA.categoricalValues).forEach(([col, vals]) => {
            if (col !== 'category') context += `- **${col} options**: ${vals.slice(0, 15).join(", ")}\n`;
        });
    }
    return context;
}

export const startDiscoveryCron = () => {
    updateDiscovery();
    cron.schedule('0 0 * * *', updateDiscovery); // Daily at midnight
};

/**
 * Normalizes raw AI description JSON into structured sub-tables.
 * Ensures parity with the reference project's normalization strategy.
 */
export async function normalizeProductData(productId, aiDescription) {
    if (!aiDescription) return;

    try {
        let data;
        if (typeof aiDescription === 'string') {
            let cleanJson = aiDescription.trim();
            if (cleanJson.startsWith('```')) {
                const lines = cleanJson.split('\n');
                if (lines[0].startsWith('```json') || lines[0].startsWith('```')) lines.shift();
                if (lines[lines.length - 1].startsWith('```')) lines.pop();
                cleanJson = lines.join('\n').trim();
            }
            data = JSON.parse(cleanJson);
        } else {
            data = aiDescription;
        }
        
        // 1. Motifs
        const motifs = (data.motifs?.motif_details || []).map(m => m.motif_name).filter(Boolean);
        if (motifs.length > 0) {
            await query('DELETE FROM product_motifs WHERE product_id = $1', [productId]);
            for (const m of motifs) {
                await query('INSERT INTO product_motifs (product_id, motif) VALUES ($1, $2) ON CONFLICT DO NOTHING', [productId, m]);
            }
            await query('UPDATE catalog_products SET all_motifs_array = $1 WHERE id = $2', [motifs, productId]);
        }

        // 2. Occasions
        const occasions = [];
        const occasionMap = data.occasion_mapping_ratings_out_of_10 || {};
        for (const [name, rating] of Object.entries(occasionMap)) {
            if (parseInt(rating) >= 7) {
                occasions.push(name.replace(/_/g, ' '));
            }
        }
        if (occasions.length > 0) {
            await query('DELETE FROM product_occasions WHERE product_id = $1', [productId]);
            for (const o of occasions) {
                await query('INSERT INTO product_occasions (product_id, occasion) VALUES ($1, $2) ON CONFLICT DO NOTHING', [productId, o]);
            }
        }

        // 3. Gemstones
        const stones = (data.materials?.stone_inventory || []).map(s => s.name_english).filter(Boolean);
        if (stones.length > 0) {
            await query('DELETE FROM product_gemstone_metrics WHERE product_id = $1', [productId]);
            for (const s of data.materials.stone_inventory) {
                if (s.name_english) {
                    await query(`
                        INSERT INTO product_gemstone_metrics (product_id, stone_category, stone_type, total_carat_weight)
                        VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING
                    `, [productId, s.name_english, s.cut_style || 'Natural', 0]);
                }
            }
            await query('UPDATE catalog_products SET all_gemstones_array = $1 WHERE id = $2', [stones, productId]);
        }

        // 4. Visual Splits
        const splits = data.visual_dominance_analysis?.surface_split_percentages;
        if (splits) {
            const parsePercent = (val) => {
                if (typeof val === 'number') return val;
                if (typeof val === 'string') return parseFloat(val.replace(/[^0-9.]/g, '')) || 0;
                return 0;
            };

            await query(`
                UPDATE catalog_products 
                SET visible_gold_pct = $1,
                    visible_diamond_pct = $2,
                    visible_polki_pct = $3,
                    visible_enamel_pct = $4
                WHERE id = $5
            `, [
                parsePercent(splits.visible_gold_metal),
                parsePercent(splits.visible_diamond_white_stone),
                parsePercent(splits.visible_polki),
                parsePercent(splits.visible_enamel),
                productId
            ]);
        }

    } catch (e) {
        console.error(`[NORMALIZATION_ERROR] Failed for ID ${productId}:`, e.message);
    }
}
