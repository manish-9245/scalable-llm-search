import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
import { log, getChildLogger } from '../utils/logger.js';

dotenv.config();

const redisUrl = process.env.REDIS_URL;

const connection = redisUrl ? new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
}) : null;

if (!connection) {
  log.warn("⚠️ [QUEUE] REDIS_URL is missing. Background jobs will be disabled.");
}

// 1. Define the Ingestion Queue
export const ingestionQueue = connection ? new Queue('product-ingestion', { connection }) : null;

/**
 * Adds a product ingestion job to the queue.
 * @param {object} data - { sku, name, category, specs, traceId }
 */
export async function queueProductIngestion(data) {
  if (!ingestionQueue) {
    log.error("[QUEUE] Cannot add job: Queue not initialized.");
    return null;
  }
  
  const job = await ingestionQueue.add('analyze-product', data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
  });
  
  log.info(`[QUEUE] Job ${job.id} queued for SKU: ${data.sku}`, { 
    sku: data.sku, 
    jobId: job.id, 
    traceId: data.traceId 
  });
  return job.id;
}

/**
 * Initializes the worker to process ingestion jobs.
 * This should be called once on server startup.
 */
export function startIngestionWorker() {
  if (!connection) return;

  const worker = new Worker('product-ingestion', async (job) => {
    const { sku, name, category, specs, traceId } = job.data;
    const workerLog = getChildLogger(traceId || `worker-${job.id}`);
    
    workerLog.info(`[WORKER] Processing SKU: ${sku}`, { jobId: job.id, sku });

    // Dynamic import to avoid circular dependencies and ensure services are ready
    const { processProductAnalysis } = await import('../services/ingestionService.js');
    
    // Pass the trace-aware logger to the processing function
    await processProductAnalysis({ sku, name, category, specs, traceId }, workerLog);
    
    workerLog.info(`[WORKER] Completed analysis for SKU: ${sku}`, { jobId: job.id, sku });
  }, { 
    connection,
    concurrency: 2 // Scale up if needed
  });

  worker.on('completed', (job) => {
    log.debug(`[WORKER] Job ${job.id} finished successfully.`);
  });

  worker.on('failed', (job, err) => {
    const traceId = job?.data?.traceId;
    const workerLog = traceId ? getChildLogger(traceId) : log;
    workerLog.error(`[WORKER] Job ${job.id} failed`, { jobId: job?.id, error: err.message });
  });

  log.info('[WORKER] Product Ingestion Worker started and listening.');
}
