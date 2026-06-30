import { query } from '../src/config/db.js';
import { searchCatalogue } from '../src/services/searchService.js';

async function runSessionContextVerification() {
  console.log('========================================================================');
  console.log('       INDRIYA AI SEARCH - CONVERSATIONAL SESSION CONTEXT VERIFIER');
  console.log('========================================================================\n');

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
    // 1. Create a mock chat session
    const sessionRes = await query(`
      INSERT INTO chat_sessions (user_id, title) 
      VALUES ($1, $2) RETURNING id
    `, [null, 'Mock Verifier Session']);
    
    const sessionId = sessionRes.rows[0].id;
    console.log(`Created mock session UUID: ${sessionId}`);

    // 2. TURN 1: User asks "mens rings under 100000"
    console.log('\n--- Turn 1: "mens rings under 100000" ---');
    const turn1Query = "mens rings under 100000";
    
    // Simulate user message
    await query(`
      INSERT INTO chat_messages (session_id, sender, text) 
      VALUES ($1, 'user', $2)
    `, [sessionId, turn1Query]);

    // Perform stateless search for Turn 1
    const searchResult1 = await searchCatalogue({ queryText: turn1Query, limit: 500, existingFilters: null });
    const filters1 = searchResult1.parsedFilters;

    assert(filters1.category === 'Finger Rings', 'Turn 1 category is Finger Rings.');
    assert(filters1.gender === 'Men', 'Turn 1 gender is Men.');
    assert(filters1.maxPrice === 100000, 'Turn 1 maxPrice is 100000.');
    assert(filters1.gemstone === null, 'Turn 1 gemstone is null.');

    // Save AI response with parsed tool_params
    await query(`
      INSERT INTO chat_messages (session_id, sender, text, products, tool_params) 
      VALUES ($1, 'ai', $2, $3::jsonb, $4::jsonb)
    `, [
      sessionId,
      `Found ${searchResult1.products.length} rings matching your preferences.`,
      JSON.stringify(searchResult1.products.map(p => ({ sku: p.sku }))),
      JSON.stringify(filters1)
    ]);

    // 3. TURN 2: User says "diamond only" (This should refine the active context, not reset it)
    console.log('\n--- Turn 2: "diamond only" ---');
    const turn2Query = "diamond only";

    // Simulate user message
    await query(`
      INSERT INTO chat_messages (session_id, sender, text) 
      VALUES ($1, 'user', $2)
    `, [sessionId, turn2Query]);

    // Fetch the previous filters from the database exactly as server.js does
    const lastMsgRes = await query(`
      SELECT tool_params FROM chat_messages 
      WHERE session_id = $1 AND sender = 'ai' AND tool_params IS NOT NULL 
      ORDER BY id DESC LIMIT 1
    `, [sessionId]);
    const existingFilters = lastMsgRes.rows.length > 0 ? lastMsgRes.rows[0].tool_params : null;
    
    assert(existingFilters !== null, 'Successfully fetched Turn 1 filters from database as context.');
    assert(existingFilters.category === 'Finger Rings', 'Retrieved Category: Finger Rings.');
    assert(existingFilters.gender === 'Men', 'Retrieved Gender: Men.');
    assert(existingFilters.maxPrice === 100000, 'Retrieved MaxPrice: 100,000.');

    // Perform stateful search for Turn 2 passing existingFilters
    const searchResult2 = await searchCatalogue({ queryText: turn2Query, limit: 500, existingFilters });
    const filters2 = searchResult2.parsedFilters;

    console.log('\n--- Merged Conversational Context Assertions ---');
    assert(filters2.category === 'Finger Rings', 'Context Preserved: Category is still Finger Rings!');
    assert(filters2.gender === 'Men', 'Context Preserved: Gender is still Men!');
    assert(filters2.maxPrice === 100000, 'Context Preserved: maxPrice is still 100000!');
    assert(filters2.gemstone === 'diamond', 'Refinement Applied: Gemstone successfully set to "diamond"!');
    assert(filters2.matchedGemstones.includes('diamond'), 'Refinement Applied: matchedGemstones includes "diamond"!');

    // Let's assert that the returned products are actually Men's rings under 100k that have diamonds
    const products = searchResult2.products || [];
    console.log(`\nFiltered results count: ${products.length} products found.`);
    if (products.length > 0) {
      const allRings = products.every(p => p.category === 'Finger Rings');
      const allMenOrUnisex = products.every(p => p.gender === 'Men' || p.gender === 'Unisex');
      const allUnder100k = products.every(p => p.calculated_price <= 100000);
      const allHaveDiamonds = products.every(p => p.diamond_weight_numeric > 0 || (p.all_gemstones_array && p.all_gemstones_array.includes('diamond')));
      
      assert(allRings, 'Aesthetic Audit: All matches are category "Finger Rings".');
      assert(allMenOrUnisex, 'Aesthetic Audit: All matches are designated for Men or Unisex.');
      assert(allUnder100k, 'Aesthetic Audit: All matches are strictly priced below ₹1,00,000 INR.');
      assert(allHaveDiamonds, 'Aesthetic Audit: All matches are verified to contain diamond details.');
    } else {
      console.log('[INFO] Catalog empty of Men\'s Diamond Rings under 100k. Verification of query execution correctness is sufficient.');
    }

    console.log('\n========================================================================');
    console.log('               VERIFICATION RESULTS:');
    console.log(`               >> ${passed} Assertions Passed`);
    console.log(`               >> ${failed} Assertions Failed`);
    console.log('========================================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('FATAL VERIFICATION EXCEPTION:', err);
    process.exit(1);
  }
}

runSessionContextVerification();
