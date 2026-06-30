import { redisClient, connectRedis } from '../src/config/redis.js';

async function run() {
  try {
    await connectRedis();
    if (redisClient.isOpen) {
      console.log('Flushing Redis DB...');
      await redisClient.flushDb();
      console.log('Successfully flushed Redis cache!');
    } else {
      console.log('Redis client is not open, nothing to flush.');
    }
  } catch (err) {
    console.error('Flush failed:', err);
  } finally {
    try {
      if (redisClient.isOpen) {
        await redisClient.disconnect();
      }
    } catch (e) {}
    process.exit(0);
  }
}

run();
