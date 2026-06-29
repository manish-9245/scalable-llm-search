import { queryDatabaseTool } from '../src/mastra/tools.js';

async function testTool() {
  try {
    const res = await queryDatabaseTool.execute({
      semanticQuery: "North Point Diamond Ring",
      limit: 1
    });
    console.log(JSON.stringify(res.results[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

testTool();
