async function testLiveServer() {
  const sessionUrl = 'https://scalable-llm-search-production.up.railway.app/api/chat/session';
  const msgUrl = 'https://scalable-llm-search-production.up.railway.app/api/chat/message';

  console.log(`Creating a new chat session via ${sessionUrl}...`);
  const sessionRes = await fetch(sessionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Live Verification Session' })
  });
  console.log(`Session creation status: ${sessionRes.status}`);
  const sessionData = await sessionRes.json();
  const sessionId = sessionData.id;
  console.log(`Successfully created session. ID: ${sessionId}`);

  console.log(`\nSending Turn 1: "mens rings under 300000" to ${msgUrl}`);
  const res1 = await fetch(msgUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      text: 'mens rings under 300000',
      language: 'en-IN'
    })
  });
  console.log(`Status 1: ${res1.status}`);
  const data1 = await res1.json();
  console.log(`Turn 1 Success: ${data1.success}`);
  console.log(`Turn 1 Products Count: ${data1.searchResult?.products?.length || 0}`);

  console.log(`\nSending Turn 2: "platinum only" to ${msgUrl}`);
  const res2 = await fetch(msgUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      text: 'platinum only',
      language: 'en-IN'
    })
  });
  console.log(`Status 2: ${res2.status}`);
  const data2 = await res2.json();
  console.log(`Turn 2 Success: ${data2.success}`);
  console.log(`Turn 2 Parsed Filters:`, JSON.stringify(data2.searchResult?.parsedFilters, null, 2));
  console.log(`Turn 2 Products Count: ${data2.searchResult?.products?.length || 0}`);

  if (data2.searchResult?.products) {
    const metals = {};
    data2.searchResult.products.forEach(p => {
      const metal = p.platinum_weight_numeric > 0 ? 'Platinum' : (p.gold_weight_numeric > 0 ? 'Gold' : 'Silver');
      metals[metal] = (metals[metal] || 0) + 1;
    });
    console.log(`Turn 2 Metal Distribution:`, metals);
    console.log(`First 3 products:`);
    data2.searchResult.products.slice(0, 3).forEach(p => {
      console.log(` - SKU: ${p.sku}, Name: ${p.name}, PlatWt: ${p.platinum_weight_numeric}, GoldWt: ${p.gold_weight_numeric}`);
    });
  }
}

testLiveServer().catch(console.error);
