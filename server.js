import Fastify from 'fastify';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import crypto from 'crypto';

import { query } from './src/config/db.js';
import { connectRedis, redisClient } from './src/config/redis.js';
import { transcribeAudio, generateEmbedding } from './src/config/llm.js';
import { searchCatalogue, getLatestMetalRates, repairImageUrls } from './src/services/searchService.js';
import { indriyaAnalyzer, chatAgent } from './src/mastra/agent.js';
import { DB_SCHEMA, loadSchema, OFFICIAL_CATEGORIES, normalizeProductData, startDiscoveryCron } from './src/services/discoveryService.js';
import { generateObject, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { queueProductIngestion, startIngestionWorker } from './src/config/queue.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'development' ? 'debug' : 'info'
  }
});

// 1. Health Check Endpoint (Highest Priority)
fastify.get('/health', async () => {
  return { status: 'ALIVE', uptime: process.uptime() };
});

// Register plugins WITHOUT await (listen will wait for them)
fastify.register(fastifyMultipart, {
  limits: { fileSize: 15 * 1024 * 1024 }
});

const publicPath = path.resolve(__dirname, './public');
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });

fastify.register(fastifyStatic, {
  root: publicPath,
  prefix: '/'
});

// Background Tasks
connectRedis();
startDiscoveryCron();
startIngestionWorker();

/**
 * Helper: Clear all search and product list caches using SCAN (production-safe)
 */
async function invalidateSearchCache() {
  try {
    if (redisClient.isOpen) {
      let cursor = 0;
      let count = 0;
      do {
        const reply = await redisClient.scan(cursor, { MATCH: 'search:*', COUNT: 100 });
        cursor = reply.cursor;
        const keys = reply.keys;
        if (keys.length > 0) {
          await redisClient.del(keys);
          count += keys.length;
        }
      } while (cursor !== 0);
      
      // Also clear product list caches
      cursor = 0;
      do {
        const reply = await redisClient.scan(cursor, { MATCH: 'products:*', COUNT: 100 });
        cursor = reply.cursor;
        const keys = reply.keys;
        if (keys.length > 0) {
          await redisClient.del(keys);
          count += keys.length;
        }
      } while (cursor !== 0);

      console.log(`[CACHE] Invalidation: ${count} keys purged.`);
    }
  } catch (err) {
    console.warn('⚡ [CACHE] Read Error:', err.message);
  }
}

/**
 * Endpoint: Multi-Strategy Search Coordinator.
 */
fastify.get('/api/search', async (request, reply) => {
  const start = Date.now();
  const { q, limit = 12 } = request.query;
  if (!q) return reply.status(400).send({ error: 'Missing search query parameter "q"' });

  const cacheKey = `search:${crypto.createHash('md5').update(`${q}:${limit}`).digest('hex')}`;
  
  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        console.log(`[SEARCH:HIT] "${q}" retrieved from cache in ${Date.now() - start}ms`);
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    console.warn('[CACHE:ERROR]', err.message);
  }

  console.log(`[SEARCH:MISS] "${q}" executing hybrid engine...`);

  try {
    const results = await searchCatalogue({
      queryText: q,
      limit: parseInt(limit, 10)
    });

    const duration = Date.now() - start;
    console.log(`[SEARCH:OK] "${q}" → ${results.products?.length || 0} items [${duration}ms]`);

    const finalResult = {
      products: results.products,
      latencyMs: duration,
      queryText: q
    };

    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResult));
    }

    return finalResult;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Search failed' });
  }
});

/**
 * Endpoint: Get Server Configuration
 * Allows frontend to detect if running in Pure Local or AI Mode.
 */
fastify.get('/api/config', async (request, reply) => {
  return { 
    useLocalOnly: process.env.USE_LOCAL_ONLY === 'true' || !process.env.GEMINI_API_KEY,
    engine: 'Indriya Hybrid Local v1.0',
    embeddingModel: 'Xenova/all-MiniLM-L6-v2 (Local)'
  };
});

/**
 * Endpoint: Local Speech-to-Text (Transcribe Audio).
 * Accepts recorded 16kHz mono WAV speech buffer and processes it natively
 * on CPU using local WASM Whisper models. Zero API fees.
 */
