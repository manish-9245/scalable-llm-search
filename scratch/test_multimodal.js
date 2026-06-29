import { indriyaAnalyzer } from '../src/mastra/agent.js';
import fetch from 'node-fetch'; // If needed, but Node 22 has it. Using standard fetch.

async function testMultimodal() {
  const sku = 'DEARA70-AQED262';
  const name = 'Grand Antique Gold Choker';
  const category = 'Choker';
  const specs = { "Gold Weight": "45g", "Stones": "Rubies, Emeralds" };
  const imageUrl = 'https://mcprod.noveljewels.com/static/version1719656463/frontend/Indriya/default/en_US/Magento_Catalog/images/product/placeholder/image.jpg'; // Placeholder or real

  const prompt = `
    Perform professional visual and spec-driven analysis for the following Indriya catalogue item.
    SKU: ${sku}
    Name: ${name}
    Category: ${category}
    Specifications: ${JSON.stringify(specs)}
  `;

  const content = [{ type: 'text', text: prompt }];

  try {
    console.log(`Fetching image from ${imageUrl}...`);
    const imgRes = await fetch(imageUrl);
    if (imgRes.ok) {
      const buffer = await imgRes.arrayBuffer();
      content.push({
        type: 'image',
        image: Buffer.from(buffer),
        mimeType: imgRes.headers.get('content-type') || 'image/jpeg'
      });
      console.log('Image fetched successfully.');
    } else {
      console.log(`Image fetch failed: ${imgRes.status}`);
    }

    console.log('Generating analysis...');
    const result = await indriyaAnalyzer.generate(content.length > 1 ? content : prompt);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Test failed:', err);
  }
}

testMultimodal();
