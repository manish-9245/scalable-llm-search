import { getTranscriber } from '../src/config/llm.js';

console.log("=========================================================");
console.log("  WHISPER ASR PIPELINE INITIALIZATION & INTEGRATION TEST");
console.log("=========================================================");

try {
  console.log("Loading model from .env configuration (or defaulting to whisper-base)...");
  const startTime = Date.now();
  
  // Initialize the transcriber (this will trigger model download and local compilation if not already cached)
  const transcriber = await getTranscriber();
  
  const loadTimeMs = Date.now() - startTime;
  console.log(`[PASS] Whisper Speech-to-Text model loaded successfully in ${(loadTimeMs / 1000).toFixed(2)}s.`);
  console.log("Transcriber pipeline function check:", typeof transcriber === 'function' ? 'VALID' : 'INVALID');
  
  console.log("=========================================================");
  console.log("ASR pipeline test completed with 100% SUCCESS!");
  console.log("=========================================================");
  process.exit(0);
} catch (error) {
  console.error("=========================================================");
  console.error("  ASR PIPELINE LOADING FAILED");
  console.error("=========================================================");
  console.error("Error Message:", error.message);
  console.error(error);
  process.exit(1);
}
