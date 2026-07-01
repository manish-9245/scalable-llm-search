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
import { startRateFetcherCron } from './src/services/rateFetcherService.js';
import { generateObject, generateText } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { z } from 'zod';
import { queueProductIngestion, startIngestionWorker, ingestionQueue } from './src/config/queue.js';
import { log, getChildLogger } from './src/utils/logger.js';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { FastifyAdapter } from '@bull-board/fastify';
import i18next from 'i18next';
import { resources } from './src/config/translations.js';

dotenv.config();



const aiProvider = process.env.GEMINI_API_KEY 
  ? createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY }) 
  : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  disableRequestLogging: true,
});

// 1. Health Check Endpoint (Highest Priority - BEFORE any hooks)
// Using a separate route registration to avoid global hooks for health checks
fastify.get('/health', { logLevel: 'warn' }, async (request, reply) => {
  return { status: 'ALIVE', uptime: process.uptime(), timestamp: new Date().toISOString() };
});

// Trace ID & Request Logging Middleware
fastify.addHook('onRequest', async (request, reply) => {
  try {
    const traceId = request.headers['x-trace-id'] || crypto.randomUUID();
    request.traceId = traceId;
    request.log = getChildLogger(traceId);
    request.log.info({ 
      method: request.method, 
      url: request.url,
      remoteAddress: request.ip 
    }, 'Incoming request');
  } catch (e) {
    console.error('Logging hook failed:', e.message);
  }
});

fastify.addHook('onResponse', async (request, reply) => {
  if (request.log) {
    request.log.info({ 
      statusCode: reply.statusCode, 
      durationMs: reply.elapsedTime 
    }, 'Request completed');
  }
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

// 1.5 BullMQ Dashboard
if (ingestionQueue) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: [new BullMQAdapter(ingestionQueue)],
    serverAdapter,
  });
  serverAdapter.setBasePath('/admin/queues');
  fastify.register(serverAdapter.registerPlugin(), { prefix: '/admin/queues' });
  log.info('BullMQ Dashboard available at /admin/queues');
} else {
  log.warn('BullMQ Queue not initialized. Dashboard disabled.');
}

