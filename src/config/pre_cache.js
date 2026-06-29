import { getEmbedder, getTranscriber } from './llm.js';

async function preCache() {
  console.log('=== Starting local ONNX Model Pre-Caching ===');
  try {
    console.log('Pre-caching Xenova/all-MiniLM-L6-v2...');
    await getEmbedder();
    
    console.log('Pre-caching Xenova/whisper-tiny...');
    await getTranscriber();
    
    console.log('=== All local ONNX models pre-cached successfully ===');
    process.exit(0);
  } catch (error) {
    console.error('=== Local ONNX model pre-caching FAILED ===', error);
    process.exit(1);
  }
}

preCache();
