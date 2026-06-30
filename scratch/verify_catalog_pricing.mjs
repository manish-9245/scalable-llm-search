import { query } from '../src/config/db.js';
import fetch from 'node-fetch';

async function fetchLivePrice(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 5000
    });
    if (!res.ok) return null;
    const text = await res.text();
    const match = text.match(/productPrice",\s*'([\d.]+)'/);
    if (match) {
      return parseFloat(match[1]);
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function run() {
  try {
    const res = await query(`
      SELECT id, sku, name, category, purity, 
             gold_weight_numeric, base_price, base_gold_rate, 
             diamond_weight_numeric, diamond_rate_per_carat,
             gemstone_weight_numeric, gemstone_rate_per_carat,
             making_charge_type, making_charge_value,
             product_url
      FROM catalog_products
      WHERE product_url IS NOT NULL AND gold_weight_numeric > 0
      LIMIT 10
    `);

    console.log('Fetching live prices for 10 sample products...\n');

    const rates = {
      '22K': 13080.00,
      '18K': 10710.00,
      '14K': 8330.00,
      '24K': 14270.00,
      'Platinum': 3550.00,
      'Silver': 88.00
    };

    const results = [];

    for (const p of res.rows) {
      const livePrice = await fetchLivePrice(p.product_url);
      
      const goldWeight = parseFloat(p.gold_weight_numeric) || 0;
      const basePrice = parseFloat(p.base_price) || 0;
      const baseGoldRate = parseFloat(p.base_gold_rate) || 0;
      const currentGoldRate = rates['22K']; // Baseline gold rate for 22K

      // 1. Delta-Anchor calculated price (using stored 14,020.00)
      const deltaAnchorPrice = basePrice + (goldWeight * (currentGoldRate - baseGoldRate) * 1.03);

      // 2. Itemized Breakdown Price
      const purity = p.purity || '22K';
      const metalRate = rates[purity] || rates['22K'];
      const metalCost = goldWeight * metalRate;
      const diamondCost = (parseFloat(p.diamond_weight_numeric) || 0) * (parseFloat(p.diamond_rate_per_carat) || 0);
      const gemstoneCost = (parseFloat(p.gemstone_weight_numeric) || 0) * (parseFloat(p.gemstone_rate_per_carat) || 0);
      
      let makingCharge = 0;
      const mVal = parseFloat(p.making_charge_value) || 0;
      if (p.making_charge_type === 'per_gram') {
        makingCharge = goldWeight * mVal;
      } else if (p.making_charge_type === 'flat') {
        makingCharge = mVal;
      } else if (p.making_charge_type === 'percentage') {
        makingCharge = (metalCost * mVal) / 100;
      }
      
      const itemizedPrice = (metalCost + diamondCost + gemstoneCost + makingCharge) * 1.03;

      results.push({
        sku: p.sku,
        name: p.name,
        category: p.category,
        goldWeight: goldWeight,
        basePrice,
        livePrice,
        deltaAnchorPrice,
        itemizedPrice
      });
    }

    console.log('Pricing Analysis Table:\n');
    console.log(String.prototype.padEnd ? 'SKU'.padEnd(16) + ' | ' + 'Base Price'.padEnd(12) + ' | ' + 'Live Price'.padEnd(12) + ' | ' + 'Delta-Anchor'.padEnd(14) + ' | ' + 'Itemized'.padEnd(12) : 'SKU | Base Price | Live Price | Delta-Anchor | Itemized');
    console.log('---------------------------------------------------------------------------------------');
    for (const r of results) {
      console.log(
        `${r.sku.padEnd(16)} | ` +
        `${r.basePrice.toFixed(0).padEnd(12)} | ` +
        `${(r.livePrice ? r.livePrice.toFixed(0) : 'N/A').padEnd(12)} | ` +
        `${r.deltaAnchorPrice.toFixed(0).padEnd(14)} | ` +
        `${r.itemizedPrice.toFixed(0).padEnd(12)}`
      );
    }

    console.log('\nDiscrepancy Analysis (vs Live Price):\n');
    for (const r of results) {
      if (!r.livePrice) continue;
      const deltaDiff = r.deltaAnchorPrice - r.livePrice;
      const deltaPct = (deltaDiff / r.livePrice) * 100;
      const itemizedDiff = r.itemizedPrice - r.livePrice;
      const itemizedPct = (itemizedDiff / r.livePrice) * 100;

      console.log(`Product: ${r.name} (${r.sku})`);
      console.log(`  Live Price: ₹${r.livePrice.toLocaleString('en-IN')}`);
      console.log(`  Delta-Anchor (with 14,020.00 base rate): ₹${r.deltaAnchorPrice.toLocaleString('en-IN')} (Diff: ${deltaPct.toFixed(2)}%)`);
      console.log(`  Itemized Breakdown (with DB fields):     ₹${r.itemizedPrice.toLocaleString('en-IN')} (Diff: ${itemizedPct.toFixed(2)}%)`);
      console.log();
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
