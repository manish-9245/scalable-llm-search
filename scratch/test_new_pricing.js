import { query } from '../src/config/db.js';
import { getLatestMetalRates, buildDynamicPriceSQL } from '../src/services/searchService.js';

async function testNewPricing() {
  try {
    const rates = await getLatestMetalRates();
    const dynamicPriceSQL = buildDynamicPriceSQL(rates);
    
    const res = await query(`
      SELECT name, base_price, base_gold_rate, gold_weight_numeric,
             ${dynamicPriceSQL} AS calculated_price
      FROM catalog_products 
      WHERE name ILIKE '%North Point Diamond Ring%'
    `);
    
    console.log("New Pricing Result:");
    console.log(JSON.stringify(res.rows[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testNewPricing();
