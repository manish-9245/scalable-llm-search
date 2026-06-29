import { query } from '../src/config/db.js';

async function checkSku() {
  try {
    const res = await query("SELECT sku, name, ai_description, gold_weight_numeric, purity, platinum_weight_numeric, silver_weight_numeric, diamond_weight_numeric, diamond_clarity, diamond_color, gemstone_weight_numeric, gemstone_type, category, sub_category, collection, gender, occasion, design_theme FROM catalog_products WHERE sku = 'DEARA70-AQED262'");
    console.log(JSON.stringify(res.rows[0], null, 2));
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkSku();
