import { query } from '../config/db.js';
import { generateEmbedding } from '../config/llm.js';
import { indriyaAnalyzer } from '../mastra/agent.js';
import { normalizeProductData } from './discoveryService.js';
import { redisClient } from '../config/redis.js';
import { log as globalLog } from '../utils/logger.js';

/**
 * The core logic for analyzing a product, generating embeddings, 
 * updating the DB, and normalizing data. 
 * This is designed to run in a background worker.
 */
export async function processProductAnalysis({ sku, name, category, specs, traceId }, logger = globalLog) {
  logger.info(`[INGESTION] Starting analysis for SKU: ${sku}`, { sku, traceId });

  try {
    // 1. Fetch existing data (if any) to assist multimodal analysis
    const prodRes = await query(`SELECT id, image_urls, description FROM catalog_products WHERE sku = $1`, [sku]);
    if (prodRes.rows.length === 0) {
        throw new Error(`Product with SKU ${sku} not found in database. Seed it first.`);
    }

    const { id, image_urls, description } = prodRes.rows[0];
    const imageUrl = image_urls[0];

    // 2. Prepare Prompt for Indriya Analyzer
    const prompt = `
      Perform professional visual and spec-driven analysis for the following Indriya catalogue item.
      
      CRITICAL: You MUST output ONLY a valid JSON object. No Markdown, no conversational text.
      
      SKU: ${sku}
      Name: ${name}
      Category: ${category}
      Description: ${description || 'No description provided'}
      Specifications: ${JSON.stringify(specs || {})}
    `;

    const content = [{ type: 'text', text: prompt }];
    
    // 3. Multimodal Analysis (Optional Visual Input)
    if (imageUrl) {
      try {
        logger.debug(`[INGESTION] Fetching image asset for SKU: ${sku}`, { imageUrl });
        const imgRes = await fetch(imageUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          content.push({
            type: 'image',
            image: Buffer.from(buffer),
            mimeType: imgRes.headers.get('content-type') || 'image/jpeg'
          });
        }
      } catch (imgErr) {
        logger.warn(`[INGESTION] Image fetch failed for ${sku}`, { error: imgErr.message });
      }
    }

    // 4. Run AI Analysis
    logger.info(`[INGESTION] Calling IndriyaAnalyzer Agent for SKU: ${sku}`);
    const result = await indriyaAnalyzer.generate(content.length > 1 ? [{ role: 'user', content }] : prompt);
    let aiDescription = result?.text || '';

    // 5. Clean AI Output (JSON Extraction)
    if (aiDescription.includes('```')) {
      aiDescription = aiDescription.replace(/```json\n?|```/g, '').trim();
    }
    const startIdx = aiDescription.indexOf('{');
    const endIdx = aiDescription.lastIndexOf('}');
    if (startIdx !== -1 && endIdx !== -1) {
      aiDescription = aiDescription.substring(startIdx, endIdx + 1);
    }

    // Validate JSON
    JSON.parse(aiDescription);

    // 6. Generate Vector Embeddings
    logger.info(`[INGESTION] Generating local embeddings for SKU: ${sku}`);
    const embedText = `${name} ${category} ${aiDescription}`;
    const embedding = await generateEmbedding(embedText);
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

    if (!embeddingStr) throw new Error("Failed to generate vector embedding.");

    // 7. Update Master Product Record
    await query(`
      UPDATE catalog_products 
      SET ai_description = $1,
          embedding = $2::halfvec
      WHERE id = $3
    `, [aiDescription, embeddingStr, id]);

    // 8. Invalidate Caches (Broadcast change)
    await invalidateLocalSearchCache(logger);

    // 9. Structured Normalization (Atomic sub-table updates)
    logger.info(`[INGESTION] Normalizing data for SKU: ${sku}`);
    await normalizeProductData(id, aiDescription);

    // 10. Regional Slang Learning
    try {
        const data = JSON.parse(aiDescription);
        const variations = (data.identification || data.jewellery_identification)?.traditional_name_variations || [];
        const primaryCategory = (data.identification || data.jewellery_identification)?.indian_category_name || category;
        if (variations.length > 0) {
            const { learnSlangFromAnalysis } = await import('../utils/slang.js');
            await learnSlangFromAnalysis(variations, primaryCategory);
        }
    } catch (e) {
        logger.warn(`[INGESTION] Slang learning failed for ${sku}`, { error: e.message });
    }

    logger.info(`[INGESTION] SUCCESS: SKU ${sku} is now fully indexed and analyzed.`);
    return true;

  } catch (error) {
    logger.error(`[INGESTION] FAILED for SKU ${sku}`, { error: error.message });
    throw error;
  }
}

/**
 * Helper: Clear search and product list caches in Redis
 */
async function invalidateLocalSearchCache(logger = globalLog) {
    try {
        if (redisClient.isOpen) {
            let cursor = 0;
            do {
                const reply = await redisClient.scan(cursor, { MATCH: 'search:*', COUNT: 100 });
                cursor = reply.cursor;
                if (reply.keys.length > 0) await redisClient.del(reply.keys);
            } while (cursor !== 0);
        }
    } catch (err) {
        logger.warn('⚡ [INGESTION] Cache Invalidation failed', { error: err.message });
    }
}
