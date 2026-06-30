import { chatAgent } from '../src/mastra/agent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testAgent() {
  console.log('--- Testing Qwen 2.5 (1.5B) Agentic Search ---');
  console.log('OLLAMA_API_URL:', process.env.OLLAMA_API_URL || 'http://localhost:11434/api');
  
  const query = 'Show me gold bangles under 2 lakhs';
  console.log(`\nQuery: "${query}"`);
  
  try {
    const result = await chatAgent.generateLegacy(query);
    
    console.log('\n--- AI Response ---');
    console.log(result.text);
    
    if (result.toolResults && result.toolResults.length > 0) {
      console.log('\n--- Tool Calls Detected ---');
      result.toolResults.forEach(res => {
        console.log(`Tool: ${res.toolName}`);
        console.log(`Arguments: ${JSON.stringify(res.args || res.input, null, 2)}`);
        console.log(`Results Found: ${res.result?.results?.length || 0}`);
      });
    } else {
      console.log('\n[!] No tool calls were made. Llama 3.1 might still be downloading or not correctly interpreting the tool instructions.');
    }
  } catch (error) {
    console.error('\n[ERROR] Test failed:', error.message);
    if (error.cause) {
      console.error('Cause:', error.cause.message || error.cause);
    }
  }
}

testAgent();
