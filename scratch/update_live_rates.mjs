import { query } from '../src/config/db.js';

async function run() {
  try {
    console.log('Restoring catalog base rates to original authentic 14,020.00...');
    const restoreRes = await query(`
      UPDATE catalog_products 
      SET base_gold_rate = base_gold_rate * 2.0 
      WHERE base_gold_rate = 7010.00;
    `);
    console.log(`Successfully restored ${restoreRes.rowCount} items.`);

    console.log('\nRe-syncing daily_metal_rates_id_seq sequence...');
    await query(`
      SELECT setval(pg_get_serial_sequence('daily_metal_rates', 'id'), COALESCE(MAX(id), 1)) FROM daily_metal_rates;
    `);

    console.log('\nInserting official actual June 30, 2026 metal rates into daily_metal_rates...');
    
    // We insert today's authentic Indriya.com rates:
    // - 22KT Gold: 13,080.00 INR/g (Official Indriya rate)
    // - 18KT Gold: 10,710.00 INR/g
    // - 14KT Gold: 8,330.00 INR/g
    // - 24KT Gold: 14,270.00 INR/g
    // - Platinum: 3,550.00 INR/g
    // - Silver: 88.00 INR/g
    const rates = [
      { type: '22KT Gold', rate: 13080.00 },
      { type: '18KT Gold', rate: 10710.00 },
      { type: '14KT Gold', rate: 8330.00 },
      { type: '24KT Gold', rate: 14270.00 },
      { type: 'Platinum', rate: 3550.00 },
      { type: 'Silver', rate: 88.00 }
    ];

    for (const r of rates) {
      await query(`
        INSERT INTO daily_metal_rates (record_date, metal_type, rate_per_gram)
        VALUES (CURRENT_DATE, $1, $2)
        ON CONFLICT (record_date, metal_type)
        DO UPDATE SET rate_per_gram = EXCLUDED.rate_per_gram;
      `, [r.type, r.rate]);
      console.log(`  Inserted/Updated: ${r.type} -> ${r.rate.toFixed(2)}`);
    }

    console.log('\nAll rates successfully updated!');

  } catch (err) {
    console.error('Update failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
