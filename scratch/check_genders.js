import { query } from '../src/config/db.js';

async function main() {
  try {
    const res = await query(`
      SELECT sku, name, gender, category 
      FROM catalog_products 
      WHERE sku IN ('GTLYA00-AQFL219', 'GTUYA00-APFG836', 'GTSYA00-APFG855')
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
