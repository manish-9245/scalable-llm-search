import { query } from '../src/config/db.js';

async function checkProduct() {
  try {
    const res = await query("SELECT sku, name, gold_weight_numeric, diamond_weight_numeric, purity, base_price, category, sub_category FROM catalog_products WHERE name ILIKE '%North Point Diamond Ring%';");
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkProduct();