fastify.post('/api/transcribe', async (request, reply) => {
  const data = await request.file();
  if (!data || !data.file) {
    return reply.status(400).send({ error: 'WAV audio file attachment required' });
  }

  try {
    const rawBuffer = await data.toBuffer();
    const transcribedText = await transcribeAudio(rawBuffer);
    return { query: transcribedText };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ 
      error: 'Local Speech-to-Text translation failed', 
      details: err.message 
    });
  }
});

/**
 * Endpoint: Get Latest Dynamic Metal Rates.
 * Retrievable by clients to render instant real-time dynamic pricing.
 */
fastify.get('/api/rates', async (request, reply) => {
  try {
    const rates = await getLatestMetalRates();
    return { rates };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch dynamic metal rates' });
  }
});

/**
 * Endpoint: Update Daily Metal Rates (Admin/Sales Associate portal).
 * Updates active rates in database and flushes Redis cache keys for instant updates.
 */
fastify.post('/api/rates', async (request, reply) => {
  const { metal_type, rate_per_gram } = request.body || {};
  if (!metal_type || !rate_per_gram) {
    return reply.status(400).send({ error: 'metal_type and rate_per_gram are required' });
  }

  try {
    await query(`
      INSERT INTO daily_metal_rates (record_date, metal_type, rate_per_gram)
      VALUES (CURRENT_DATE, $1, $2)
      ON CONFLICT (record_date, metal_type)
      DO UPDATE SET rate_per_gram = EXCLUDED.rate_per_gram
    `, [metal_type, parseFloat(rate_per_gram)]);

    async function loadLiveRates() {
      // Rate display removed from UI
    }

    function updateHeaderRatesDisplay() {
      // Rate display removed from UI
    }

    // Clear Redis cached rates and search results
    await redisClient.del('latest_metal_rates');
    await invalidateSearchCache();

    const freshRates = await getLatestMetalRates();
    return { success: true, rates: freshRates };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Rates update database operation failed' });
  }
});

/**
 * Endpoint: Proxy Image CDN requests to bypass 403 Forbidden / CORS issues
 */
fastify.get('/api/proxy-image', async (request, reply) => {
  const { url } = request.query;
  if (!url) return reply.status(400).send({ error: 'Missing image URL' });
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Referer': 'https://s7ap1.scene7.com/',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!response.ok) {
      return reply.status(response.status).send({ error: `Upstream returned ${response.status}` });
    }

    const buffer = await response.arrayBuffer();
    reply.type(response.headers.get('content-type') || 'image/jpeg');
    return reply.send(Buffer.from(buffer));
  } catch (err) {
    fastify.log.error('Proxy image failed:', err.message);
    return reply.status(500).send({ error: err.message });
  }
});

/**
 * Endpoint: One-time Ingestion visual spec analyzer.
 * Triggers background Mastra agent using Google Gemini 2.5 Flash to extract specifications and generate summaries.
 */
/**
 * Endpoint: Non-blocking Event-Driven Ingestion.
 * Offloads heavy AI analysis and embedding to a background worker.
 */
fastify.post('/api/ingest', async (request, reply) => {
  const { sku, name, category, specs } = request.body || {};
  if (!sku || !name || !category) {
    return reply.status(400).send({ error: 'sku, name, and category are required' });
  }

  try {
    // Check if product exists first
    const prodCheck = await query(`SELECT id FROM catalog_products WHERE sku = $1`, [sku]);
    if (prodCheck.rows.length === 0) {
      return reply.status(404).send({ error: `Product with SKU ${sku} not found. Please seed the product first.` });
    }

    // Push to background queue
    const jobId = await queueProductIngestion({ sku, name, category, specs });

    return {
      success: true,
      message: 'Product analysis queued for background processing.',
      sku,
      jobId
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ 
      error: 'Failed to queue product ingestion', 
      details: err.message 
    });
  }
});

/**
 * Endpoint: Refine AI Analysis
 * Allows users to provide feedback and refine the generated analysis.
 */
