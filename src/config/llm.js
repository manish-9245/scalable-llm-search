import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Force Transformers to use local caching directory to enable zero-network cold starts
env.cacheDir = path.resolve('./onnx_cache');

let embedderInstance = null;
let transcriberInstance = null;

// Initialize embedding pipeline (all-MiniLM-L6-v2)
export async function getEmbedder() {
  if (!embedderInstance) {
    console.log('Loading local WASM Embedding Model (Xenova/all-MiniLM-L6-v2)...');
    embedderInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('Embedding model loaded successfully.');
  }
  return embedderInstance;
}

// Initialize ASR transcriber pipeline (defaulting to Xenova/whisper-base for high accuracy and multilingual support)
export async function getTranscriber() {
  if (!transcriberInstance) {
    const modelName = process.env.SPEECH_TO_TEXT_MODEL || 'Xenova/whisper-base';
    console.log(`Loading local WASM Speech-to-Text Model (${modelName})...`);
    transcriberInstance = await pipeline('automatic-speech-recognition', modelName);
    console.log(`Speech-to-Text model (${modelName}) loaded successfully.`);
  }
  return transcriberInstance;
}

import { redisClient } from './redis.js';
import crypto from 'crypto';

/**
 * Generates 384d float array embedding natively on CPU.
 * Optimized with Redis caching to prevent redundant local WASM execution.
 * @param {string} text - Raw search term or glossary content
 * @returns {Promise<number[]>} - 384-dimensional vector array
 */
export async function generateEmbedding(text) {
  if (!text || typeof text !== 'string') return null;
  const cleanText = text.trim().toLowerCase();
  if (!cleanText) return null;

  // Use hash of text for cache key to handle length/special chars
  const hash = crypto.createHash('md5').update(cleanText).digest('hex');
  const cacheKey = `embedding:${hash}`;

  try {
    if (redisClient.isOpen) {
      const cached = await redisClient.get(cacheKey);
      if (cached) return JSON.parse(cached);
    }
  } catch (e) {
    console.warn("[LLM] Cache read error:", e.message);
  }

  const embedder = await getEmbedder();
  
  // Extract features
  const output = await embedder(cleanText, {
    pooling: 'mean',
    normalize: true
  });
  
  const vector = Array.from(output.data);

  // Background cache write (7 days TTL)
  try {
    if (redisClient.isOpen) {
      await redisClient.setEx(cacheKey, 604800, JSON.stringify(vector));
    }
  } catch (e) {
    console.warn("[LLM] Cache write error:", e.message);
  }
  
  return vector;
}

/**
 * Normalizes 16-bit mono 16kHz PCM WAV buffer to Float32Array for Whisper ingestion
 * @param {Buffer} buffer - Raw audio buffer upload
 * @returns {Float32Array} - Normalized Float32 sample array
 */
function parseWav(buffer) {
  // Read WAV header subchunk size to locate data section
  // Standard WAV files have 'RIFF' marker at 0, 'WAVE' at 8, 'fmt ' at 12, 'data' starting around 36-44
  let offset = 12;
  let dataOffset = 0;
  let dataSize = 0;
  
  while (offset < buffer.length - 8) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    
    if (chunkId === 'data') {
      dataOffset = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }
  
  if (dataOffset === 0) {
    // Fallback: If 'data' chunk parse failed, skip first 44 bytes as typical header offset
    console.warn('WAV parser: "data" chunk marker not found. Falling back to default offset.');
    dataOffset = 44;
    dataSize = buffer.length - 44;
  }
  
  // Extract samples (16-bit signed integers, so 2 bytes per sample)
  const sampleCount = Math.floor(dataSize / 2);
  const floatSamples = new Float32Array(sampleCount);
  
  for (let i = 0; i < sampleCount; i++) {
    const byteOffset = dataOffset + (i * 2);
    if (byteOffset + 1 >= buffer.length) break;
    
    // Read 16-bit PCM integer
    const sample = buffer.readInt16LE(byteOffset);
    // Normalize to float range [-1.0, 1.0]
    floatSamples[i] = sample / 32768.0;
  }
  
  return floatSamples;
}

/**
 * Transcribes voice recording natively on CPU with 100% $0 API cost.
 * Upgraded to support high-accuracy models and native multilingual routing (e.g. Hindi, Tamil, Telugu).
 * @param {Buffer} wavBuffer - 16kHz, mono 16-bit PCM WAV file
 * @param {string} langCode - The requested language locale (e.g. 'hi-IN', 'ta-IN')
 * @returns {Promise<string>} - Transcribed text string
 */
export async function transcribeAudio(wavBuffer, langCode = 'en-IN') {
  if (!wavBuffer || wavBuffer.length === 0) return '';
  
  try {
    const transcriber = await getTranscriber();
    
    // Convert WAV buffer to standard Float32Array samples
    const audioData = parseWav(wavBuffer);
    
    console.log(`Transcribing voice query of ${audioData.length} samples (~${(audioData.length / 16000).toFixed(2)}s)...`);
    
    // Map langCode (e.g. 'en-IN', 'hi-IN') to Whisper language names/codes
    const whisperLanguageMap = {
      'en-IN': 'english',
      'hi-IN': 'hindi',
      'ta-IN': 'tamil',
      'te-IN': 'telugu',
      'kn-IN': 'kannada',
      'ml-IN': 'malayalam',
      'mr-IN': 'marathi',
      'bn-IN': 'bengali',
      'gu-IN': 'gujarati'
    };
    
    // Extract base language code if not fully matched
    let whisperLanguage = 'english';
    if (langCode) {
      const normalizedLang = langCode.trim().toLowerCase();
      if (whisperLanguageMap[normalizedLang]) {
        whisperLanguage = whisperLanguageMap[normalizedLang];
      } else {
        const baseLang = normalizedLang.split('-')[0];
        // Check if base code matches any value in mapping keys (e.g. 'hi' matches 'hi-IN')
        const foundKey = Object.keys(whisperLanguageMap).find(k => k.startsWith(baseLang));
        if (foundKey) {
          whisperLanguage = whisperLanguageMap[foundKey];
        }
      }
    }

    console.log(`Whisper language selected: ${whisperLanguage} for requested language locale: ${langCode}`);

    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: whisperLanguage,
      task: 'transcribe'
    });
    
    const transcription = result?.text?.trim() || '';
    console.log('Transcribed Text:', transcription);
    return transcription;
  } catch (error) {
    console.error('ASR Transcription Error:', error.message);
    throw error;
  }
}
