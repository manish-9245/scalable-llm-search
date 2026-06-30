import { discoverSlang } from './slang.js';
import { DB_SCHEMA, OFFICIAL_CATEGORIES, loadSchema } from '../services/discoveryService.js';

/**
 * Robustly resolves a search term into its components (category, material, motif)
 * using Vector Search (slang_vectors), DB Schema, and Word Boundary Heuristics.
 */
export async function resolveTerminology(query, existingFilters = {}) {
    await loadSchema();
    const lowerQuery = query.toLowerCase();
    const result = {
        category: null,
        subCategory: null,
        gemstone: null,
        motif: null,
        motifs: [],
        occasion: null,
        product_type: null,
        jewellery_type: null,
        purity: null,
        metalColor: null,
        visualSplits: {},
        minPrice: null,
        maxPrice: null,
        minDiamondCarat: null,
        exclusions: [],
        matchedGemstones: [],
        broadIntent: false,
        resetContext: false,
        negativeKeywordsToPrune: [],
        negativeKeywordsToAdd: [],
        sortBy: null,
        customLimit: null
    };

    // --- Sort By & Custom Limit Parsing ---
    if (/\b(?:most\s+expensive|highest\s+price|price\s+high\s+to\s+low|highest\s+to\s+lowest|costliest)\b/i.test(lowerQuery)) {
        result.sortBy = 'price_desc';
    } else if (/\b(?:cheapest|lowest\s+price|price\s+low\s+to\s+high|lowest\s+to\s+highest|affordable)\b/i.test(lowerQuery)) {
        result.sortBy = 'price_asc';
    } else if (/\b(?:heavy\s+weight|heaviest|weight\s+high\s+to\s+low)\b/i.test(lowerQuery)) {
        result.sortBy = 'weight_desc';
    } else if (/\b(?:light\s+weight|lightest|weight\s+low\s+to\s+high)\b/i.test(lowerQuery)) {
        result.sortBy = 'weight_asc';
    }

    const limitMatch = lowerQuery.match(/\b(?:top|first)\s+(\d+)\b/i);
    if (limitMatch) {
        result.customLimit = parseInt(limitMatch[1], 10);
    }


    // --- Price Boundary Parsing ---
    const pricePatterns = [
        { regex: /\b(?:under|below|less than|up to|within|max)\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakhs?|lakh|k|thousand)?/i, type: 'max' },
        { regex: /\b(?:above|over|more than|starting from|min)\s+(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakhs?|lakh|k|thousand)?/i, type: 'min' },
        { regex: /(?:rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakhs?|lakh|k|thousand)\b/i, type: 'generic' }
    ];

    const parseValue = (val, unit) => {
        let num = parseFloat(val);
        if (unit) {
            const u = unit.toLowerCase();
            if (u.includes('lakh')) num *= 100000;
            else if (u === 'k' || u.includes('thousand')) num *= 1000;
        }
        return num;
    };

    pricePatterns.forEach(p => {
        const matches = [...lowerQuery.matchAll(new RegExp(p.regex, 'gi'))];
        matches.forEach(match => {
            const val = parseValue(match[1], match[2]);
            if (p.type === 'max') result.maxPrice = val;
            else if (p.type === 'min') result.minPrice = val;
            else if (p.type === 'generic') {
                if (lowerQuery.includes('under') || lowerQuery.includes('below') || lowerQuery.includes('within')) {
                    result.maxPrice = val;
                } else if (lowerQuery.includes('above') || lowerQuery.includes('over') || lowerQuery.includes('starting')) {
                    result.minPrice = val;
                }
            }
        });
    });

    // Handle "between 2 and 4 lakhs" specifically
    const rangeMatch = lowerQuery.match(/\b(?:between|from)\s+(\d+(?:\.\d+)?)\s*(?:and|to)\s+(\d+(?:\.\d+)?)\s*(lakhs?|lakh|k|thousand)?/i);
    if (rangeMatch) {
        result.minPrice = parseValue(rangeMatch[1], rangeMatch[3]);
        result.maxPrice = parseValue(rangeMatch[2], rangeMatch[3]);
    }

    // Special case for "1.5 lakhs" without explicit under/above
    const LakhMatch = lowerQuery.match(/(\d+(?:\.\d+)?)\s*lakhs?/i);
    if (LakhMatch && !result.minPrice && !result.maxPrice) {
        result.maxPrice = parseFloat(LakhMatch[1]) * 100000;
    }
    const kMatch = lowerQuery.match(/(\d+(?:\.\d+)?)\s*k\b/i);
    if (kMatch && !result.minPrice && !result.maxPrice) {
        result.maxPrice = parseFloat(kMatch[1]) * 1000;
    }

    const ontology = DB_SCHEMA.ontology || {};

    // Check for negations first (e.g. "non-diamond", "no pearls", "do not need diamond")
    const isNegated = (term) => {
        const lowTerm = term.toLowerCase();
        const regex = new RegExp(`\\b(non|no|without|not|dont|don't|avoid|except|excluding|exclude|less|free of|never|stop)\\b(?:\\s+\\w+){0,3}?\\s*-?\\s*${lowTerm}s?\\b`, 'i');
        return regex.test(lowerQuery);
    };

    // Category Resolution (DB Schema + Ontology)
    const catsToCheck = new Set([...(OFFICIAL_CATEGORIES || []), ...Object.keys(ontology.category || {})]);
    catsToCheck.forEach(c => {
        if (new RegExp(`\\b${c}s?\\b`, 'i').test(lowerQuery)) {
            const target = ontology.category?.[c.toLowerCase()] || c;
            if (!result.category) result.category = target;
        }
    });

    // Sub-category / Jewellery Type Resolution
    const typesToCheck = new Set([...Object.keys(ontology.jewellery_type || {}), ...Object.keys(ontology.sub_category || {})]);
    typesToCheck.forEach(t => {
        if (new RegExp(`\\b${t}s?\\b`, 'i').test(lowerQuery)) {
            const target = ontology.jewellery_type?.[t.toLowerCase()] || ontology.sub_category?.[t.toLowerCase()] || t;
            if (!result.subCategory) result.subCategory = target;
        }
    });

    // Gemstone Resolution (DB Schema + Ontology)
    const gemsToCheck = new Set([...(DB_SCHEMA.gemstones || []), ...Object.keys(ontology.gemstone || {})]);
    gemsToCheck.forEach(g => {
        if (new RegExp(`\\b${g}s?\\b`, 'i').test(lowerQuery)) {
            const target = ontology.gemstone?.[g.toLowerCase()] || g;
            if (isNegated(g)) {
                result.negativeKeywordsToAdd.push(target.toLowerCase());
                result.exclusions.push(target.toLowerCase());
            } else {
                if (!result.gemstone) result.gemstone = target;
                result.matchedGemstones.push(target.toLowerCase());
            }
        }
    });

    // Motif Resolution (Multiple)
    if (DB_SCHEMA.motifs) {
        DB_SCHEMA.motifs.forEach(m => {
            if (new RegExp(`\\b${m}s?\\b`, 'i').test(lowerQuery)) {
                if (isNegated(m)) {
                    result.negativeKeywordsToAdd.push(m.toLowerCase());
                } else {
                    if (!result.motif) result.motif = m;
                    if (!result.motifs.includes(m)) result.motifs.push(m);
                }
            }
        });
    }

    // Occasion Resolution (Categorical + Ontology)
    const occasionsToCheck = new Set([
        ...(DB_SCHEMA.categoricalValues?.occasion || []), 
        ...Object.keys(ontology.occasion || {}),
        'wedding', 'festive', 'party', 'engagement', 'bridal', 'daily wear', 'office wear'
    ]);
    occasionsToCheck.forEach(o => {
        if (new RegExp(`\\b${o.replace(/_/g, ' ')}s?\\b`, 'i').test(lowerQuery)) {
            const target = ontology.occasion?.[o.toLowerCase()] || o;
            if (!result.occasion) result.occasion = target;
        }
    });

    // 2. Direct Heuristics from Query (Ontology-driven Word Boundary Match)
    const catMap = ontology.category || {};
    for (const [kw, cat] of Object.entries(catMap)) {
        if (new RegExp(`\\b${kw}s?\\b`, 'i').test(lowerQuery)) {
            // Special Case: "ring" or "rings" should not match "toe ring"
            if ((kw === 'ring' || kw === 'rings') && /\btoe\s+rings?\b/i.test(lowerQuery)) {
                continue; 
            }
            result.category = cat;
            break;
        }
    }

    const typeMap = ontology.jewellery_type || {};
    for (const [kw, type] of Object.entries(typeMap)) {
        if (new RegExp(`\\b${kw}s?\\b`, 'i').test(lowerQuery)) {
            result.jewellery_type = type;
            break;
        }
    }

    // 3. Slang & Regional Inference (Only fill if still null)
    const slangMatch = await discoverSlang(query);
    if (slangMatch) {
        const fullMeaning = slangMatch.meaning.toLowerCase();
        const meanings = slangMatch.meaning.split(/[,|]+/).map(m => m.trim().toLowerCase());
        
        meanings.forEach(m => {
            if (!result.gemstone && DB_SCHEMA.gemstones?.includes(m) && !isNegated(m)) result.gemstone = m;
            if (!result.motif && DB_SCHEMA.motifs?.includes(m) && !isNegated(m)) result.motif = m;
            if (!result.product_type && ['gold', 'diamond', 'platinum', 'silver'].includes(m) && !isNegated(m)) result.product_type = m;
            
            if (!result.jewellery_type) {
                if (/\bstud\b/i.test(m) && lowerQuery.includes('stud')) result.jewellery_type = 'Stud';
                else if (/\bdrop\b/i.test(m) && lowerQuery.includes('drop')) result.jewellery_type = 'Drop';
                else if ((/\bhoop\b/i.test(m) || /\bbali\b/i.test(m)) && (lowerQuery.includes('hoop') || lowerQuery.includes('bali'))) result.jewellery_type = 'Hoop';
                else if (/\bjhumka\b/i.test(m) && lowerQuery.includes('jhumka')) result.jewellery_type = 'Jhumka';
            }
        });

        // --- Improved Categorical Inference ---
        if (!result.category) {
            const mentions = {
                'Earrings': /\bearrings?\b/i.test(fullMeaning),
                'Finger Rings': /\brings?\b/i.test(fullMeaning) && !/\btoe\s+rings?\b/i.test(fullMeaning),
                'Necklaces': /\bnecklaces?\b/i.test(fullMeaning),
                'Pendants': /\bpendants?\b/i.test(fullMeaning),
                'Bangles': /\bbangles?\b/i.test(fullMeaning) || /\bkadas?\b/i.test(fullMeaning),
                'Wedding Accessories': /\btoe\s+rings?\b/i.test(fullMeaning) || /\bbichiya\b/i.test(fullMeaning) || /\bmathapatti\b/i.test(fullMeaning) || /\bmaang\s+tikka\b/i.test(fullMeaning)
            };
            
            const matchedCats = Object.keys(mentions).filter(cat => mentions[cat]);
            if (matchedCats.length === 1) {
                result.category = matchedCats[0];
            }
        }
    }

    // 4. Broad Intent & Reset Detection
    const broadKeywords = ['something', 'anything', 'items', 'products', 'collections', 'show me in', 'show me some'];
    if (broadKeywords.some(kw => lowerQuery.includes(kw))) {
        result.broadIntent = true;
    }

    const resetKeywords = ['only', 'just', 'exclusively', 'strictly'];
    if (resetKeywords.some(kw => new RegExp(`\\b${kw}\\b`, 'i').test(lowerQuery))) {
        result.resetContext = true;
    }

    // 5. Generic Category/Type Conflict Resolution
    const conflictGroups = [
        { 
            terms: ['toe ring', 'bichiya'], 
            conflicts: ['finger ring', 'earring', 'nath', 'tikka', 'waistbelt', 'armlet'],
            label: 'toe_ring_precision'
        },
        {
            terms: ['finger ring', 'ring'],
            negativeTerms: ['toe ring', 'bichiya', 'nose ring', 'nath'],
            conflicts: ['toe ring', 'bichiya', 'nose ring', 'nath'],
            label: 'finger_ring_precision'
        },
        {
            terms: ['nath', 'nose ring', 'nosepin'],
            conflicts: ['finger ring', 'earring', 'tikka'],
            label: 'nose_precision'
        }
    ];

    const strictlyAddedNegatives = [];

    conflictGroups.forEach(group => {
        const isTriggered = group.terms.some(t => new RegExp(`\\b${t}s?\\b`, 'i').test(lowerQuery));
        const isSuppressed = group.negativeTerms?.some(t => new RegExp(`\\b${t}s?\\b`, 'i').test(lowerQuery));

        if (isTriggered && !isSuppressed) {
            group.conflicts.forEach(ex => {
                if (!new RegExp(`\\b${ex}s?\\b`, 'i').test(lowerQuery) && !isNegated(ex)) {
                    if (!result.negativeKeywordsToAdd.includes(ex)) {
                        result.negativeKeywordsToAdd.push(ex);
                        strictlyAddedNegatives.push(ex);
                    }
                }
            });
        }
    });

    // Visual Intent Detection
    if (lowerQuery.includes('mostly gold') || lowerQuery.includes('plain gold')) {
        result.visualSplits.visible_gold_pct = 80;
    } else if (lowerQuery.includes('only gold')) {
        result.visualSplits.visible_gold_pct = 95;
    }

    if (lowerQuery.includes('heavy diamond') || lowerQuery.includes('mostly diamond')) {
        result.visualSplits.visible_diamond_pct = 50;
    }

    console.log(`[TERMINOLOGY] Resolved for "${query}":`, {
        category: result.category,
        subCategory: result.subCategory,
        gemstone: result.gemstone,
        exclusions: result.exclusions,
        minPrice: result.minPrice,
        maxPrice: result.maxPrice
    });

    // 6. Persistence Conflict Resolution
    const allIntendedTerms = [result.gemstone, result.motif, result.product_type, result.category, result.jewellery_type].filter(Boolean);
    if (existingFilters.negativeKeywords) {
        result.negativeKeywordsToPrune = existingFilters.negativeKeywords.filter(nk => {
            const lowerNk = nk.toLowerCase();
            if (strictlyAddedNegatives.includes(lowerNk)) return false;

            const positiveMention = new RegExp(`\\b${lowerNk}s?\\b`, 'i').test(lowerQuery) && !isNegated(lowerNk);
            
            const isConflictingOverlap = conflictGroups.some(g => 
                g.terms.some(t => allIntendedTerms.some(it => it.toLowerCase() === t.toLowerCase())) &&
                g.conflicts.includes(lowerNk)
            );

            if (isConflictingOverlap) return false;

            const directOverlap = allIntendedTerms.some(it => it.toLowerCase().includes(lowerNk) || lowerNk.includes(it.toLowerCase())) ||
                                 positiveMention;
            
            if (directOverlap) return true;
            if ((result.gemstone || result.motif) && lowerNk === 'diamond') return true;

            return false;
        });
    }

    return result;
}

// Backward compatibility aliases
export const parseQuery = resolveTerminology;
export const loadOntologyAndSlang = async () => {
    // Slang and Ontology are now handled dynamically by discoveryService
    return true;
};
