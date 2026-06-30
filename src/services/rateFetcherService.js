import cron from 'node-cron';
import { query } from '../config/db.js';
import { redisClient } from '../config/redis.js';
import { log } from '../utils/logger.js';

const FOOTER_RATE_URL = 'https://www.indriya.com/content/experience-fragments/noveljewels/in/en/site/footer/master/_jcr_content/root/footer/gold-rate.nocache.html';

// Baseline ratios from June 30, 2026 authentic rates:
// - 22KT Gold: 13,080.00
// - 24KT Gold: 14,270.00
// - 18KT Gold: 10,710.00
// - 14KT Gold: 8,330.00
const RATIO_24K = 14270 / 13080;
const RATIO_18K = 10710 / 13080;
const RATIO_14K = 8330 / 13080;

/**
 * Fetches and parses today's 22KT gold rate from Indriya's website.
 * @returns {Promise<number|null>} Today's gold rate per gram or null if failed.
 */
export async function fetchLiveGoldRate() {
  try {
    log.info(`[RATE_FETCHER] Fetching daily gold rates from Indriya: ${FOOTER_RATE_URL}`);
    const response = await fetch(FOOTER_RATE_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5'
      },
      signal: AbortSignal.timeout(10000) // 10s timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP response status: ${response.status}`);
    }

    const html = await response.text();

    // Robust regex parsing for the 22kt gold rate
    const matches = html.match(/Today(?:&#39;|')s\s+Gold\s+Rate\s+is\s+Rs\.?\s*([0-9,]+(?:\.[0-9]+)?)\s*per\s+gm\s*\(22kt\)/i) ||
                    html.match(/Gold\s+Rate\s+is\s+Rs\.?\s*([0-9,]+(?:\.[0-9]+)?)\s*per\s+gm\s*\(22kt\)/i) ||
                    html.match(/Today(?:&#39;|')s\s+Gold\s+Rate.*?Rs\.?\s*([0-9,]+(?:\.[0-9]+)?)/i);

    if (!matches || !matches[1]) {
      log.warn('[RATE_FETCHER] Could not extract 22KT Gold Rate using regex patterns. Body length: ' + html.length);
      return null;
    }

    const cleanedRate = matches[1].replace(/,/g, '');
    const rate = parseFloat(cleanedRate);

    if (isNaN(rate) || rate <= 0) {
      log.warn(`[RATE_FETCHER] Extracted invalid 22KT gold rate value: "${cleanedRate}"`);
      return null;
    }

    log.info(`[RATE_FETCHER] Successfully parsed today's 22KT gold rate: ${rate} INR/g`);
    return rate;
  } catch (error) {
    log.error('[RATE_FETCHER] Network or parse failure during daily rate fetch', {}, error);
    return null;
  }
}

/**
 * Fetches previous/baseline Platinum & Silver rates from database or defaults to stable values.
 * @returns {Promise<{platinum: number, silver: number}>}
 */
async function getPreviousMetalRates() {
  const result = {
    platinum: 3550.00,
    silver: 88.00
  };

  try {
    const res = await query(`
      SELECT DISTINCT ON (metal_type) metal_type, rate_per_gram 
      FROM daily_metal_rates 
      ORDER BY metal_type, record_date DESC
    `);
    
    res.rows.forEach(r => {
      const type = r.metal_type;
      if (type.toLowerCase().includes('platinum')) {
        result.platinum = parseFloat(r.rate_per_gram);
      } else if (type.toLowerCase().includes('silver')) {
        result.silver = parseFloat(r.rate_per_gram);
      }
    });
  } catch (err) {
    log.warn('[RATE_FETCHER] Failed to query latest Platinum/Silver rates from DB, using fallback defaults', { error: err.message });
  }

  return result;
}

/**
 * Fetches live rates, scales them, persists in Postgres, and clears Redis cache.
 * @param {Function} [cacheInvalidator] Callback to flush other cache keys (e.g. search:* and products:*)
 * @returns {Promise<boolean>} True if sync succeeded, false otherwise.
 */
export async function fetchAndSyncRates(cacheInvalidator) {
  try {
    const gold22k = await fetchLiveGoldRate();
    if (!gold22k) {
      log.warn('[RATE_FETCHER] Sync aborted: Live gold rate could not be fetched. Using existing DB rates.');
      return false;
    }

    // Scale proportional metal rates
    const gold24k = Math.round(gold22k * RATIO_24K * 100) / 100;
    const gold18k = Math.round(gold22k * RATIO_18K * 100) / 100;
    const gold14k = Math.round(gold22k * RATIO_14K * 100) / 100;

    const previousMetals = await getPreviousMetalRates();

    const rates = [
      { type: '22KT Gold', rate: gold22k },
      { type: '18KT Gold', rate: gold18k },
      { type: '14KT Gold', rate: gold14k },
      { type: '24KT Gold', rate: gold24k },
      { type: 'Platinum', rate: previousMetals.platinum },
      { type: 'Silver', rate: previousMetals.silver }
    ];

    log.info('[RATE_FETCHER] Persisting updated rates into daily_metal_rates...', { rates });

    for (const r of rates) {
      await query(`
        INSERT INTO daily_metal_rates (record_date, metal_type, rate_per_gram)
        VALUES (CURRENT_DATE, $1, $2)
        ON CONFLICT (record_date, metal_type)
        DO UPDATE SET rate_per_gram = EXCLUDED.rate_per_gram;
      `, [r.type, r.rate]);
    }

    // Clear Redis Cache
    if (redisClient.isOpen) {
      try {
        await redisClient.del('latest_metal_rates');
        log.info('[RATE_FETCHER] Redis cache key "latest_metal_rates" successfully purged.');
      } catch (err) {
        log.error('[RATE_FETCHER] Failed to clear "latest_metal_rates" from Redis cache', {}, err);
      }
    }

    // Invoke additional cache invalidation (e.g., search:* and products:*) if provided
    if (cacheInvalidator && typeof cacheInvalidator === 'function') {
      try {
        await cacheInvalidator();
        log.info('[RATE_FETCHER] Invoked server cache invalidator hook successfully.');
      } catch (err) {
        log.error('[RATE_FETCHER] Error running cache invalidation callback hook', {}, err);
      }
    }

    log.info('[RATE_FETCHER] Daily gold and metal rates successfully synchronized and cached.');
    return true;
  } catch (error) {
    log.error('[RATE_FETCHER] Critical failure during daily rate synchronization', {}, error);
    return false;
  }
}

/**
 * Initializes and schedules the background node-cron rate fetcher.
 * @param {Function} [cacheInvalidator] Callback to flush other cache keys (e.g. search:* and products:*)
 */
export function startRateFetcherCron(cacheInvalidator) {
  // Sync rates on startup (gracefully in background)
  log.info('[RATE_FETCHER] Launching initial rate synchronization on boot...');
  fetchAndSyncRates(cacheInvalidator).catch(err => {
    log.error('[RATE_FETCHER] Startup rate sync failed gracefully', {}, err);
  });

  // Schedule daily at 9:05 AM IST (which is 03:35 UTC or server system time)
  // Standard gold rates in India typically update around 9:00 AM IST.
  cron.schedule('5 9 * * *', async () => {
    log.info('[RATE_FETCHER] Triggering scheduled daily gold rates fetch from Indriya...');
    await fetchAndSyncRates(cacheInvalidator);
  });

  log.info('[RATE_FETCHER] Scheduled background rate synchronizer job (Daily at 9:05 AM).');
}
