import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.warn("⚠️ [REDIS] REDIS_URL is missing. Cache layer will be disabled.");
}

export const redisClient = redisUrl ? createClient({ url: redisUrl }) : { 
  isOpen: false, 
  on: () => {}, 
  get: () => null, 
  setEx: () => null, 
  connect: () => Promise.resolve() 
};

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
});

redisClient.on('connect', () => {
  console.log('Successfully connected to Redis Cache on Railway');
});

// Resilient initialization: Connect on boot, but do not crash Fastify if local Redis is temporarily unavailable
export async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
  } catch (error) {
    console.error('Failed to establish initial Redis connection. Retrying in background...', error.message);
  }
}