// Background Tasks
connectRedis();
startDiscoveryCron();
startIngestionWorker();
startRateFetcherCron(invalidateSearchCache);

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

      log.info(`[CACHE] Invalidation: ${count} keys purged.`);
    }
  } catch (err) {
    log.error('⚡ [CACHE] Read Error', { error: err.message });
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
        request.log.info({ query: q, hit: true }, 'Search cache hit');
        return JSON.parse(cached);
      }
    }
  } catch (err) {
    request.log.warn('Cache read error', { error: err.message });
  }

  request.log.info({ query: q, hit: false }, 'Search cache miss, executing hybrid engine');

  try {
    const results = await searchCatalogue({
      queryText: q,
      limit: parseInt(limit, 10)
    });

    const duration = Date.now() - start;
    const finalResult = {
      products: results.products,
      latencyMs: duration,
      queryText: q
    };

    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 3600, JSON.stringify(finalResult));
    }

    request.log.info({ 
      query: q, 
      count: results.products?.length || 0,
      duration: duration 
    }, 'Search completed');

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
    const language = request.query.language || 'en-IN';
    const transcribedText = await transcribeAudio(rawBuffer, language);
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

    // Push to background queue with traceId for cross-process tracing
    const jobId = await queueProductIngestion({ 
      sku, name, category, specs,
      traceId: request.traceId 
    });

    request.log.info({ sku, jobId }, 'Product ingestion queued');

    return {
      success: true,
      message: 'Product analysis queued for background processing.',
      sku,
      jobId,
      traceId: request.traceId
    };
  } catch (err) {
    request.log.error('Failed to queue product ingestion', { error: err.message });
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
  const { page = 1, limit = 25, search = '', sort = 'default', filter = 'all', _t, nocache } = request.query || {};

  const cacheKey = `products:${crypto.createHash('md5').update(`${page}:${limit}:${search}:${sort}:${filter}`).digest('hex')}`;
  const useCache = redisClient.isOpen && !_t && !nocache;

  try {
    // 1. Check Cache
    if (useCache) {
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

    // Cache for 10 minutes if caching is active
    if (useCache) {
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
 * Generates an instant, brand-aligned concierge response dynamically in 0.1ms with $0 cost.
 */
/**
 * Generates an instant, brand-aligned concierge response dynamically in 0.1ms with $0 cost.
 * Fully localized and dynamic to avoid any external or local LLM dependencies (such as Gemini or Ollama).
 */
await i18next.init({
  lng: 'en-IN',
  fallbackLng: 'en-IN',
  resources: resources
});

/**
 * Generates an instant, brand-aligned concierge response dynamically in 0.1ms with $0 cost.
 * Fully localized and dynamic using i18next framework to avoid any external or local LLM dependencies (such as Gemini or Ollama).
 */
function generateTemplateResponse(queryText, products, language = 'en-IN') {
  const count = products.length;
  const lowercaseQuery = queryText.toLowerCase().trim();
  
  // Handle greetings
  const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening', 'namaste', 'pranam', 'hey there'];
  if (greetings.some(g => lowercaseQuery === g || lowercaseQuery.startsWith(g + ' '))) {
    return i18next.t('welcome', { lng: language });
  }
  
  if (count === 0) {
    return i18next.t('noResults', { lng: language });
  }
  
  // Format Price in INR Currency format
  const formattedPrice = (p) => {
    const priceToUse = p.calculated_price || p.base_price || p.price || 0;
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR', 
      maximumFractionDigits: 0 
    }).format(priceToUse);
  };

  // Compile specific gemstone, gold and diamond metrics dynamically using i18next
  const getProductDetailsText = (p, lang) => {
    const parts = [];
    const purity = p.purity || '18K';
    
    if (p.gold_weight_numeric || p.gold_weight) {
      const weight = p.gold_weight_numeric || p.gold_weight;
      parts.push(i18next.t('details.gold_weight', { purity, weight, lng: lang }));
    } else {
      parts.push(i18next.t('details.gold', { purity, lng: lang }));
    }

    if (p.diamond_weight_numeric || p.diamond_weight) {
      const weight = p.diamond_weight_numeric || p.diamond_weight;
      parts.push(i18next.t('details.diamonds', { weight, lng: lang }));
    }

    if (p.gemstone_weight_numeric && p.gemstone_weight_numeric > 0) {
      const weight = p.gemstone_weight_numeric;
      parts.push(i18next.t('details.gemstones', { weight, lng: lang }));
    }

    if (parts.length === 0) {
      return p.description || i18next.t('details.fallback', { lng: lang });
    }
    return parts.join(', ');
  };

  const sampleProducts = products.slice(0, 3);
  const highlightsText = sampleProducts.map((p, idx) => {
    const details = getProductDetailsText(p, language);
    const price = formattedPrice(p);
    return i18next.t('details.item_format', {
      idx: idx + 1,
      name: p.name,
      sku: p.sku,
      details,
      price,
      lng: language
    });
  }).join('');

  return `${i18next.t('foundCount', { count, lng: language })}\n\n${i18next.t('curatedHighlights', { lng: language })}${highlightsText}\n\n${i18next.t('cta', { lng: language })}`;
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

    // 2. High-Performance Local-First Execution Path (100% Cloud-Native & Scalable on Railway)
    let aiText = "";
    let products = [];
    let lastToolParams = null;
    let agentExecutionSuccess = false;

    try {
      console.log(`[LOCAL_SEARCH] Retrieving conversational session context and executing WASM-native hybrid query...`);
      // Fetch last non-empty tool_params from previous AI messages in this session to maintain active context
      const lastMsgRes = await query(`
        SELECT tool_params FROM chat_messages 
        WHERE session_id = $1 AND sender = 'ai' AND tool_params IS NOT NULL 
        ORDER BY id DESC LIMIT 1
      `, [session_id]);
      const existingFilters = lastMsgRes.rows.length > 0 ? lastMsgRes.rows[0].tool_params : null;

      const { searchCatalogue } = await import('./src/services/searchService.js');
      // Pass limit: 500 to ensure all matching available items in db are returned
      let searchRes = await searchCatalogue({ queryText: text, limit: 500, existingFilters });
      products = searchRes.products || [];
      lastToolParams = searchRes.parsedFilters || {};

      // Graceful Conversational Fallback Strategy:
      // If the merged conversational query yields 0 matches, but we had existing filters from previous turns,
      // the compounding session context is deadlocked/overly restrictive.
      // We gracefully break the deadlock by running the search with ONLY the current turn's unmerged filter context.
      if (products.length === 0 && existingFilters) {
        console.log(`[CONVERSATIONAL_FALLBACK] Compounded filters returned 0 matches. Resetting compounding context and re-running search on current query...`);
        searchRes = await searchCatalogue({ queryText: text, limit: 500, existingFilters: null });
        products = searchRes.products || [];
        lastToolParams = searchRes.parsedFilters || {};
      }
      
      const count = products.length;

      // 3. Dynamic Local Luxury Concierge Generation (Lifetime Free, Unlimited & Fast)
      console.log(`[LOCAL_CONCIERGE] Generating localized dynamic response...`);
      aiText = generateTemplateResponse(text, products, language);
      agentExecutionSuccess = true;
    } catch (searchErr) {
      console.error('[LOCAL_SEARCH_FAIL] Local search engine execution failed:', searchErr.message);
      aiText = "I encountered an error while searching our inventory. Please allow me a moment to assist you.";
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

/**
 * Endpoint: Pull Model on Deployed Ollama Instance.
 * Allows triggering the pull of llama3.2 remotely.
 */
fastify.post('/api/ollama/pull', async (request, reply) => {
  const { model = 'llama3.2' } = request.body || {};
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';
  const pullUrl = `${ollamaUrl.replace(/\/$/, '')}/pull`;
  
  request.log.info({ model, pullUrl }, 'Triggering remote Ollama model pull');
  
  try {
    const res = await fetch(pullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model, stream: false })
    });
    
    if (!res.ok) {
      const errText = await res.text();
      return reply.status(res.status).send({ error: 'Failed to pull model', details: errText });
    }
    
    const data = await res.json();
    return { success: true, data };
  } catch (err) {
    request.log.error(err, 'Error pulling remote model');
    return reply.status(500).send({ error: 'Ollama pull execution failed', details: err.message });
  }
});

/**
 * Endpoint: Get Deployed Ollama Status / Tags.
 * Lists already downloaded models.
 */
fastify.get('/api/ollama/tags', async (request, reply) => {
  const ollamaUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434/api';
  const tagsUrl = `${ollamaUrl.replace(/\/$/, '')}/tags`;
  
  try {
    const res = await fetch(tagsUrl);
    if (!res.ok) {
      const errText = await res.text();
      return reply.status(res.status).send({ error: 'Failed to fetch tags', details: errText });
    }
    const data = await res.json();
    return data;
  } catch (err) {
    return reply.status(500).send({ error: 'Ollama tags fetch failed', details: err.message });
  }
});

// Fallback path: All unknown URLs redirect to serve SPA Single Page Application
fastify.setNotFoundHandler(async (request, reply) => {
  return reply.sendFile('index.html');
});

// Bind and boot
const port = process.env.PORT || 3000;
const start = async () => {
  try {
    // Ensure all plugins are ready before listening
    await fastify.ready();
    
    console.log(`[BOOT] Attempting to listen on port ${port}...`);
    await fastify.listen({ port: Number(port), host: '0.0.0.0' });
    
    console.log(`\n==========================================================`);
    console.log(`INDRIYA GATEWAYS ONLINE AT: http://localhost:${port}`);
    console.log(`==========================================================\n`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
