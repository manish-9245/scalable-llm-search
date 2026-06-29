import { query } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { generateEmbedding } from '../config/llm.js';

/**
 * Discover slang terms using database exact match or vector similarity search.
 * @param {string} queryText - The term to search for.
 * @returns {Promise<{term: string, meaning: string, similarity: number} | null>}
 */
export const discoverSlang = async (queryText) => {
    try {
        const lowerQuery = queryText.toLowerCase().trim();
        const cacheKey = `slang:${lowerQuery}`;

        // Level 1: Redis Cache
        try {
            if (redisClient.isOpen) {
                const cached = await redisClient.get(cacheKey);
                if (cached) return JSON.parse(cached);
            }
        } catch (e) {}

        const words = lowerQuery.split(/[\s,()]+/).filter(w => w.length > 2);
        
        // 1. Exact match check in database
        if (words.length > 0) {
            const { rows: exactRows } = await query(
                `SELECT term, meaning FROM slang_vectors WHERE LOWER(term) = ANY($1)`,
                [words.map(w => w.toLowerCase())]
            );
            if (exactRows.length > 0) {
                return { ...exactRows[0], similarity: 1.0 };
            }
        }

        // 2. Vector similarity search for fuzzy/regional matches
        const embedding = await generateEmbedding(queryText);
        if (embedding) {
            const embString = '[' + embedding.join(',') + ']';
            const { rows } = await query(
                `SELECT term, meaning, 1 - ((embedding::halfvec(384)) <=> $1::halfvec(384)) AS similarity 
                 FROM slang_vectors 
                 WHERE 1 - ((embedding::halfvec(384)) <=> $1::halfvec(384)) > 0.85
                 ORDER BY similarity DESC LIMIT 1`,
                [embString]
            );

            const result = rows.length > 0 ? rows[0] : null;
            
            // Cache the result
            try {
                if (redisClient.isOpen) {
                    await redisClient.setEx(cacheKey, 86400, JSON.stringify(result));
                }
            } catch (e) {}

            return result;
        }
    } catch (e) {
        console.error("[SLANG_DB_ERROR] Slang discovery failed:", e.message);
    }
    return null;
};

/**
 * Automatically learn new slang/traditional terms from AI analysis results.
 */
export const learnSlangFromAnalysis = async (variations, category) => {
    if (!Array.isArray(variations) || variations.length === 0 || !category) return;

    try {
        for (const term of variations) {
            const cleanTerm = term.trim().toLowerCase();
            if (cleanTerm.length < 3) continue;

            const { rows } = await query('SELECT term FROM slang_vectors WHERE term = $1', [cleanTerm]);
            if (rows.length === 0) {
                console.log(`[SLANG_LEARNING] New term discovered: ${cleanTerm} -> ${category}`);
                const embedding = await generateEmbedding(cleanTerm);
                if (embedding) {
                    const embString = '[' + embedding.join(',') + ']';
                    await query(
                        'INSERT INTO slang_vectors (term, meaning, embedding) VALUES ($1, $2, $3)',
                        [cleanTerm, category, embString]
                    );
                }
            }
        }
    } catch (e) {
        console.error("[SLANG_LEARNING_ERROR]", e.message);
    }
};
