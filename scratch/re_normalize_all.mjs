
import { query } from '../src/config/db.js';
import { normalizeProductData } from '../src/services/discoveryService.js';

async function run() {
    console.log("Starting full re-normalization of catalog products...");
    const res = await query('SELECT id, ai_description FROM catalog_products WHERE ai_description IS NOT NULL');
    console.log(`Found ${res.rows.length} products to re-normalize.`);

    for (const row of res.rows) {
        console.log(`Normalizing product ID: ${row.id}...`);
        await normalizeProductData(row.id, row.ai_description);
    }

    console.log("Normalization complete.");
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
