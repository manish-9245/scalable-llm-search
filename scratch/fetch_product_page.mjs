import fetch from 'node-fetch';
import fs from 'fs';

async function run() {
  const url = 'https://www.indriya.com/jewellery-products/tirion-gold-short-necklace-jtaya20-acns226';
  try {
    console.log(`Fetching HTML from: ${url}`);
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });
    if (!res.ok) {
      console.error(`Fetch failed with status: ${res.status}`);
      return;
    }
    const html = await res.text();
    fs.writeFileSync('scratch/product_page.html', html);
    console.log('Saved HTML to scratch/product_page.html');
    
    // Search for interesting scripts or variables
    const lines = html.split('\n');
    console.log('Searching for interesting keywords in HTML...');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('productPrice') || line.includes('breakup') || line.includes('breakUp') || line.includes('priceBreakup') || line.includes('pricing') || line.includes('window.__') || line.includes('bootstrap') || line.includes('__NEXT_DATA__')) {
        console.log(`Line ${i+1}: ${line.trim().substring(0, 150)}`);
      }
    }
  } catch (err) {
    console.error('Error fetching page:', err);
  }
}

run();
