import { pool } from '../src/config/db.js';

async function analyzeMessageProducts() {
  try {
    const sessionId = '09ce2939-f9bc-463e-af75-e4e3849f62f8';
    
    const messagesRes = await pool.query(
      `SELECT id, sender, text, tool_params, products
       FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY id ASC`,
      [sessionId]
    );

    const msg4 = messagesRes.rows[3]; // Message 4 (AI response to "platinum only")
    if (!msg4 || !msg4.products) {
      console.log("No AI response products found.");
      return;
    }

    console.log(`Total products returned in Message 4: ${msg4.products.length}`);
    const metalsCount = {};
    msg4.products.forEach(p => {
      const metal = p.platinum_weight_numeric > 0 ? 'Platinum' : (p.gold_weight_numeric > 0 ? 'Gold' : 'Silver');
      metalsCount[metal] = (metalsCount[metal] || 0) + 1;
    });

    console.log("Returned products metal distribution:", metalsCount);

    if (metalsCount['Gold'] > 0) {
      console.log("\nSome Gold products returned in Message 4:");
      msg4.products.filter(p => !(p.platinum_weight_numeric > 0)).slice(0, 5).forEach(p => {
        console.log(` - SKU: ${p.sku}, Name: ${p.name}, PlatWt: ${p.platinum_weight_numeric}, GoldWt: ${p.gold_weight_numeric}`);
      });
    }

  } catch (error) {
    console.error('Error analyzing products:', error);
  } finally {
    await pool.end();
  }
}

analyzeMessageProducts();
