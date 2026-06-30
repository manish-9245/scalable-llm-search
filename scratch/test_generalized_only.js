import { resolveTerminology } from '../src/utils/terminology.js';

async function runTests() {
  console.log("=========================================");
  console.log("RUNNING GENERALIZED ONLY PARSING TEST SUITE");
  console.log("=========================================");

  const cases = [
    {
      query: 'silver only',
      assertions: (res) => {
        return res.product_type === 'silver' &&
               res.exclusions.includes('gold') &&
               res.exclusions.includes('platinum');
      }
    },
    {
      query: 'rose gold only',
      assertions: (res) => {
        return res.metalColor === 'Rose' &&
               res.exclusions.includes('white') &&
               res.exclusions.includes('yellow') &&
               res.exclusions.includes('dual-tone') &&
               res.exclusions.includes('tri-tone');
      }
    },
    {
      query: 'ruby only',
      assertions: (res) => {
        return res.gemstone === 'ruby' &&
               res.exclusions.includes('diamond') &&
               res.exclusions.includes('emerald') &&
               res.exclusions.includes('pearl') &&
               res.exclusions.includes('sapphire') &&
               res.exclusions.includes('synthetic') &&
               res.exclusions.includes('polki');
      }
    },
    {
      query: 'not white gold, yellow gold only',
      assertions: (res) => {
        return res.metalColor === 'Yellow' &&
               res.exclusions.includes('white') &&
               res.exclusions.includes('rose') &&
               res.exclusions.includes('dual-tone') &&
               res.exclusions.includes('tri-tone');
      }
    },
    {
      query: 'platinum only',
      assertions: (res) => {
        return res.product_type === 'platinum' &&
               res.exclusions.includes('gold') &&
               res.exclusions.includes('silver');
      }
    }
  ];

  let passedCount = 0;
  for (const c of cases) {
    const res = await resolveTerminology(c.query);
    const passed = c.assertions(res);
    if (passed) {
      console.log(`[PASS] "${c.query}" parsed correctly.`);
      passedCount++;
    } else {
      console.log(`[FAIL] "${c.query}" parsing failed:`, JSON.stringify(res, null, 2));
    }
  }

  console.log("=========================================");
  if (passedCount === cases.length) {
    console.log(`ALL ${cases.length} DYNAMIC ONLY TESTS PASSED SUCCESSFULLY!`);
    process.exit(0);
  } else {
    console.log(`SOME TESTS FAILED! (${passedCount}/${cases.length} passed)`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test execution crashed:", err);
  process.exit(1);
});