fastify.post('/api/refine-analysis', async (request, reply) => {
  const { sku, currentDescription, feedback } = request.body || {};
  if (!sku || !currentDescription || !feedback) {
    return reply.status(400).send({ error: 'sku, currentDescription, and feedback are required' });
  }

  try {
    // Fetch visual context for refinement
    const prodRes = await query(`SELECT image_urls, name, category FROM catalog_products WHERE sku = $1`, [sku]);
    const { image_urls, name, category } = prodRes.rows[0] || { image_urls: [], name: '', category: '' };
    const imageUrl = image_urls[0];

    const prompt = `
      You are an expert jewellery evaluator for Indriya. 
      The current analysis of the item is:
      "${currentDescription}"
      
      The user provided the following refinement instructions:
      "${feedback}"
      
      Please provide an updated, highly professional description incorporating these instructions.
      
      CRITICAL: You MUST output ONLY a valid JSON object following the Indriya Dossier Schema. No Markdown, no conversational text.
    `;

    const content = [{ type: 'text', text: prompt }];

    if (imageUrl) {
      try {
        const imgRes = await fetch(imageUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          content.push({
            type: 'image',
            image: Buffer.from(buffer),
            mimeType: imgRes.headers.get('content-type') || 'image/jpeg'
          });
        }
      } catch (e) {}
    }

    const result = await indriyaAnalyzer.generate(content.length > 1 ? [{ role: 'user', content }] : prompt);
    let newDescription = result?.text || '';

    // Robust JSON extraction: Strip markdown code blocks if present
    if (newDescription.includes('```')) {
      newDescription = newDescription.replace(/```json\n?|```/g, '').trim();
    }

    // Attempt to parse to verify validity
    try {
      JSON.parse(newDescription);
    } catch (parseErr) {
      fastify.log.warn(`AI output for ${sku} (refine) was not valid JSON, attempting a simple fix...`);
      const startIdx = newDescription.indexOf('{');
      const endIdx = newDescription.lastIndexOf('}');
      if (startIdx !== -1 && endIdx !== -1) {
        newDescription = newDescription.substring(startIdx, endIdx + 1);
      }
    }

    // We must fetch name and category to regenerate embedding properly (re-using prodRes)
    // Generate context embedding so it becomes part of query search
    const embedText = `${name} ${category} ${newDescription}`;
    const embedding = await generateEmbedding(embedText);
    const embeddingStr = embedding ? `[${embedding.join(',')}]` : null;

    if (embeddingStr) {
      await query(`
        UPDATE catalog_products 
        SET ai_description = $1,
            embedding = $2::halfvec
        WHERE sku = $3
      `, [newDescription, embeddingStr, sku]);
      
      await invalidateSearchCache();
    } else {
      await query(`
        UPDATE catalog_products 
        SET ai_description = $1 
        WHERE sku = $2
      `, [newDescription, sku]);
    }

    return { success: true, sku, analysis: newDescription };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to refine analysis', details: err.message });
  }
});

/**
 * Endpoint: Fetch products for Analysis Tab.
 * Supports paginated queries with global search, status filtering, and sorting.
 */
fastify.get('/api/products', async (request, reply) => {
  const { page = 1, limit = 25, search = '', sort = 'default', filter = 'all' } = request.query || {};

  const cacheKey = `products:${crypto.createHash('md5').update(`${page}:${limit}:${search}:${sort}:${filter}`).digest('hex')}`;

  try {
    // 1. Check Cache
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 25;
    const offsetNum = (pageNum - 1) * limitNum;

    let whereClauses = [];
    let queryParams = [];

    if (search && search.trim() !== '') {
      queryParams.push(`%${search.trim()}%`);
      whereClauses.push(`(sku ILIKE $${queryParams.length} OR name ILIKE $${queryParams.length})`);
    }

    if (filter === 'analyzed') {
      whereClauses.push(`(ai_description IS NOT NULL AND ai_description != '')`);
    } else if (filter === 'pending') {
      whereClauses.push(`(ai_description IS NULL OR ai_description = '')`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    let orderBySql = 'ORDER BY id ASC';
    if (sort === 'az') orderBySql = 'ORDER BY name ASC, id ASC';
    else if (sort === 'sku') orderBySql = 'ORDER BY sku ASC, id ASC';
    else if (sort === 'analyzed_first') orderBySql = 'ORDER BY (CASE WHEN ai_description IS NOT NULL AND ai_description != \'\' THEN 0 ELSE 1 END) ASC, id ASC';
    else if (sort === 'pending_first') orderBySql = 'ORDER BY (CASE WHEN ai_description IS NOT NULL AND ai_description != \'\' THEN 1 ELSE 0 END) ASC, id ASC';

    const countRes = await query(`SELECT COUNT(*) as total FROM catalog_products ${whereSql}`, queryParams);
    const total = parseInt(countRes.rows[0]?.total || 0, 10);

    queryParams.push(limitNum);
    const limitParamIndex = queryParams.length;
    queryParams.push(offsetNum);
    const offsetParamIndex = queryParams.length;

    const productsQuery = `
      SELECT id, sku, name, image_urls, 
             json_build_object(
               'gold_weight_numeric', gold_weight_numeric,
               'purity', purity,
               'platinum_weight_numeric', platinum_weight_numeric,
               'silver_weight_numeric', silver_weight_numeric,
               'diamond_weight_numeric', diamond_weight_numeric,
               'diamond_clarity', diamond_clarity,
               'diamond_color', diamond_color,
               'gemstone_weight_numeric', gemstone_weight_numeric,
               'gemstone_type', gemstone_type,
               'category', category,
               'sub_category', sub_category,
               'collection', collection,
               'gender', gender,
               'occasion', occasion,
               'design_theme', design_theme,
               'description', description
             ) as product_specifications,
             CASE WHEN ai_description IS NOT NULL AND ai_description != '' THEN true ELSE false END as is_analyzed,
             ai_description
      FROM catalog_products 
      ${whereSql}
      ${orderBySql}
      LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
    `;

    const res = await query(productsQuery, queryParams);
    const products = res.rows.map(p => ({ ...p, image_urls: repairImageUrls(p.image_urls) }));

    const responseData = { 
      products, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) 
    };

    // Cache for 10 minutes
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 600, JSON.stringify(responseData));
    }

    return responseData;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch products', details: err.message });
  }
});

