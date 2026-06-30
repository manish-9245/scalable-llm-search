import { fetchAndSyncRates } from '../src/services/rateFetcherService.js';
import { query } from '../src/config/db.js';
import { redisClient, connectRedis } from '../src/config/redis.js';

async function run() {
  console.log('===========================================================');
  console.log('TESTING INDRIYA LIVE DAILY RATE FETCHER & SYNC SERVICE');
  console.log('===========================================================');

  console.log('\nConnecting to Redis...');
  await connectRedis();

  console.log('\nExecuting fetchAndSyncRates()...');
  const success = await fetchAndSyncRates(async () => {
    console.log('🔥 [CALLBACK] Cache invalidator callback was successfully executed!');
  });

  console.log(`\nSync status: ${success ? '✅ SUCCESS' : '❌ FAILURE'}`);

  console.log('\nQuerying database for today\'s records:');
  const res = await query(`
    SELECT id, record_date, metal_type, rate_per_gram, created_at 
    FROM daily_metal_rates 
    WHERE record_date = CURRENT_DATE 
    ORDER BY metal_type
  `);
  
  if (res.rows.length === 0) {
    console.log('⚠️ No rows found for today\'s date in daily_metal_rates.');
  } else {
    console.log(`Successfully verified ${res.rows.length} updated rows:`);
    console.table(res.rows);
  }

  if (redisClient.isOpen) {
    console.log('\nClosing Redis connection...');
    await redisClient.quit();
  }
  console.log('\nTest completed.');
  process.exit(0);
}

run().catch(err => {
  console.error('\n❌ Test run failed with fatal error:', err);
  process.exit(1);
});
