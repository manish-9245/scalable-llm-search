import { resolveTerminology } from '../src/utils/terminology.js';

async function runTest() {
  try {
    const q1 = "mens rings uner 1L";
    const res1 = await resolveTerminology(q1);
    console.log(`Query: "${q1}"`);
    console.log(JSON.stringify(res1, null, 2));
    console.log("------------------------------------------");

    const q2 = "mens rings uner 100000";
    const res2 = await resolveTerminology(q2);
    console.log(`Query: "${q2}"`);
    console.log(JSON.stringify(res2, null, 2));
    console.log("------------------------------------------");

    process.exit(0);
  } catch (err) {
    console.error("Test failed:", err);
    process.exit(1);
  }
}

runTest();
