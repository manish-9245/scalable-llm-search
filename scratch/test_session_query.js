import { searchCatalogue } from '../src/services/searchService.js';
import { redisClient } from '../src/config/redis.js';

async function testSessionQueryDirect() {
  try {
    // 1. Flush Redis to ensure we bypass any stale cached entries from before the deployment
    if (redisClient.isOpen) {
      console.log("Flushing Redis Cache to clear stale search cache keys...");
      await redisClient.flushAll();
    }

    const queryText = "platinum only";
    const existingFilters = {
      "motif": null,
      "gender": "Men",
      "motifs": [],
      "purity": null,
      "sortBy": null,
      "category": "Finger Rings",
      "gemstone": null,
      "maxPrice": 300000,
      "minPrice": null,
      "occasion": null,
      "exclusions": [],
      "metalColor": null,
      "broadIntent": false,
      "customLimit": null,
      "subCategory": null,
      "product_type": null,
      "resetContext": false,
      "visualSplits": {},
      "jewellery_type": null,
      "minDiamondCarat": null,
      "matchedGemstones": [],
      "negativeKeywordsToAdd": [
        "toe ring",
        "bichiya",
        "nose ring",
        "nath"
      ],
      "negativeKeywordsToPrune": []
    };

    console.log(`\nExecuting searchCatalogue with query: "${queryText}" and existingFilters...`);
    const searchRes = await searchCatalogue({ queryText, limit: 500, existingFilters });

    console.log("\n--- RESULT ---");
    console.log("Parsed Filters:", JSON.stringify(searchRes.parsedFilters, null, 2));
    console.log("Products Count:", searchRes.products.length);

    if (searchRes.products.length > 0) {
      const metalsCount = {};
      searchRes.products.forEach(p => {
        const metal = p.platinum_weight_numeric > 0 ? 'Platinum' : (p.gold_weight_numeric > 0 ? 'Gold' : 'Silver');
        metalsCount[metal] = (metalsCount[metal] || 0) + 1;
      });
      console.log("Returned products metal distribution:", metalsCount);

      console.log("\nFirst 3 products:");
      searchRes.products.slice(0, 3).forEach(p => {
        console.log(` - SKU: ${p.sku}, Name: ${p.name}, Purity: ${p.purity}, Metal Color: ${p.metal_color}, PlatWt: ${p.platinum_weight_numeric}, GoldWt: ${p.gold_weight_numeric}`);
      });
    }

  } catch (err) {
    console.error("Error executing query:", err);
  } finally {
    process.exit(0);
  }
}

testSessionQueryDirect();
