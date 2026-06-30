import { query } from '../src/config/db.js';

async function main() {
  try {
    const res = await query(`
      SELECT id, sender, text, tool_params, created_at
      FROM chat_messages 
      WHERE session_id = $1
      ORDER BY created_at ASC
    `, ['3b8cb554-9d35-4c2c-9340-b2f52d8e67f3']);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
main();
