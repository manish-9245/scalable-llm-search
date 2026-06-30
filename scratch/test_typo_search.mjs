import { searchCatalogue } from '../src/services/searchService.js';
import { resolveTerminology } from '../src/utils/terminology.js';

async function testTypo() {
    const query = "iamond rings";
    console.log("Resolving terminology for:", query);
    const resolved = await resolveTerminology(query);
    console.log("Resolved Terminology:", JSON.stringify(resolved, null, 2));

    console.log("\nSearching catalogue...");
    const res = await searchCatalogue({ queryText: query });
    console.log("Search Result Count:", res.products ? res.products.length : 0);
    if (res.products && res.products.length > 0) {
        console.log("First 3 products:", res.products.slice(0, 3).map(p => ({ sku: p.sku, name: p.name, category: p.category })));
    }
    process.exit(0);
}

testTypo().catch(err => {
    console.error(err);
    process.exit(1);
});
