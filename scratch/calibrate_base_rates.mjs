import { query } from '../src/config/db.js';

async function run() {
  try {
    console.log('Starting catalog base rate calibration...');
    const selectBefore = await query(`
      SELECT COUNT(*), AVG(base_gold_rate::numeric) as avg_rate 
      FROM catalog_products;
    `);
    console.log('Before calibration:');
    console.log(`  Total items: ${selectBefore.rows[0].count}`);
    console.log(`  Average base gold rate: ${parseFloat(selectBefore.rows[0].avg_rate).toFixed(2)}`);

    const updateRes = await query(`
      UPDATE catalog_products 
      SET base_gold_rate = base_gold_rate / 2.0 
      WHERE base_gold_rate = 14020.00;
    `);
    console.log(`Successfully calibrated ${updateRes.rowCount} items.`);

    const selectAfter = await query(`
      SELECT COUNT(*), AVG(base_gold_rate::numeric) as avg_rate 
      FROM catalog_products;
    `);
    console.log('After calibration:');
    console.log(`  Total items: ${selectAfter.rows[0].count}`);
    console.log(`  Average base gold rate: ${parseFloat(selectAfter.rows[0].avg_rate).toFixed(2)}`);

  } catch (err) {
    console.error('Calibration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
