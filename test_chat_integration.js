import { query } from './src/config/db.js';

async function runChatIntegrationTest() {
  console.log('========================================================================');
  console.log('         INDRIYA AI SEARCH - CHAT INTEGRATION TEST SUITE');
  console.log('========================================================================');

  let passed = 0;
  let failed = 0;

  const assert = (condition, message) => {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  };

  try {
    // We will simulate Fastify HTTP API behavior using direct DB queries and the search router since the server may not be running in tests
    const { searchCatalogue } = await import('./src/services/searchService.js');

    // 1. Initialize a new chat session
    const createSession = await query(`
      INSERT INTO chat_sessions (user_id, title) 
      VALUES ($1, $2) RETURNING id, title
    `, [null, 'Integration Test Session']);
    
    const sessionId = createSession.rows[0].id;
    assert(sessionId !== null, `Session successfully created with UUID: ${sessionId}`);

    // 2. Simulate User Message 1: "Show me the top 3 most expensive necklaces without diamonds"
    const text1 = "Show me the top 3 most expensive necklaces without diamonds";
    await query(`INSERT INTO chat_messages (session_id, sender, text) VALUES ($1, 'user', $2)`, [sessionId, text1]);
    
    const search1 = await searchCatalogue({ queryText: text1, limit: 12 });
    assert(search1.parsedFilters.sortBy === 'price_desc', 'Parsed intention: Sort by most expensive.');
    assert(search1.parsedFilters.customLimit === 3, 'Parsed intention: Custom limit of 3.');
    assert(search1.parsedFilters.category === 'Necklaces', 'Parsed intention: Category is Necklaces.');
    assert(search1.parsedFilters.exclusions.includes('diamond'), 'Parsed intention: Excludes diamonds.');

    // Save AI reply for Message 1
    const aiMessage1 = await query(`
      INSERT INTO chat_messages (session_id, sender, text, products, tool_params) 
      VALUES ($1, 'ai', $2, $3::jsonb, $4::jsonb) RETURNING *
    `, [
      sessionId, 
      `Found ${search1.products.length} matches.`, 
      JSON.stringify(search1.products.slice(0, 3).map(p => ({ sku: p.sku }))),
      JSON.stringify(search1.parsedFilters)
    ]);
    assert(aiMessage1.rows[0].products !== null, 'AI reply 1 successfully saved JSONB products.');

    // 3. Simulate User Message 2: "how about poony under 90k?"
    const text2 = "how about poony under 90k?";
    await query(`INSERT INTO chat_messages (session_id, sender, text) VALUES ($1, 'user', $2)`, [sessionId, text2]);
    
    const search2 = await searchCatalogue({ queryText: text2, limit: 12 });
    assert(search2.parsedFilters.maxPrice === 90000, 'Parsed intention: maxPrice is 90,000 INR.');

    // Save AI reply for Message 2
    await query(`
      INSERT INTO chat_messages (session_id, sender, text, products, tool_params) 
      VALUES ($1, 'ai', $2, $3::jsonb, $4::jsonb) RETURNING *
    `, [
      sessionId, 
      `Found ${search2.products.length} matches.`, 
      JSON.stringify(search2.products.slice(0, 3).map(p => ({ sku: p.sku }))),
      JSON.stringify(search2.parsedFilters)
    ]);

    // 4. Retrieve Full Chronological History
    const history = await query(`
      SELECT sender, text FROM chat_messages 
      WHERE session_id = $1 
      ORDER BY created_at ASC
    `, [sessionId]);

    assert(history.rows.length === 4, 'Chronological history accurately returns 4 messages (2 user, 2 AI).');
    assert(history.rows[0].sender === 'user' && history.rows[0].text === text1, 'Message 1 is User text.');
    assert(history.rows[1].sender === 'ai', 'Message 2 is AI reply.');
    assert(history.rows[2].sender === 'user' && history.rows[2].text === text2, 'Message 3 is User text.');
    assert(history.rows[3].sender === 'ai', 'Message 4 is AI reply.');

    console.log('\n========================================================================');
    console.log(`               INTEGRATION TEST RESULTS:`);
    console.log(`               >> ${passed} Assertions Passed`);
    console.log(`               >> ${failed} Assertions Failed`);
    console.log('========================================================================');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('FATAL INTEGRATION EXCEPTION:', err);
    process.exit(1);
  }
}

runChatIntegrationTest();
