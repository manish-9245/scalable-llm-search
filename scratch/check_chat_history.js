import { query } from '../src/config/db.js';

async function checkChatHistory() {
  try {
    const res = await query("SELECT products FROM chat_messages WHERE text ILIKE '%North Point Diamond Ring%' OR products::text ILIKE '%North Point Diamond Ring%' LIMIT 1;");
    if (res.rows.length > 0) {
       console.log(JSON.stringify(res.rows[0].products, null, 2));
    } else {
       console.log("No matching chat message found.");
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkChatHistory();
