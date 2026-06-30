import { query } from '../src/config/db.js';

async function run() {
  try {
    const res = await query(`
      SELECT sku, name, category, base_price, base_gold_rate, gold_weight_numeric, product_url 
      FROM catalog_products 
      WHERE product_url IS NOT NULL 
      LIMIT 5
    `);
    console.log('Sample Products with URLs:');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
