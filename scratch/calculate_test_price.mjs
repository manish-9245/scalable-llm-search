import { query } from '../src/config/db.js';

async function run() {
  try {
    const ratesRes = await query("SELECT metal_type, rate_per_gram FROM daily_metal_rates ORDER BY record_date DESC");
    console.log('Daily Metal Rates from DB:');
    console.log(ratesRes.rows);

    const gold22K = ratesRes.rows.find(r => r.metal_type === '22KT Gold')?.rate_per_gram || 7335.00;
    console.log(`\nActive 22KT Gold Rate: ${gold22K}`);

    const prodRes = await query(`
      SELECT sku, name, base_price, base_gold_rate, gold_weight_numeric 
      FROM catalog_products 
      WHERE sku = 'JTAYA20-ACNS226'
    `);
    
    if (prodRes.rows.length === 0) {
      console.log('Product not found in DB!');
      return;
    }

    const p = prodRes.rows[0];
    const basePrice = parseFloat(p.base_price);
    const baseGoldRate = parseFloat(p.base_gold_rate);
    const goldWeight = parseFloat(p.gold_weight_numeric);

    console.log(`\nStored Database Product Details:`);
    console.log(`Name: ${p.name}`);
    console.log(`Base Price (cached): ${basePrice}`);
    console.log(`Base Gold Rate (cached): ${baseGoldRate}`);
    console.log(`Gold Weight (net): ${goldWeight}g`);

    // Delta-Anchor Formula:
    const calculatedDeltaPrice = basePrice + (goldWeight * (gold22K - baseGoldRate) * 1.03);
    console.log(`\nCalculated Price via Delta-Anchor Formula:`);
    console.log(`Formula: ${basePrice} + (${goldWeight} * (${gold22K} - ${baseGoldRate}) * 1.03)`);
    console.log(`Result: ${calculatedDeltaPrice.toFixed(2)}`);

    // Actual price on Indriya.com was fetched as: 1414975.00
    const actualIndriyaPrice = 1414975.00;
    const diff = calculatedDeltaPrice - actualIndriyaPrice;
    console.log(`\nActual Indriya.com Price: ${actualIndriyaPrice}`);
    console.log(`Difference (Calculated - Actual): ${diff.toFixed(2)} (${((diff / actualIndriyaPrice) * 100).toFixed(2)}%)`);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