/**
 * Endpoint: Create a new Chat Session
 * Initialize dynamic chat session optionally mapped to user_id.
 */
fastify.post('/api/chat/session', async (request, reply) => {
  const { user_id, title } = request.body || {};
  try {
    const res = await query(`
      INSERT INTO chat_sessions (user_id, title) 
      VALUES ($1, $2) RETURNING id, title, created_at
    `, [user_id || null, title || 'New Search Session']);
    return res.rows[0];
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to create chat session' });
  }
});

/**
 * Endpoint: List Chat Sessions
 * Fetch all sessions for a user.
 */
fastify.get('/api/chat/sessions', async (request, reply) => {
  try {
    // Assuming single local user for now, or fetch all sessions ordered by latest
    const res = await query(`
      SELECT id, title, created_at 
      FROM chat_sessions 
      ORDER BY created_at DESC 
      LIMIT 50
    `);
    return res.rows;
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to list chat sessions' });
  }
});

/**
 * Endpoint: Fetch Chat Session History
 * Fetch chronological query logs.
 */
fastify.get('/api/chat/session/:id', async (request, reply) => {
  const { id } = request.params;
  try {
    const sessionRes = await query(`SELECT * FROM chat_sessions WHERE id = $1`, [id]);
    if (sessionRes.rows.length === 0) {
      return reply.status(404).send({ error: 'Session not found' });
    }
    const messagesRes = await query(`
      SELECT id, sender, text, products, tool_params, created_at 
      FROM chat_messages 
      WHERE session_id = $1 
      ORDER BY created_at ASC
    `, [id]);
    return {
      session: sessionRes.rows[0],
      messages: messagesRes.rows
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Failed to fetch chat session' });
  }
});

/**
 * Helper: Normalize price shorthands (e.g. "under 2L" -> "under 200000")
 */
function normalizePriceShorthand(query) {
  if (!query) return query;
  let normalized = query.toLowerCase();
  // Resolve "X.Y L" or "X.Y Lakh"
  normalized = normalized.replace(/\b(\d+(?:\.\d+)?)\s*(?:l|lakhs?|lac|lacs)\b/gi, (match, num) => {
    return Math.round(parseFloat(num) * 100000).toString();
  });
  // Resolve "X K" or "Xk"
  normalized = normalized.replace(/\b(\d+(?:\.\d+)?)\s*(?:k)\b/g, (match, num) => {
    return Math.round(parseFloat(num) * 1000).toString();
  });
  return normalized;
}

/**
 * Endpoint: Send Chat Message
 * Advanced Agentic Flow: Tool Execution -> Hallucination Audit -> Corrected Response.
 */
fastify.post('/api/chat/message', async (request, reply) => {
  const { session_id, text: rawText, language = 'en-IN' } = request.body || {};
  if (!session_id || !rawText) {
    return reply.status(400).send({ error: 'session_id and text are required' });
  }

  const langMap = { 
    'en-IN': 'English', 'hi-IN': 'Hindi', 'ta-IN': 'Tamil', 'te-IN': 'Telugu', 
    'kn-IN': 'Kannada', 'ml-IN': 'Malayalam', 'mr-IN': 'Marathi', 'bn-IN': 'Bengali', 'gu-IN': 'Gujarati' 
  };
  const langName = langMap[language] || 'English';
  const text = normalizePriceShorthand(rawText);

  try {
    // 1. Write the User Message
    await query(`INSERT INTO chat_messages (session_id, sender, text) VALUES ($1, 'user', $2)`, [session_id, text]);

    // 2. Determine Execution Path (Open Source LLM vs Local Engine)
    let aiText = "";
    let products = [];
    let lastToolParams = null;
    let agentExecutionSuccess = false;

    try {
      console.log(`[OS_SEARCH] Attempting agentic search via local LLM...`);
      const prompt = `[Language: ${langName}]\nUser Query: ${text}`;
      const result = await chatAgent.generate(prompt);
      
      aiText = result?.text || "I'm looking into that for you...";

      // Extract tool results
      if (result.toolResults) {
        const dbToolRes = result.toolResults.find(r => r.toolName === 'queryDatabase');
        if (dbToolRes && dbToolRes.result) {
          products = dbToolRes.result.results || [];
          lastToolParams = dbToolRes.args || dbToolRes.input;
        }
      }
      agentExecutionSuccess = true;
    } catch (agentErr) {
      console.warn(`[AGENT_FAIL] Local LLM (Ollama) failed or not running: ${agentErr.message}`);
      console.log(`[FALLBACK] Using deterministic local engine...`);
      
      const { searchCatalogue } = await import('./src/services/searchService.js');
      const searchRes = await searchCatalogue({ queryText: text });
      products = searchRes.products || [];
      lastToolParams = searchRes.parsedFilters || {};
      
      const count = products.length;
      if (count > 0) {
        aiText = `I found ${count} exquisite items for you. Here are the top selections from our local inventory.`;
      } else {
        aiText = `I couldn't find any items matching your request in our current local inventory.`;
      }
    }

    // 4. [ELITE PARITY] Audit Layer (Only if using AI and key exists)
    if (agentExecutionSuccess && process.env.GEMINI_API_KEY) {
    const google = createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY });
    try {
      const { object: audit } = await generateObject({
        model: google('gemini-2.5-flash'),
        schema: z.object({
          isAccurate: z.boolean(),
          hallucinationDetected: z.boolean()
        }),
        prompt: `
          User Query: "${text}"
          Actual Products Found: ${products.length} (Samples: ${JSON.stringify(products.slice(0, 2).map(p => p.name))})
          AI Statement: "${aiText}"
          
          Rule: If AI says it found items but count is 0, or mentions a product NOT in the sample, isAccurate = false.
        `
      });

      if (!audit.isAccurate) {
        console.warn(`[AUDIT] Hallucination detected for session ${session_id}. Correcting...`);
        const { text: correction } = await generateText({
          model: google('gemini-2.5-flash'),
          prompt: `The AI incorrectly described inventory. User asked "${text}". We found ${products.length} matches. Write a 1-sentence elegant correction.`
        });
        if (correction) aiText = correction.trim();
      }
    } catch (auditErr) {
      console.error('Audit layer failed, falling back to original AI text');
    }
    }

    // 5. Save AI response and products
    const productsJson = JSON.stringify(products);
    const toolParamsJson = lastToolParams ? JSON.stringify(lastToolParams) : null;

    const res = await query(`
      INSERT INTO chat_messages (session_id, sender, text, products, tool_params) 
      VALUES ($1, 'ai', $2, $3::jsonb, $4::jsonb) RETURNING *
    `, [session_id, aiText, productsJson, toolParamsJson]);

    return {
      success: true,
      message: res.rows[0],
      searchResult: { products, parsedFilters: lastToolParams }
    };
  } catch (err) {
    fastify.log.error(err);
    return reply.status(500).send({ error: 'Agentic chat execution failed', details: err.message });
  }
});

// Fallback path: All unknown URLs redirect to serve SPA Single Page Application
fastify.setNotFoundHandler(async (request, reply) => {
  return reply.sendFile('index.html');
});

// Bind and boot
const port = process.env.PORT || 3000;
try {
  console.log(`[BOOT] Attempting to listen on port ${port}...`);
  await fastify.listen({ port, host: '0.0.0.0' });
  console.log(`\n==========================================================`);
  console.log(`INDRIYA GATEWAYS ONLINE AT: http://localhost:${port}`);
  console.log(`==========================================================\n`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
