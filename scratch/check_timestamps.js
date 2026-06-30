import { pool } from '../src/config/db.js';

async function checkTimestamps() {
  try {
    const sessionId = '09ce2939-f9bc-463e-af75-e4e3849f62f8';
    
    const messagesRes = await pool.query(
      `SELECT id, sender, text, created_at
       FROM chat_messages 
       WHERE session_id = $1 
       ORDER BY id ASC`,
      [sessionId]
    );

    messagesRes.rows.forEach(msg => {
      console.log(`Msg ID: ${msg.id}, Sender: ${msg.sender}, Text: "${msg.text}", Created At: ${msg.created_at}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkTimestamps();
