import i18next from 'i18next';

const resources = {
  'en-IN': {
    translation: {
      welcome: "Namaste and Welcome to Indriya. It is my pleasure to guide you through our private vault today.",
      foundCount: "I have uncovered {{count}} exquisite, hand-selected masterpieces that match your precise criteria.",
      details: {
        gold_weight: "crafted in {{purity}} gold ({{weight}}g)"
      }
    }
  },
  'hi-IN': {
    translation: {
      welcome: "नमस्ते और इंद्रिया में आपका स्वागत है। आज हमारे निजी वॉल्ट में आपका मार्गदर्शन करना मेरा सौभाग्य है।",
      foundCount: "मुझे आपकी पसंद के अनुसार हमारे संग्रह में {{count}} उत्कृष्ट मास्टरपीस मिले हैं।",
      details: {
        gold_weight: "{{purity}} सोने में निर्मित ({{weight}}g)"
      }
    }
  }
};

await i18next.init({
  lng: 'en-IN',
  fallbackLng: 'en-IN',
  resources
});

console.log("en-IN foundCount:", i18next.t('foundCount', { count: 5, lng: 'en-IN' }));
console.log("hi-IN foundCount:", i18next.t('foundCount', { count: 5, lng: 'hi-IN' }));
console.log("hi-IN gold_weight:", i18next.t('details.gold_weight', { purity: '18K', weight: 4.5, lng: 'hi-IN' }));
console.log("mr-IN fallback foundCount (should fallback to en-IN):", i18next.t('foundCount', { count: 12, lng: 'mr-IN' }));
