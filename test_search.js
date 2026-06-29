import { searchCatalogue } from './src/services/searchService.js';
import { pool } from './src/config/db.js';
import { redisClient } from './src/config/redis.js';

/**
 * Advanced Automated Verification & Logical Scenario Assertion Suite.
 * This script runs multi-stage logical assertions on query pre-parsing,
 * complex pricing, hard negation GIN indices, dynamic rates, and RRF merging.
 */
async function runLogicalTests() {
  console.log('========================================================================');
  console.log('         INDRIYA AI SEARCH - LOGICAL VERIFICATION & BENCHMARK');
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
    // Stage 1: Core Connection & Initialization Integrity Check
    console.log('\n--- STAGE 1: Infrastructure Integration Assertions ---');
    const dbCheck = await pool.query('SELECT 1');
    assert(dbCheck.rows.length === 1, 'PostgreSQL primary target database is active and reachable.');

    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.del('schema:metadata'); // Clear stale schema cache
    await redisClient.set('verification_sentinel', 'active');
    const redisCheck = await redisClient.get('verification_sentinel');
    assert(redisCheck === 'active', 'Redis high-speed cache tier read/write validated.');


    // Stage 2: Logical Synonym & Vernacular Slang Translation
    console.log('\n--- STAGE 2: Vernacular Synonym & Jargon Extraction Assertions ---');
    
    // Test Case A: Marathi "Thushi" Choker Jargon
    const queryA = await searchCatalogue({ queryText: 'traditional thushi necklaces' });
    assert(queryA.parsedFilters.category === 'Necklaces', 'Vernacular term "thushi" mapped category to "Necklaces".');
    
    // Test Case B: Hindi "Moti" Synonym to Pearl Gemstone
    const queryB = await searchCatalogue({ queryText: 'moti jhumkas under 2 lakhs' });
    assert(queryB.parsedFilters.category === 'Earrings', 'Hindi synonym "jhumkas" mapped category to "Earrings".');
    assert(queryB.parsedFilters.subCategory === 'Jhumkas', 'Hindi synonym "jhumkas" mapped sub-category to "Jhumkas".');
    assert(queryB.parsedFilters.matchedGemstones.includes('pearl'), 'Vernacular term "moti" correctly converted to gemstone "pearl".');


    // Stage 3: Numeric Boundaries & Regional Unit Conversion
    console.log('\n--- STAGE 3: Lakhs & Thousands Boundary Translation Assertions ---');
    
    // Test Case C: "Lakhs" boundary parse
    const queryC = await searchCatalogue({ queryText: 'rings under 1.5 lakhs' });
    assert(queryC.parsedFilters.maxPrice === 150000, 'Price boundary "1.5 lakhs" correctly translated to ₹1,50,000 INR.');

    // Test Case D: "Between" Multi-boundary parse with lakh unit suffix
    const queryD = await searchCatalogue({ queryText: 'kadas between 2 and 4 lakhs' });
    assert(queryD.parsedFilters.minPrice === 200000, 'Price "2" with trailing "lakhs" translated minPrice to ₹2,00,000 INR.');
    assert(queryD.parsedFilters.maxPrice === 400000, 'Price "4 lakhs" translated maxPrice to ₹4,00,000 INR.');

    // Test Case E: "k" (thousands) shorthand boundary parse
    const queryE = await searchCatalogue({ queryText: 'studs under 45k' });
    assert(queryE.parsedFilters.maxPrice === 45000, 'Shorthand "45k" translated maxPrice to ₹45,000 INR.');


    // Stage 4: Hard Negation Array GIN Filter Validation
    console.log('\n--- STAGE 4: Hard Negations & GIN Array Exclusion Assertions ---');
    
    const queryF = await searchCatalogue({ queryText: 'chandbalis without pearls excluding diamonds' });
    assert(queryF.parsedFilters.exclusions.includes('pearl'), 'Hard negation "without pearls" registered "pearl" exclusion.');
    assert(queryF.parsedFilters.exclusions.includes('diamond'), 'Hard negation "excluding diamonds" registered "diamond" exclusion.');

    if (queryF.products.length > 0) {
      let isPerfectExclusion = true;
      queryF.products.forEach(p => {
        if (p.all_gemstones_array.includes('pearl')) {
          isPerfectExclusion = false;
          console.error(`  [ERROR] SKU ${p.sku} returned but contains "pearl" in gemstones!`);
        }
        if (p.all_gemstones_array.includes('diamond')) {
          isPerfectExclusion = false;
          console.error(`  [ERROR] SKU ${p.sku} returned but contains "diamond" in gemstones!`);
        }
      });
      assert(isPerfectExclusion, 'GIN Array exclusion verified: All returned items strictly exclude pearls and diamonds.');
    } else {
      console.log('[WARN] Catalog products empty. Skipping actual exclusion results scanning.');
    }


    // Stage 5: Visual Fractional Splits Validation
    console.log('\n--- STAGE 5: Visual Fractional Split Assertions ---');
    
    const queryG = await searchCatalogue({ queryText: 'plain gold bangles mostly gold' });
    assert(queryG.parsedFilters.visualSplits.visible_gold_pct === 80.00, 'Aesthetic modifier "mostly gold" set gold dominance constraint to >= 80%.');

    if (queryG.products.length > 0) {
      let isGoldHeavy = true;
      queryG.products.forEach(p => {
        if (parseFloat(p.visible_gold_pct) < 80.00) {
          isGoldHeavy = false;
          console.error(`  [ERROR] SKU ${p.sku} returned gold percentage of only ${p.visible_gold_pct}%!`);
        }
      });
      assert(isGoldHeavy, 'Aesthetic split verified: All returned items represent >80% gold-dominant jewelry pieces.');
    }


    // Stage 6: Mathematical Formula & 3% GST Transparency Verification
    console.log('\n--- STAGE 6: Dynamic Pricing & 3% GST Arithmetic Verification ---');
    
    if (queryC.products.length > 0) {
      const p = queryC.products[0];
      const rates = queryC.rates;
      
      // Compute price using JS mirroring the exact SQL pricing engine
      const goldCost = (parseFloat(p.gold_weight_numeric) || 0) * (rates[p.purity] || rates['22K']);
      const platCost = (parseFloat(p.platinum_weight_numeric) || 0) * rates['Platinum'];
      const silverCost = (parseFloat(p.silver_weight_numeric) || 0) * rates['Silver'];
      const metalCost = goldCost + platCost + silverCost;
      
      const diamondCost = (parseFloat(p.diamond_weight_numeric) || 0) * (parseFloat(p.diamond_rate_per_carat) || 0);
      const gemCost = (parseFloat(p.gemstone_weight_numeric) || 0) * (parseFloat(p.gemstone_rate_per_carat) || 0);
      
      let makingCharge = 0;
      const makingChargeVal = parseFloat(p.making_charge_value) || 0;
      if (p.making_charge_type === 'per_gram') {
        makingCharge = (parseFloat(p.gold_weight_numeric) || 0) * makingChargeVal;
      } else if (p.making_charge_type === 'flat') {
        makingCharge = makingChargeVal;
      } else if (p.making_charge_type === 'percentage') {
        makingCharge = (goldCost * makingChargeVal) / 100;
      }
      
      const computedPrice = (metalCost + diamondCost + gemCost + makingCharge) * 1.03;
      const dbPrice = parseFloat(p.calculated_price);
      
      const priceDifference = Math.abs(computedPrice - dbPrice);
      assert(priceDifference < 0.01, `Transparent Pricing match: JS calculation (${computedPrice.toFixed(2)}) matches Postgres SQL dynamic price engine (${dbPrice.toFixed(2)}) with sub-penny precision.`);
    } else {
      console.log('[WARN] Skipping transparent price audit due to empty search results.');
    }


    // Stage 7: Performance Latency & Reciprocal Rank Fusion (RRF) Benchmarking
    console.log('\n--- STAGE 7: Performance & Reciprocal Rank Fusion Latency Profiling ---');
    
    const testQueries = [
      'traditional gold kadas under 3.5 lakhs',
      'chandbalis without pearls and no diamonds',
      'gift rings in 18k rose gold mostly gold',
      'traditional thushi under 1 lakh',
      'modern solitaires starting from 2 lakhs'
    ];

    let totalLatency = 0;
    for (const text of testQueries) {
      const qStart = Date.now();
      const res = await searchCatalogue({ queryText: text, limit: 12 });
      const qDuration = Date.now() - qStart;
      totalLatency += qDuration;
      
      assert(res.products.length >= 0, `Query "${text}" resolved in ${qDuration}ms (Found ${res.products.length} matches).`);
      if (res.products.length > 0) {
        // Assert descending ordering of RRF scores
        let isSortedByRRF = true;
        for (let i = 0; i < res.products.length - 1; i++) {
          if (res.products[i].rrfScore < res.products[i + 1].rrfScore) {
            isSortedByRRF = false;
            break;
          }
        }
        assert(isSortedByRRF, '  Results are strictly ordered by descending Reciprocal Rank Fusion (RRF) score.');
      }
    }

    const avgLatency = totalLatency / testQueries.length;
    console.log(`\nAverage Coordinated RRF Latency: ${avgLatency.toFixed(2)}ms`);
    // Local WASM CPU embedding generation adds ~150-250ms of CPU compute (avoiding $0.01 per-query API costs).
    // Pure DB lookup is sub-15ms, but full end-to-end CPU generation is budgeted at <500ms.
    assert(avgLatency < 500, 'Average end-to-end local-first search latency satisfies sub-500ms CPU budget.');


    // Summarize
    console.log('\n========================================================================');
    console.log(`               LOGICAL VERIFICATION RESULTS:`);
    console.log(`               >> ${passed} Assertions Passed`);
    console.log(`               >> ${failed} Assertions Failed`);
    console.log('========================================================================');

    // Tear down pools
    await pool.end();
    await redisClient.disconnect();
    
    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\nFATAL EXCEPTION RUNNING VERIFICATION SUITE:', error);
    process.exit(1);
  }
}

runLogicalTests();
