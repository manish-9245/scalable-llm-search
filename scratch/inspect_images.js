async function testSpecificUrls() {
  const urls = [
    // Original broken parameter URL stored in database
    'https://s7ap1.scene7.com/is/image/noveljewelsprod/GTMYA00-ACBR205?id=WWLUj2&fmt=jpg&dpr=off&fit=constrain',
    // Repaired URL with the comma restored
    'https://s7ap1.scene7.com/is/image/noveljewelsprod/GTMYA00-ACBR205?id=WWLUj2&fmt=jpg&dpr=off&fit=constrain,1&wid=427&hei=427',
    // Another one from database
    'https://s7ap1.scene7.com/is/image/noveljewelsprod/GTYYB00-DZEA005%281%29',
    // Another split one
    'https://s7ap1.scene7.com/is/image/noveljewelsprod/GTYYB00-DZEA005?id=iWQV30&fmt=jpg&dpr=off&fit=constrain',
    // Repaired
    'https://s7ap1.scene7.com/is/image/noveljewelsprod/GTYYB00-DZEA005?id=iWQV30&fmt=jpg&dpr=off&fit=constrain,1&wid=427&hei=427'
  ];

  for (const url of urls) {
    console.log(`\nTesting fetch on: "${url}"`);
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://s7ap1.scene7.com/',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      });
      console.log(`Status: ${response.status}`);
      console.log(`Content-Type: ${response.headers.get('content-type')}`);
    } catch (err) {
      console.error(`Error:`, err.message);
    }
  }
}

testSpecificUrls();
