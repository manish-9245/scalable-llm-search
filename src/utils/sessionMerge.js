/**
 * Smart compounding session filter merging logic for Indriya AI Jewellery Search.
 * Ensures the 'motive of the chat' (active search filters/constraints) is preserved
 * and correctly refined across conversational turns, taking inspiration from jewel-search.
 */
export function mergeFilters(existing, parsed) {
    // If no existing filters, or the user query explicitly demands a reset
    if (!existing || parsed.resetContext) {
        return { ...parsed };
    }

    const merged = { ...existing };

    // Category Shift Protection:
    // If a new category is specified, and it's different from the existing one,
    // we MUST clear previous category-specific constraints (subCategory, gemstone, motif, exclusions, visual splits)
    // to ensure the user gets a fresh, clean slate for the new category search.
    if (parsed.category && existing.category && existing.category !== parsed.category) {
        merged.subCategory = null;
        merged.jewellery_type = null;
        merged.gemstone = null;
        merged.matchedGemstones = [];
        merged.motif = null;
        merged.motifs = [];
        merged.exclusions = [];
        merged.visualSplits = {};
    }

    // Boolean or single fields: overwrite only if parsed value is not null and not empty
    const singleFields = [
        'category', 'subCategory', 'gemstone', 'motif', 'occasion',
        'product_type', 'jewellery_type', 'purity', 'metalColor',
        'minPrice', 'maxPrice', 'minDiamondCarat', 'sortBy', 'customLimit', 'gender'
    ];

    singleFields.forEach(field => {
        if (parsed[field] !== null && parsed[field] !== undefined && parsed[field] !== '') {
            merged[field] = parsed[field];
        }
    });

    // Array fields merging:
    // 1. motifs & single motif
    if (parsed.motif) {
        merged.motif = parsed.motif;
        merged.motifs = [...parsed.motifs];
    } else {
        merged.motif = merged.motif || null;
        merged.motifs = [...(merged.motifs || [])];
    }

    // 2. matchedGemstones & single gemstone
    if (parsed.gemstone) {
        merged.gemstone = parsed.gemstone;
        merged.matchedGemstones = [...parsed.matchedGemstones];
    } else {
        merged.gemstone = merged.gemstone || null;
        merged.matchedGemstones = [...(merged.matchedGemstones || [])];
    }

    // 3. exclusions
    if (parsed.exclusions && parsed.exclusions.length > 0) {
        merged.exclusions = Array.from(new Set([...(merged.exclusions || []), ...parsed.exclusions]));
    } else {
        merged.exclusions = [...(merged.exclusions || [])];
    }

    // Symmetrical Gemstone vs. Exclusion Conflict Resolution:
    // A. Remove actively selected gemstone(s) from exclusions to prevent contradictory filters.
    if (merged.gemstone) {
        merged.exclusions = merged.exclusions.filter(e => e.toLowerCase() !== merged.gemstone.toLowerCase());
    }
    if (merged.matchedGemstones && merged.matchedGemstones.length > 0) {
        const matchedSet = new Set(merged.matchedGemstones.map(g => g.toLowerCase()));
        merged.exclusions = merged.exclusions.filter(e => !matchedSet.has(e.toLowerCase()));
    }

    // B. If exclusions were explicitly specified in the current turn, clear matching selected gemstones.
    if (parsed.exclusions && parsed.exclusions.length > 0) {
        const parsedExclusionsSet = new Set(parsed.exclusions.map(e => e.toLowerCase()));
        if (merged.gemstone && parsedExclusionsSet.has(merged.gemstone.toLowerCase())) {
            merged.gemstone = null;
        }
        if (merged.matchedGemstones && merged.matchedGemstones.length > 0) {
            merged.matchedGemstones = merged.matchedGemstones.filter(
                g => !parsedExclusionsSet.has(g.toLowerCase())
            );
        }
    }

    // 4. negativeKeywordsToAdd & negativeKeywordsToPrune
    const finalNegatives = new Set(merged.negativeKeywordsToAdd || []);
    if (parsed.negativeKeywordsToAdd) {
        parsed.negativeKeywordsToAdd.forEach(nk => finalNegatives.add(nk));
    }
    if (parsed.negativeKeywordsToPrune) {
        parsed.negativeKeywordsToPrune.forEach(nk => finalNegatives.delete(nk));
    }
    merged.negativeKeywordsToAdd = Array.from(finalNegatives);
    merged.negativeKeywordsToPrune = parsed.negativeKeywordsToPrune || [];

    // 5. visualSplits
    merged.visualSplits = {
        ...(merged.visualSplits || {}),
        ...(parsed.visualSplits || {})
    };

    // Keep resetContext and broadIntent from the current turn
    merged.resetContext = parsed.resetContext;
    merged.broadIntent = parsed.broadIntent;

    return merged;
}
