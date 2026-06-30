import { query } from '../src/config/db.js';

async function run() {
  try {
    const res = await query("SELECT * FROM daily_metal_rates ORDER BY record_date DESC LIMIT 50");
    console.log('Daily Metal Rates rows:');
    console.log(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
