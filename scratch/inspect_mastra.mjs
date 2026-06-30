import { PostgresStore } from '@mastra/pg';
console.log('PostgresStore:', PostgresStore);
try {
  const store = new PostgresStore({ connectionString: 'postgres://localhost:5432' });
  console.log('Instance created successfully');
} catch (e) {
  console.log('Failed to create instance:', e.message);
}
