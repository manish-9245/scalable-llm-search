import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn("⚠️ [DB] DATABASE_URL is missing. Relational layer will be disabled.");
}

// Strictly configure pg Pool with Railway compatible SSL configs
const getSslConfig = (url) => {
  if (url.includes('proxy.rlwy.net') || url.includes('localhost') || url.includes('127.0.0.1')) {
    return false;
  }
  return { rejectUnauthorized: false };
};

export const pool = connectionString ? new Pool({
  connectionString,
  ssl: getSslConfig(connectionString),
  max: 20, 
  idleTimeoutMillis: 30000, 
  connectionTimeoutMillis: 5000 
}) : null;

if (pool) {
  pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err.message);
  });
}

export async function query(text, params) {
  if (!pool) {
    throw new Error('Database pool not initialized. Check DATABASE_URL.');
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development') {
      console.log(`Executed query in ${duration}ms:`, { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });
    }
    return res;
  } catch (error) {
    console.error('PostgreSQL query error:', { text, error: error.message });
    throw error;
  }
}
