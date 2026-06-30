import { query } from '../src/config/db.js';

async function checkProduct() {
  try {
    const sku = 'DTYYD59-DDEC005';
    const res = await query(`
      SELECT id, sku, name, category, ai_description, description 
      FROM catalog_products 
      WHERE sku = $1
    `, [sku]);

    if (res.rows.length === 0) {
      console.log(`❌ Product with SKU ${sku} not found!`);
      process.exit(1);
    }

    const p = res.rows[0];
    console.log(`ID: ${p.id}`);
    console.log(`SKU: ${p.sku}`);
    console.log(`Name: ${p.name}`);
    console.log(`Category: ${p.category}`);
    console.log(`Description: ${p.description}`);
    console.log(`AI Description (length: ${p.ai_description ? p.ai_description.length : 0}):`);
    console.log(p.ai_description ? JSON.stringify(JSON.parse(p.ai_description), null, 2) : 'NULL');

    process.exit(0);
  } catch (err) {
    console.error('Error querying product:', err);
    process.exit(1);
  }
}

checkProduct();
