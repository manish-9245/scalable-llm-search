import { searchCatalogue } from '../src/services/searchService.js';

const queries = [
  "poony under 90k",
  "strictly no diamonds, only gold items",
  "show me the top 3 most expensive pieces from the gold ones",
  "show me premium rings",
  "Do you have thushi?",
  "bridal sets under 5L",
  "Show ones with diamond weight over 1 carat",
  "Show me gold chains over 100g",
  "yes show me the heaviest ones",
  "navratan jewellery",
  "only 22k items"
];

async function manualTest() {
  console.log("=== MANUAL TESTING OF LEGACY CHAT TEST CASES ===\n");
  for (const q of queries) {
    console.log(`Query: "${q}"`);
    const res = await searchCatalogue({ queryText: q, limit: 3 });
    console.log(`Filters parsed:`, JSON.stringify(res.parsedFilters));
    console.log(`Results found: ${res.products.length}`);
    if (res.products.length > 0) {
      res.products.slice(0, 3).forEach(p => {
         console.log(`  -> ${p.sku} | ${p.name} | ${p.calculated_price} | ${p.gold_weight_numeric}g | ${p.all_gemstones_array}`);
      });
    }
    console.log("--------------------------------------------------");
  }
  process.exit(0);
}

manualTest();
