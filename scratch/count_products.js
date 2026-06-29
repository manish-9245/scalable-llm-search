import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  const res = await client.query('SELECT COUNT(*) as total FROM catalog_products');
  console.log('Total products in catalog_products:', res.rows[0].total);
  await client.end();
}

main().catch(console.error);
