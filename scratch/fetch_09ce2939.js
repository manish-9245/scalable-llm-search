import { pool } from '../src/config/db.js';

async function fetchSession() {
  try {
    const sessionId = '09ce2939-f9bc-463e-af75-e4e3849f62f8';
    console.log(`Fetching messages for session: ${sessionId}`);
    
    const messagesRes = await pool.query(
      `SELECT id, sender, text, tool_params, products
       FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY id ASC`,
      [sessionId]
    );

    console.log(`Found ${messagesRes.rows.length} messages.`);
    messagesRes.rows.forEach((msg, idx) => {
      console.log(`\n--- Message ${idx + 1} [${msg.sender.toUpperCase()}] ---`);
      console.log(`Text: ${msg.text}`);
      if (msg.tool_params) {
        console.log(`Tool Params: ${JSON.stringify(msg.tool_params, null, 2)}`);
      }
      if (msg.products) {
        console.log(`Products Count: ${msg.products.length}`);
        if (msg.products.length > 0) {
          console.log(`First Product: ${msg.products[0].sku} - ${msg.products[0].name} (${msg.products[0].purity} / ${msg.products[0].metal_color || 'NoColor'})`);
          console.log(`First 3 products preview:`);
          msg.products.slice(0, 3).forEach(p => {
            console.log(` - SKU: ${p.sku}, Name: ${p.name}, Purity: ${p.purity}, Metal Color: ${p.metal_color}, PlatWt: ${p.platinum_weight_numeric}, GoldWt: ${p.gold_weight_numeric}, Gemstone: ${p.gemstone_type}`);
          });
        }
      }
    });

  } catch (error) {
    console.error('Error fetching session messages:', error);
  } finally {
    await pool.end();
  }
}

fetchSession();
