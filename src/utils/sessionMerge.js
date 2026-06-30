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

    // Boolean or single fields: overwrite only if parsed value is not null and not empty
    const singleFields = [
        'category', 'subCategory', 'gemstone', 'motif', 'occasion',
        'product_type', 'jewellery_type', 'purity', 'metalColor',
        'minPrice', 'maxPrice', 'minDiamondCarat', 'sortBy', 'customLimit', 'gender'
    ];

    singleFields.forEach(field => {
        if (parsed[field] !== null && parsed[field] !== undefined && parsed[field] !== '') {
            // Category Shift Protection:
            // If a new category is specified, and it's different from the existing one,
            // we MUST clear category-specific fields from the existing context (like subCategory and jewellery_type)
            // to avoid mismatched constraints (e.g. Ring subcategories in Necklaces).
            if (field === 'category' && existing.category && existing.category !== parsed.category) {
                merged.subCategory = null;
                merged.jewellery_type = null;
            }
            merged[field] = parsed[field];
        }
    });

    // Array fields merging:
    // 1. motifs & single motif
    if (parsed.motif) {
        merged.motif = parsed.motif;
        merged.motifs = [...parsed.motifs];
    } else if (existing.motif) {
        merged.motif = existing.motif;
        merged.motifs = [...(existing.motifs || [])];
    }

    // 2. matchedGemstones & single gemstone
    if (parsed.gemstone) {
        merged.gemstone = parsed.gemstone;
        merged.matchedGemstones = [...parsed.matchedGemstones];
    } else if (existing.gemstone) {
        merged.gemstone = existing.gemstone;
        merged.matchedGemstones = [...(existing.matchedGemstones || [])];
    }

    // 3. exclusions
    if (parsed.exclusions && parsed.exclusions.length > 0) {
        merged.exclusions = Array.from(new Set([...(existing.exclusions || []), ...parsed.exclusions]));
    } else {
        merged.exclusions = [...(existing.exclusions || [])];
    }

    // 4. negativeKeywordsToAdd & negativeKeywordsToPrune
    const finalNegatives = new Set(existing.negativeKeywordsToAdd || []);
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
        ...(existing.visualSplits || {}),
        ...(parsed.visualSplits || {})
    };

    // Keep resetContext and broadIntent from the current turn
    merged.resetContext = parsed.resetContext;
    merged.broadIntent = parsed.broadIntent;

    return merged;
}
