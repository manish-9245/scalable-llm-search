import { query } from '../src/config/db.js';

async function run() {
  try {
    const res = await query(`
      SELECT purity, COUNT(*), AVG(base_gold_rate::numeric) as avg_base_gold_rate
      FROM catalog_products 
      GROUP BY purity
    `);
    console.log('Purity and average base_gold_rate in DB:');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
