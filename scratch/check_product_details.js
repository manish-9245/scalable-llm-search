import { query } from '../src/config/db.js';

async function checkProductDetails() {
  try {
    const res = await query("SELECT * FROM catalog_products WHERE name ILIKE '%North Point Diamond Ring%';");
    console.log(JSON.stringify(res.rows[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkProductDetails();
