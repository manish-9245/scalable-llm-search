import { searchCatalogue } from '../src/services/searchService.js';
import { resolveTerminology } from '../src/utils/terminology.js';
import { pool } from '../src/config/db.js';
import { redisClient } from '../src/config/redis.js';

async function runTestCases() {
    console.log('========================================================================');
    console.log('        SCALABLE-LLM-SEARCH - VERIFYING SIBLING REPO TEST CASES');
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
        if (!redisClient.isOpen) {
            await redisClient.connect();
        }

        // Flush cache to ensure we parse live
        await redisClient.flushDb();

        // 1. Nonsense Term Neutrality
        const nonsenseTerms = ['asdfgh', 'blorpal', 'xyzyx', 'qwerty jewellery', 'zxcvbnm'];
        for (const term of nonsenseTerms) {
            const resolved = await resolveTerminology(term);
            const hasResolution = resolved.category || resolved.subCategory || resolved.gemstone || resolved.motif || resolved.product_type;
            assert(!hasResolution, `Nonsense term "${term}" stayed perfectly neutral.`);
        }

        // 2. Category Mapping (General)
        const ringRes = await resolveTerminology('gold ring');
        assert(ringRes.category === 'Finger Rings', `Resolved "gold ring" category to "Finger Rings" (got "${ringRes.category}").`);

        const neckRes = await resolveTerminology('diamond necklace');
        assert(neckRes.category === 'Necklaces', `Resolved "diamond necklace" category to "Necklaces" (got "${neckRes.category}").`);

        // 3. Gemstone & Subcategory Detail
        const studsRes = await resolveTerminology('diamond studs');
        assert(studsRes.category === 'Earrings', `Resolved "diamond studs" category to "Earrings".`);
        assert(studsRes.gemstone === 'diamond', `Resolved "diamond studs" gemstone to "diamond".`);

        // 4. Regional Slangs (Thushi, Jhumka, Moti)
        const thushiRes = await searchCatalogue({ queryText: 'traditional thushi necklaces' });
        assert(thushiRes.parsedFilters.category === 'Necklaces', `Mapped slang "thushi" to "Necklaces".`);

        const motiRes = await searchCatalogue({ queryText: 'moti jhumkas under 2 lakhs' });
        assert(motiRes.parsedFilters.category === 'Earrings', `Mapped slang "jhumkas" category to "Earrings".`);
        assert(motiRes.parsedFilters.subCategory === 'Jhumkas', `Mapped slang "jhumkas" subcategory to "Jhumkas".`);
        assert(motiRes.parsedFilters.matchedGemstones.includes('pearl'), `Mapped Hindi slang "moti" to gemstone "pearl".`);

        // 5. Numerical Boundaries & Price Suffixes
        const priceRes1 = await searchCatalogue({ queryText: 'rings under 1.5 lakhs' });
        assert(priceRes1.parsedFilters.maxPrice === 150000, `Price suffix "1.5 lakhs" translated to ₹1,50,000.`);

        const priceRes2 = await searchCatalogue({ queryText: 'kadas between 2 and 4 lakhs' });
        assert(priceRes2.parsedFilters.minPrice === 200000 && priceRes2.parsedFilters.maxPrice === 400000, `Price range "between 2 and 4 lakhs" mapped to ₹2,00,000 - ₹4,00,000.`);

        const priceRes3 = await searchCatalogue({ queryText: 'studs under 45k' });
        assert(priceRes3.parsedFilters.maxPrice === 45000, `Shorthand "45k" translated to ₹45,000.`);

        // 6. Hard Negations / Exclusions
        const negRes = await searchCatalogue({ queryText: 'chandbalis without pearls excluding diamonds' });
        assert(negRes.parsedFilters.exclusions.includes('pearl'), `Excluded gemstone "pearl" via "without pearls".`);
        assert(negRes.parsedFilters.exclusions.includes('diamond'), `Excluded gemstone "diamond" via "excluding diamonds".`);

        // 7. Visual Dominance Splits
        const visualRes = await searchCatalogue({ queryText: 'plain gold bangles mostly gold' });
        assert(visualRes.parsedFilters.visualSplits.visible_gold_pct === 80, `Visual split modifier "mostly gold" registered 80% gold constraint.`);

        // 8. Typos / Spelling Normalization (Our new Fuse.js parser)
        const typoRes = await searchCatalogue({ queryText: 'diamon rings with 18000 gold' });
        assert(typoRes.parsedFilters.category === 'Finger Rings', `Corrected typo "diamon" and mapped category to "Finger Rings".`);
        assert(typoRes.parsedFilters.gemstone === 'diamond', `Corrected typo "diamon" to gemstone "diamond".`);
        assert(typoRes.parsedFilters.purity === '18K', `Extracted gold purity "18K" from "18000 gold".`);

        // 9. Motif Verification
        const motifRes = await searchCatalogue({ queryText: 'jewellery with peacock motif' });
        assert(motifRes.parsedFilters.motif === 'Peacock' || motifRes.parsedFilters.motifs.includes('Peacock'), `Resolved "peacock motif" to motif "Peacock".`);

        // 10. Hindi Slang "Panna" -> "Emerald"
        const pannaRes = await searchCatalogue({ queryText: 'panna ring' });
        assert(pannaRes.parsedFilters.gemstone === 'emerald' || pannaRes.parsedFilters.matchedGemstones.includes('emerald'), `Resolved Hindi gemstone slang "panna" to "emerald".`);

        // Summarize
        console.log('\n========================================================================');
        console.log(`               REGRESSION VERIFICATION SUMMARY:`);
        console.log(`               >> ${passed} Test Cases Passed`);
        console.log(`               >> ${failed} Test Cases Failed`);
        console.log('========================================================================');

    } catch (err) {
        console.error('Fatal exception during test run:', err);
    } finally {
        await pool.end();
        await redisClient.disconnect();
    }
}

runTestCases();
