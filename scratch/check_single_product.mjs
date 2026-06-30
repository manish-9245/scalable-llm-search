import { query } from '../src/config/db.js';

async function run() {
  try {
    const res = await query(`
      SELECT * 
      FROM catalog_products 
      WHERE sku = 'JTAYA20-ACNS226'
    `);
    console.log(JSON.stringify(res.rows[0], null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
