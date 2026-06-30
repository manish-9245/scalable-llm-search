import fs from 'fs';
import path from 'path';

const filePath = '/Users/manishtiwari/Documents/scalable-llm-search/server.js';
let content = fs.readFileSync(filePath, 'utf8');

const startMarker = "function generateTemplateResponse(queryText, products, language = 'en-IN') {";
const endMarker = "  return `${config.foundCount(count)}\\n\\n${config.curatedHighlights}${highlightsText}\\n\\n${config.cta}`;\n}";

const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error("Could not find start marker!");
  process.exit(1);
}

const endIndex = content.indexOf(endMarker, startIndex);
if (endIndex === -1) {
  console.error("Could not find end marker!");
  process.exit(1);
}

const actualEndIndex = endIndex + endMarker.length;

const replacement = `await i18next.init({
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

  return \`\${i18next.t('foundCount', { count, lng: language })}\\n\\n\${i18next.t('curatedHighlights', { lng: language })}\${highlightsText}\\n\\n\${i18next.t('cta', { lng: language })}\`;
}`;

const newContent = content.substring(0, startIndex) + replacement + content.substring(actualEndIndex);
fs.writeFileSync(filePath, newContent, 'utf8');
console.log("Successfully replaced generateTemplateResponse using local script!");
