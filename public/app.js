/* ============================================================================
   INDRIYA LUXURY AI SEARCH - CONVERSATIONAL UI APP
   ============================================================================ */

let currentRates = {
  '22K': 13080.00,
  '18K': 10710.00,
  'Platinum': 3550.00,
};

let currentSessionId = null;
let currentLanguage = 'en-IN';
const loadedProductsMap = new Map();
const selectedAnalysisProducts = new Map();
let allAnalysisProducts = [];

// DOM Elements
const searchInput = document.getElementById('search-input');
const micBtn = document.getElementById('mic-btn');
const sendBtn = document.getElementById('send-btn');
const voiceWaves = document.getElementById('voice-waves');
const chatMessagesContainer = document.getElementById('chat-messages-container');
const chatHistoryList = document.getElementById('chat-history-list');
const newChatBtn = document.getElementById('new-chat-btn');
const welcomeChat = document.getElementById('welcome-chat');

// Mobile UI Elements
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const chatSidebar = document.getElementById('chat-sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Audio Global Context
let audioContext = null;
let scriptProcessor = null;
let mediaStream = null;
let recordedSamples = [];
let isRecording = false;

window.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();
  setupTabs();
  await loadLiveRates();
  await loadAllSessions();
  await loadProductsForAnalysis();
  handleRouting();
});

window.addEventListener('popstate', handleRouting);

function handleRouting() {
  const hash = window.location.hash;
  if (hash.startsWith('#/analysis/')) {
    const sku = hash.replace('#/analysis/', '');
    // Switch to analysis tab
    const tabBtn = document.querySelector('[data-tab="analysis"]');
    if (tabBtn) tabBtn.click();
    
    // Check if product is already loaded
    const p = loadedProductsMap.get(sku);
    if (p) {
      let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
      if (p.image_urls && p.image_urls.length > 0) {
        imageUrl = `/api/proxy-image?url=${encodeURIComponent(p.image_urls[0])}`;
      }
      selectProductForAnalysis(p, imageUrl, false); // false = don't push state again
    } else {
      setTimeout(() => {
        const pRetry = loadedProductsMap.get(sku);
        if (pRetry) {
          let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
          if (pRetry.image_urls && pRetry.image_urls.length > 0) {
            imageUrl = `/api/proxy-image?url=${encodeURIComponent(pRetry.image_urls[0])}`;
          }
          selectProductForAnalysis(pRetry, imageUrl, false);
        }
      }, 1000);
    }
  } else if (hash.startsWith('#session=')) {
    const sessionId = hash.replace('#session=', '');
    if (sessionId !== currentSessionId) {
      loadSession(sessionId);
    }
    // Switch to concierge tab if not already
    const tabBtn = document.querySelector('[data-tab="concierge"]');
    if (tabBtn) tabBtn.click();
  }
}

function setupEventListeners() {
  // Input Handling
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendMessage();
  });
  if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);

  // Suggested Queries
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      searchInput.value = chip.dataset.query;
      handleSendMessage();
    });
  });

  // Sidebar Sessions
  if (newChatBtn) {
    newChatBtn.addEventListener('click', startNewSession);
  }

  // Mobile Menu Toggle
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', () => {
      chatSidebar.classList.toggle('open');
      sidebarOverlay.classList.toggle('active');
    });
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      chatSidebar.classList.remove('open');
      sidebarOverlay.classList.remove('active');
    });
  }

  // Voice Interaction Events
  if (micBtn) {
    // Touch / Mouse interactions for hold-to-speak
    micBtn.addEventListener('mousedown', startRecordingFlow);
    micBtn.addEventListener('touchstart', startRecordingFlow, { passive: true });
    
    window.addEventListener('mouseup', stopRecordingFlow);
    window.addEventListener('touchend', stopRecordingFlow);
  }

  // Language Selection
  const languageSelect = document.getElementById('language-select');
  const searchModeBadge = document.getElementById('search-mode-badge');
  let isLocalOnly = true;

  // ----------------------------------------------------------------------------
  // CONFIG & INITIALIZATION
  // ----------------------------------------------------------------------------

  async function initConfig() {
    try {
      const res = await fetch('/api/config');
      const config = await res.json();
      isLocalOnly = config.useLocalOnly;
      updateModeBadge();
    } catch (err) {
      console.error('Failed to fetch config:', err);
    }
  }

  function updateModeBadge() {
    if (!searchModeBadge) return;
    if (isLocalOnly) {
      searchModeBadge.className = 'mode-badge local';
      searchModeBadge.innerHTML = '<i class="fa-solid fa-microchip"></i> <span>Local Search ($0)</span>';
      searchModeBadge.title = "Running on 100% free local models (Transformers.js + pgvector)";
    } else {
      searchModeBadge.className = 'mode-badge ai';
      searchModeBadge.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> <span>AI Concierge</span>';
      searchModeBadge.title = "Powered by Gemini 2.5 Flash for advanced reasoning";
    }
  }

  // Initial check
  initConfig();

  if (languageSelect) {
    languageSelect.addEventListener('change', (e) => {
      currentLanguage = e.target.value;
      console.log('Language switched to:', currentLanguage);
    });
  }
}

// ----------------------------------------------------------------------------
// CHAT SESSION & MESSAGE HANDLING
// ----------------------------------------------------------------------------

function startNewSession() {
  currentSessionId = null;
  chatMessagesContainer.innerHTML = '';
  chatMessagesContainer.appendChild(welcomeChat);
  welcomeChat.classList.remove('hidden');
  searchInput.value = '';
  
  // Clear active states in sidebar
  Array.from(chatHistoryList.children).forEach(el => el.classList.remove('active'));
  
  // Update URL
  window.location.hash = '';
}

async function ensureSession(titleText = 'New Conversation') {
  if (currentSessionId) return currentSessionId;
  
  let title = titleText;
  if (title.length > 30) {
    title = title.substring(0, 30) + '...';
  }
  
  try {
    const res = await fetch('/api/chat/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const data = await res.json();
    currentSessionId = data.id;
    addSessionToSidebar(data);
    // Update URL
    window.location.hash = `session=${data.id}`;
    return currentSessionId;
  } catch (err) {
    console.error('Failed to create session:', err);
    return null;
  }
}

async function handleSendMessage() {
  const text = searchInput.value.trim();
  if (!text) return;
  
  searchInput.value = '';
  welcomeChat.classList.add('hidden');
  
  appendUserBubble(text);
  const typingId = appendTypingBubble();
  
  try {
    const sessionId = await ensureSession(text);
    if (!sessionId) throw new Error('Session creation failed');

    const response = await fetch('/api/chat/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, text, language: currentLanguage })
    });
    
    const data = await response.json();
    removeBubble(typingId);
    
    if (data.success && data.message) {
      appendAIBubble(data.message.text, data.searchResult?.products || []);
    } else {
      appendAIBubble("An error occurred processing your request.", []);
    }
  } catch (err) {
    console.error('Chat error:', err);
    removeBubble(typingId);
    appendAIBubble("Sorry, our conversational engine is currently unavailable.", []);
  }
}

// ----------------------------------------------------------------------------
// DOM RENDERING
// ----------------------------------------------------------------------------

function appendUserBubble(text) {
  const div = document.createElement('div');
  div.className = 'chat-bubble user';
  div.textContent = text;
  chatMessagesContainer.appendChild(div);
  scrollToBottom();
}

function appendTypingBubble() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.id = id;
  div.className = 'chat-bubble ai';
  div.innerHTML = `
    <div class="bubble-content">
      <div class="ai-avatar"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2yRi9YAoEGGufoVhsTCFClPsAsZhEyL9qTA&s" alt="Indriya AI" /></div>
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    </div>
  `;
  chatMessagesContainer.appendChild(div);
  scrollToBottom();
  return id;
}

function removeBubble(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function appendAIBubble(text, products = []) {
  const div = document.createElement('div');
  div.className = 'chat-bubble ai';
  
  let html = `
    <div class="bubble-content">
      <div class="ai-avatar"><img src="https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR2yRi9YAoEGGufoVhsTCFClPsAsZhEyL9qTA&s" alt="Indriya AI" /></div>
      <div style="flex:1;">
        <div class="ai-text">${text}</div>
  `;

  if (products && products.length > 0) {
    let grid = '<div class="ai-products-grid">';
    products.forEach(p => {
      loadedProductsMap.set(p.sku, p);
      // Robust attribute extraction with fallbacks for legacy/varied schemas
      const goldW = (p.gold_weight_numeric !== null && p.gold_weight_numeric !== undefined) ? `${p.gold_weight_numeric}g` : (p.gold_weight ? `${p.gold_weight}g` : 'N/A');
      const diaW = (p.diamond_weight_numeric !== null && p.diamond_weight_numeric !== undefined) ? `${p.diamond_weight_numeric}ct` : (p.diamond_weight ? `${p.diamond_weight}ct` : 'N/A');
      const gemW = (p.gemstone_weight_numeric !== null && p.gemstone_weight_numeric !== undefined) ? `${p.gemstone_weight_numeric}ct` : (p.gemstone_weight ? `${p.gemstone_weight}ct` : '0ct');
      const purityText = p.purity || '18K';
      
      const priceToUse = p.calculated_price || p.base_price || p.price || 0;
      const formattedPrice = new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: 'INR', 
        maximumFractionDigits: 0 
      }).format(priceToUse);

      const displayImg = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : (p.image || 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg');
      const imgUrl = displayImg.includes('scene7.com') ? `/api/proxy-image?url=${encodeURIComponent(displayImg)}` : displayImg;

      // Parse AI Description if it's JSON
      const narrative = parseNarrativeToTabs(p.ai_description || p.description, p);
      const identityText = narrative.isJson ? (narrative.identity || narrative.curatorNote) : (p.description || 'A timeless piece of exquisite craftsmanship.');

      grid += `
        <div class="product-card" onclick="queueForAnalysis('${p.sku}')" style="cursor: pointer;">
          <div class="badge-collection">${p.category || 'Jewellery'}</div>
          <div class="badge-sku">${p.sku}</div>
          <div class="card-image-box">
            <img src="${imgUrl}" alt="${p.name}" loading="lazy" />
          </div>
          <div class="card-body">
            <div class="card-category">${p.sub_category || ''}</div>
            <h3 class="card-title">${p.name}</h3>
            <div class="card-specs-grid" style="grid-template-columns: repeat(2, 1fr); gap: 12px 10px;">
              <div class="spec-metric" title="Gold Weight"><i class="fa-solid fa-weight-hanging"></i> Gold: ${goldW}</div>
              <div class="spec-metric" title="Gold Purity"><i class="fa-solid fa-award"></i> Purity: ${purityText}</div>
              <div class="spec-metric" title="Diamond Weight"><i class="fa-regular fa-gem"></i> Diamond: ${diaW}</div>
              <div class="spec-metric" title="Gemstone Weight"><i class="fa-solid fa-ring"></i> Stones: ${gemW}</div>
            </div>
            
            <div style="margin-bottom: 14px; flex: 1;">
              <p class="dossier-text" style="font-size: 13px; line-height: 1.5; color: var(--text-secondary); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin: 0;">
                ${identityText}
              </p>
            </div>

            <div class="card-price-container" style="margin-top: auto; padding-top: 14px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <div class="price-tag">
                <span class="price-label" style="font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Estimated Price</span>
                <span class="price-value" style="font-size: 18px; font-weight: 700; color: var(--gold-primary);">${formattedPrice}</span>
              </div>
              <span class="analyze-link" style="font-size: 11px; color: var(--gold-primary); font-weight: 600; display: inline-flex; align-items: center; gap: 4px; opacity: 0.8; transition: var(--transition-smooth);">
                Analyze <i class="fa-solid fa-arrow-right" style="font-size: 10px;"></i>
              </span>
            </div>
          </div>
        </div>
      `;
    });
    grid += '</div>';
    html += grid;
  }

  html += `
      </div>
    </div>
  `;
  div.innerHTML = html;
  chatMessagesContainer.appendChild(div);
  scrollToBottom();
}

function scrollToBottom() {
  chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
}

// Global function to switch tabs within a product dossier
window.switchDossierTab = function(event, sku, tabId) {
  const btn = event.currentTarget;
  const navContainer = btn.parentElement;
  
  // Deactivate all buttons in this specific product's nav
  Array.from(navContainer.children).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Hide all contents for this specific product
  const cardBody = navContainer.parentElement;
  Array.from(cardBody.querySelectorAll('.dossier-tab-content')).forEach(c => c.classList.remove('active'));
  
  // Show target content
  const targetContent = cardBody.querySelector(`#dossier-${sku}-${tabId}`);
  if (targetContent) {
    targetContent.classList.add('active');
  }
};

function addSessionToSidebar(session) {
  const btn = document.createElement('button');
  btn.className = 'session-item active';
  btn.textContent = session.title || 'New Conversation';
  btn.onclick = () => loadSession(session.id);
  
  // Insert at top
  chatHistoryList.prepend(btn);
}

async function loadSession(id) {
  currentSessionId = id;
  welcomeChat.classList.add('hidden');
  chatMessagesContainer.innerHTML = '';
  
  // A crude way to mark active
  Array.from(chatHistoryList.children).forEach(el => el.classList.remove('active'));
  // In a real app we'd attach dataset.id to the buttons, but for now we'll just ignore the visual active state
  
  try {
    const res = await fetch(`/api/chat/session/${id}`);
    const data = await res.json();
    
    if (data.messages && data.messages.length > 0) {
      data.messages.forEach(m => {
        if (m.sender === 'user') {
          appendUserBubble(m.text);
        } else {
          let prods = [];
          if (m.products) {
            try { prods = typeof m.products === 'string' ? JSON.parse(m.products) : m.products; } catch(e) {}
          }
          appendAIBubble(m.text, prods);
        }
      });
    }

    // Update URL hash without triggering re-load
    if (window.location.hash !== `#session=${id}`) {
      window.history.pushState(null, null, `#session=${id}`);
    }
  } catch (err) {
    console.error('Failed to load session history:', err);
  }
}

async function loadAllSessions() {
  try {
    const res = await fetch('/api/chat/sessions');
    const sessions = await res.json();
    
    // Clear loading/stale UI if any
    chatHistoryList.innerHTML = '';
    
    if (sessions && sessions.length > 0) {
      // Reverse so the oldest in the 50 limit is prepended first, making newest at top
      sessions.reverse().forEach(session => {
        addSessionToSidebar(session);
      });
      // Optionally de-activate all initially
      Array.from(chatHistoryList.children).forEach(el => el.classList.remove('active'));
    }
  } catch (err) {
    console.error('Failed to load past sessions:', err);
  }
}

// ----------------------------------------------------------------------------
// RATES MANAGEMENT
// ----------------------------------------------------------------------------

async function loadLiveRates() {
  // Rates display removed from sidebar UI
}

function updateHeaderRatesDisplay() {
  // Rates display removed from sidebar UI
}

// ----------------------------------------------------------------------------
// SPEECH-TO-TEXT DOWN-SAMPLING WAV ENCODER
// ----------------------------------------------------------------------------

async function startRecordingFlow(e) {
  // Prevent ghost clicks if touch triggered
  if (e && e.type === 'touchstart') e.preventDefault();
  
  if (isRecording) return;
  isRecording = true;
  recordedSamples = [];

  micBtn.classList.add('recording');
  if(voiceWaves) voiceWaves.classList.add('active');

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Instantiate AudioContext down-sampled natively to exactly 16kHz
    audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    
    const source = audioContext.createMediaStreamSource(mediaStream);
    
    // Buffer size of 4096 (standard matching callback rate)
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
    
    scriptProcessor.onaudioprocess = (ev) => {
      if (!isRecording) return;
      const channelData = ev.inputBuffer.getChannelData(0);
      recordedSamples.push(new Float32Array(channelData));
    };

    source.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);
  } catch (err) {
    console.error('Microphone hardware acquisition failed:', err);
    stopRecordingFlow();
  }
}

async function stopRecordingFlow() {
  if (!isRecording) return;
  isRecording = false;

  micBtn.classList.remove('recording');
  if(voiceWaves) voiceWaves.classList.remove('active');

  // Close media context streams
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }

  // Compile WAV Data
  const wavBlob = encodeWAV(recordedSamples, 16000);
  recordedSamples = [];
  
  if (wavBlob.size < 100) return; // Ignore accidental micro-taps

  const formData = new FormData();
  formData.append('file', wavBlob, 'recording.wav');

  const ogPlaceholder = searchInput.placeholder;
  searchInput.placeholder = "Listening and transcribing...";

  try {
    const response = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (data.query) {
      searchInput.value = data.query;
      handleSendMessage(); // Auto trigger chat
    } else {
      console.warn('Transcription failed:', data.error);
    }
  } catch (err) {
    console.error('Transcription networking error:', err);
  } finally {
    searchInput.placeholder = ogPlaceholder;
  }
}

function encodeWAV(samplesArray, sampleRate) {
  let length = 0;
  samplesArray.forEach(buffer => { length += buffer.length; });
  
  const buffer = new ArrayBuffer(44 + length * 2);
  const view = new DataView(buffer);

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + length * 2, true);
  writeString(view, 8, 'WAVE');
  
  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, 16, true); // Bits per sample
  
  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samplesArray.length; i++) {
    const samples = samplesArray[i];
    for (let j = 0; j < samples.length; j++) {
      let s = Math.max(-1, Math.min(1, samples[j]));
      // 16-bit integer conversion
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: 'audio/wav' });
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// ----------------------------------------------------------------------------
// TABS & AI ANALYSIS WORKSPACE
// ----------------------------------------------------------------------------

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      // Set active
      btn.classList.add('active');
      const targetId = `tab-${btn.dataset.tab}`;
      document.getElementById(targetId).classList.add('active');
    });
  });

  // Setup AI Analysis specific elements
  setupAnalysisControls();
}

// ----------------------------------------------------------------------------
// AI ANALYSIS REACTIVE SEARCH, FILTERING, SORTING & BULK CONTROLS
// ----------------------------------------------------------------------------

// Reactive state
let currentAnalysisPage = 1;
let totalAnalysisPages = 1;
const analysisLimit = 25; // 25 items per page in sidebar
let analysisSearchQuery = '';
let analysisActiveFilter = 'all';
let analysisSortCriteria = 'default';
const selectedAnalysisSkus = new Set();
const bulkAnalyzingSkus = new Set();
let searchDebounceTimer = null;

function setupAnalysisControls() {
  const searchInput = document.getElementById('analysis-search');
  const searchClearBtn = document.getElementById('analysis-search-clear');
  const filterBtns = document.querySelectorAll('.analysis-filters .filter-pill');
  const sortSelect = document.getElementById('analysis-sort');
  const selectAllCheckbox = document.getElementById('analysis-select-all');
  const bulkBtn = document.getElementById('analysis-bulk-btn');
  const prevPageBtn = document.getElementById('analysis-prev-page');
  const nextPageBtn = document.getElementById('analysis-next-page');

  // Search Input Event (Debounced & Global)
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      analysisSearchQuery = e.target.value.trim();
      if (searchClearBtn) {
        searchClearBtn.style.display = analysisSearchQuery ? 'flex' : 'none';
      }
      
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(() => {
        currentAnalysisPage = 1;
        loadProductsForAnalysis();
      }, 300);
    });
  }

  // Clear Search button
  if (searchClearBtn) {
    searchClearBtn.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        analysisSearchQuery = '';
        searchClearBtn.style.display = 'none';
        currentAnalysisPage = 1;
        loadProductsForAnalysis();
      }
    });
  }

  // Status Filter Pills
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      analysisActiveFilter = btn.dataset.filter;
      currentAnalysisPage = 1;
      loadProductsForAnalysis();
    });
  });

  // Sort Selection
  if (sortSelect) {
    sortSelect.addEventListener('change', (e) => {
      analysisSortCriteria = e.target.value;
      currentAnalysisPage = 1;
      loadProductsForAnalysis();
    });
  }

  // Select All Checkbox (Current Page's Pending Items)
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', (e) => {
      if (activeBulkAnalyzing) return; // Ignore during active ingestion
      
      const pendingVisible = allAnalysisProducts.filter(p => !p.is_analyzed);
      if (e.target.checked) {
        pendingVisible.forEach(p => selectedAnalysisSkus.add(p.sku));
      } else {
        pendingVisible.forEach(p => selectedAnalysisSkus.delete(p.sku));
      }
      
      // Re-render list to reflect selected states
      renderAnalysisProductList(allAnalysisProducts);
      updateBulkActionButtonState();
    });
  }

  // Bulk Ingestion Button trigger
  if (bulkBtn) {
    bulkBtn.addEventListener('click', () => {
      if (selectedAnalysisSkus.size === 0 || activeBulkAnalyzing) return;
      triggerBulkAnalysis();
    });
  }

  // Pagination Controls Click Handlers
  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (activeBulkAnalyzing || currentAnalysisPage <= 1) return;
      currentAnalysisPage--;
      loadProductsForAnalysis();
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      if (activeBulkAnalyzing || currentAnalysisPage >= totalAnalysisPages) return;
      currentAnalysisPage++;
      loadProductsForAnalysis();
    });
  }
}

// Shell helpers to maintain compatibility with other references
function filterAndRenderAnalysisProducts() {
  renderAnalysisProductList(allAnalysisProducts);
  updateSelectAllCheckboxState(allAnalysisProducts);
  updateBulkActionButtonState();
}

function renderFilteredListOnly() {
  renderAnalysisProductList(allAnalysisProducts);
}

function updateSelectAllCheckboxState(visibleProducts) {
  const selectAllCheckbox = document.getElementById('analysis-select-all');
  const selectAllLabel = document.getElementById('analysis-select-all-label');
  if (!selectAllCheckbox) return;

  const pendingVisible = visibleProducts.filter(p => !p.is_analyzed);
  if (pendingVisible.length === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.disabled = true;
    if (selectAllLabel) selectAllLabel.innerText = "Select All (0)";
    return;
  }

  selectAllCheckbox.disabled = activeBulkAnalyzing;
  
  // Check if all visible pending products are in our selection set
  const allChecked = pendingVisible.every(p => selectedAnalysisSkus.has(p.sku));
  selectAllCheckbox.checked = allChecked;

  if (selectAllLabel) {
    selectAllLabel.innerText = `Select Pending (${pendingVisible.length})`;
  }
}

function updateBulkActionButtonState() {
  const bulkBtn = document.getElementById('analysis-bulk-btn');
  const countSpan = document.getElementById('bulk-count');
  if (!bulkBtn) return;

  const count = selectedAnalysisSkus.size;
  if (countSpan) countSpan.innerText = count;

  bulkBtn.disabled = (count === 0 || activeBulkAnalyzing);
}

function queueForAnalysis(sku) {
  // Auto switch to analysis tab
  const tabBtn = document.querySelector('[data-tab="analysis"]');
  if (tabBtn) tabBtn.click();
  
  // Reset filter to 'all' to ensure the product matches global search
  const filterAllBtn = document.querySelector('.analysis-filters .filter-pill[data-filter="all"]');
  if (filterAllBtn) {
    document.querySelectorAll('.analysis-filters .filter-pill').forEach(b => b.classList.remove('active'));
    filterAllBtn.classList.add('active');
    analysisActiveFilter = 'all';
  }

  // Set search text to SKU so it queries specifically
  const searchInput = document.getElementById('analysis-search');
  if (searchInput) {
    searchInput.value = sku;
    analysisSearchQuery = sku;
    const searchClearBtn = document.getElementById('analysis-search-clear');
    if (searchClearBtn) searchClearBtn.style.display = 'flex';
  }

  currentAnalysisPage = 1;
  
  // Load products matching this specific SKU globally
  loadProductsForAnalysis().then(() => {
    const p = loadedProductsMap.get(sku) || allAnalysisProducts.find(item => item.sku === sku);
    if (p) {
      let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
      if (p.image_urls && p.image_urls.length > 0) {
        imageUrl = `/api/proxy-image?url=${encodeURIComponent(p.image_urls[0])}`;
      }
      selectProductForAnalysis(p, imageUrl);

      // Highlight list item visually
      setTimeout(() => {
        document.querySelectorAll('.analysis-product-item').forEach(el => {
          const skuEl = el.querySelector('.api-sku');
          if (skuEl && skuEl.innerText.trim() === sku) {
            el.classList.add('active');
          }
        });
      }, 100);
    }
  });
}

async function loadProductsForAnalysis() {
  try {
    const container = document.getElementById('analysis-product-list');
    if (container && currentAnalysisPage === 1) {
      container.innerHTML = `
        <div class="loading-state" style="padding: 40px 0; text-align:center;">
          <div class="spinner" style="width: 24px; height: 24px; margin: 0 auto; border-top-color: var(--gold-primary);"></div>
          <p style="color: var(--gold-primary); font-size: 11px; margin-top: 8px;">Loading catalogue...</p>
        </div>
      `;
    }

    const url = `/api/products?page=${currentAnalysisPage}&limit=${analysisLimit}&search=${encodeURIComponent(analysisSearchQuery)}&sort=${analysisSortCriteria}&filter=${analysisActiveFilter}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data && data.products) {
      allAnalysisProducts = data.products;
      totalAnalysisPages = data.totalPages || 1;
      currentAnalysisPage = data.page || 1;

      allAnalysisProducts.forEach(p => {
        loadedProductsMap.set(p.sku, p);
      });

      renderAnalysisProductList(allAnalysisProducts);
      updatePaginationControls();
      updateSelectAllCheckboxState(allAnalysisProducts);
      updateBulkActionButtonState();
    }
  } catch (err) {
    console.error('Failed to load products for analysis:', err);
  }
}

function updatePaginationControls() {
  const prevBtn = document.getElementById('analysis-prev-page');
  const nextBtn = document.getElementById('analysis-next-page');
  const infoSpan = document.getElementById('analysis-page-info');

  if (prevBtn) {
    prevBtn.disabled = (currentAnalysisPage <= 1);
  }
  if (nextBtn) {
    nextBtn.disabled = (currentAnalysisPage >= totalAnalysisPages);
  }
  if (infoSpan) {
    infoSpan.innerText = `Page ${currentAnalysisPage} of ${totalAnalysisPages}`;
  }
}

function renderAnalysisProductList(products) {
  const container = document.getElementById('analysis-product-list');
  if (!container) return;

  container.innerHTML = '';
  
  if (products.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 20px; text-align:center; color: var(--text-muted); font-size:12px;">
        <i class="fa-solid fa-folder-open" style="font-size:24px; margin-bottom:8px; display:block;"></i>
        No matching products found.
      </div>
    `;
    return;
  }

  products.forEach(p => {
    const el = document.createElement('div');
    el.className = 'analysis-product-item';
    if (bulkAnalyzingSkus.has(p.sku)) {
      el.className += ' is-loading-analysis';
    }
    
    // Proxy image
    let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
    if (p.image_urls && p.image_urls.length > 0) {
      imageUrl = `/api/proxy-image?url=${encodeURIComponent(p.image_urls[0])}`;
    }

    const statusHtml = p.is_analyzed 
      ? `<span class="api-status analyzed"><i class="fa-solid fa-check-circle"></i> Analyzed</span>`
      : bulkAnalyzingSkus.has(p.sku)
        ? `<span class="api-status"><i class="fa-solid fa-spinner"></i> Ingesting...</span>`
        : `<span class="api-status"><i class="fa-solid fa-clock"></i> Pending</span>`;

    const isChecked = selectedAnalysisSkus.has(p.sku);
    const checkedAttr = isChecked ? 'checked' : '';
    
    // Checkbox is only for pending items
    const checkboxHtml = !p.is_analyzed 
      ? `
        <div class="item-select-wrapper" onclick="event.stopPropagation();">
          <label class="custom-checkbox-container">
            <input type="checkbox" class="product-item-checkbox" data-sku="${p.sku}" ${checkedAttr}>
            <span class="checkbox-checkmark"></span>
          </label>
        </div>
      `
      : `<div style="width: 16px;"></div>`; // spacing placeholder

    el.innerHTML = `
      ${checkboxHtml}
      <img src="${imageUrl}" class="api-thumb" alt="${p.sku}" loading="lazy" />
      <div class="api-details">
        <div class="api-name" title="${p.name}">${p.name}</div>
        <div class="api-sku">${p.sku}</div>
        ${statusHtml}
      </div>
    `;

    // Click handler to select product
    el.addEventListener('click', () => {
      if (activeBulkAnalyzing) return; // Prevent selection changes during active ingestion
      document.querySelectorAll('.analysis-product-item').forEach(i => i.classList.remove('active'));
      el.classList.add('active');
      selectProductForAnalysis(p, imageUrl);
    });

    // Checkbox toggle handler
    const cb = el.querySelector('.product-item-checkbox');
    if (cb) {
      cb.addEventListener('change', (e) => {
        if (e.target.checked) {
          selectedAnalysisSkus.add(p.sku);
        } else {
          selectedAnalysisSkus.delete(p.sku);
        }
        updateSelectAllCheckboxState(products);
        updateBulkActionButtonState();
      });
    }

    container.appendChild(el);
  });
}

// ----------------------------------------------------------------------------
// HERMES EDITORIAL NARRATIVE SECTION PARSER
// ----------------------------------------------------------------------------

function parseNarrativeToTabs(description, p = {}) {
  // Try to parse as JSON first (Premium Format)
  try {
    const cleanJson = description.replace(/^```json\n/, '').replace(/\n```$/, '').trim();
    if (cleanJson.startsWith('{')) {
      const data = JSON.parse(cleanJson);
      
      // Validation: Ensure required nested objects exist to prevent template crashes
      const identification = data.identification || data.jewellery_identification || {};
      const design = data.design || data.design_language_analysis || {};
      const hierarchy = data.hierarchy || data.visual_dominance_analysis || {};
      const materials = data.materials || data.stone_and_embellishment_analysis || {};
      const metal = data.metal || data.metal_and_finish_analysis || {};
      const craftsmanship = data.craftsmanship || data.indian_craftsmanship_cues || {};
      const motifs = data.motifs || data.motif_and_symbolism_analysis || {};
      const styling = data.styling || data.indian_styling_outfit_pairing || {};
      const story = data.story || data.final_luxury_catalogue_description || {};
      const scale = data.scale || data.scale_and_wearability_perception || {};
      const occasions = data.occasions || data.occasion_mapping_ratings_out_of_10 || {};
      const profile = data.profile || data.target_customer_profile || {};
      const movement = data.movement || data.movement_profile || {};
      const body = data.body || data.body_suitability || {};
      const colors = data.colors || data.color_system || {};
      const meenakari = data.meenakari || data.meenakari_surface_technique_deep_dive || {};
      const regional = data.regional || data.regional_influence_analysis || [];
      const structural = data.structural || data.structural_breakdown || {};

      return {
        isJson: true,
        curatorNote: data.curatorNote || story.emotional_indian_luxury_sentence || 'A bespoke design representing the highest tiers of luxury metalworking and Indriya craft.',
        identity: story.vibe || design.overall_visual_identity || '',
        identification,
        design,
        hierarchy,
        materials,
        metal,
        craftsmanship,
        indian_craftsmanship_cues: craftsmanship,
        motifs,
        styling,
        story,
        scale,
        occasions,
        occasion_mapping_ratings_out_of_10: occasions,
        profile,
        movement,
        body,
        colors,
        meenakari,
        regional,
        structural,
        structural_breakdown: structural,
        // Ensure consistent text properties for template fallback
        materialsText: (craftsmanship.techniques?.join(', ') || '') + (craftsmanship.details ? ` \n${craftsmanship.details}` : '') || `Gold: ${p.gold_weight_numeric || 0}g, Diamond: ${p.diamond_weight_numeric || 0}ct`,
        motifsText: motifs.motif_details?.map(m => `<div style="margin-bottom:8px;"><strong>${m.motif_name}</strong> <span style="font-size:10px; opacity:0.7; text-transform:uppercase;">(${m.prominence})</span>: ${m.symbolic_cultural_association}</div>`).join('') || (p.collection ? `Collection: ${p.collection}` : 'Heritage design motifs.'),
        stylingText: [...(styling.outfit_pairings || []), ...(styling.festive_styling || []), ...(styling.sarees || []), ...(styling.lehengas || [])].join(', ') || 'Ideal for festive and special occasions.'
      };
    }
  } catch (e) {
    console.warn('Analysis is not valid JSON, falling back to legacy Markdown parser.');
  }

  // Legacy Markdown Parser Fallback
  let identity = '';
  let materials = '';
  let motifs = '';
  let styling = '';
  let curatorNote = '';

  if (!description) {
    return { identity, materials, motifs, styling, curatorNote };
  }

  const lines = description.split('\n');
  let currentTab = 'identity';

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      const heading = trimmed.replace(/^#+\s*/, '').toLowerCase();
      if (heading.includes('material') || heading.includes('craftsmanship') || heading.includes('purity') || heading.includes('specifications')) {
        currentTab = 'materials';
        continue;
      } else if (heading.includes('motif') || heading.includes('symbolism') || heading.includes('theme') || heading.includes('pattern')) {
        currentTab = 'motifs';
        continue;
      } else if (heading.includes('style') || heading.includes('styling') || heading.includes('pairing') || heading.includes('wear') || heading.includes('occasion')) {
        currentTab = 'styling';
        continue;
      } else if (heading.includes('identity') || heading.includes('design') || heading.includes('concept') || heading.includes('heritage') || heading.includes('story')) {
        currentTab = 'identity';
        continue;
      }
    }

    if (currentTab === 'identity') identity += line + '\n';
    else if (currentTab === 'materials') materials += line + '\n';
    else if (currentTab === 'motifs') motifs += line + '\n';
    else if (currentTab === 'styling') styling += line + '\n';
  }

  if (!materials.trim() && !motifs.trim() && !styling.trim()) {
    const paragraphs = description.split(/\n\s*\n/).filter(p => p.trim());
    if (paragraphs.length >= 4) {
      identity = paragraphs[0] + '\n\n' + (paragraphs[1] || '');
      materials = paragraphs[2] || '';
      motifs = paragraphs[3] || '';
      styling = paragraphs.slice(4).join('\n\n');
    } else {
      identity = description;
    }
  }

  const cleanFirstSection = (identity || description).replace(/#+\s*[A-Za-z\s]+/g, '').trim();
  const sentences = cleanFirstSection.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length > 0) {
    curatorNote = sentences[0].trim();
  } else {
    curatorNote = `A bespoke design representing the highest tiers of luxury metalworking and Indriya craft.`;
  }

  return {
    isJson: false,
    identity: identity.trim() || 'No explicit identity narrative found.',
    materialsText: materials.trim() || 'Specifications details listed on the sidebar card spec sheet.',
    motifsText: motifs.trim() || 'A masterpiece featuring timeless design motifs and local traditional forms.',
    stylingText: styling.trim() || 'Recommended styling: pair with exquisite ethnic silks or fusion gowns.',
    materials: {}, motifs: {}, styling: {}, design: {}, // empty objects to prevent crashes in template
    curatorNote
  };
}

// ----------------------------------------------------------------------------
// EXPERT HERITAGE DOSSIER RENDERER
// ----------------------------------------------------------------------------

function selectProductForAnalysis(product, imageUrl, pushState = true) {
  const welcome = document.getElementById('analysis-welcome');
  const dossier = document.getElementById('analysis-dossier');
  
  welcome.classList.add('hidden');
  dossier.classList.remove('hidden');

  if (pushState) {
    window.history.pushState({ sku: product.sku }, `Analysis - ${product.sku}`, `#/analysis/${product.sku}`);
  }

  let contentHtml = '';
  let metaHtml = '';

  if (product.is_analyzed) {
    const narrative = parseNarrativeToTabs(product.ai_description, product);

    // Build metric calculations
    const goldW = (product.gold_weight_numeric !== null && product.gold_weight_numeric !== undefined) ? `${product.gold_weight_numeric}g` : 'N/A';
    const platW = (product.platinum_weight_numeric !== null && product.platinum_weight_numeric !== undefined) ? `${product.platinum_weight_numeric}g` : 'N/A';
    const diaW = (product.diamond_weight_numeric !== null && product.diamond_weight_numeric !== undefined) ? `${product.diamond_weight_numeric}ct` : 'N/A';
    const gemType = product.gemstone_type || 'None';
    const gemW = (product.gemstone_weight_numeric !== null && product.gemstone_weight_numeric !== undefined) ? `${product.gemstone_weight_numeric}ct` : 'N/A';

    // Dynamic artisan tag generator
    let artisanBadges = '';
    const descText = (product.ai_description || '').toLowerCase();
    if (descText.includes('filigree')) artisanBadges += `<span class="dossier-badge-tag"><i class="fa-solid fa-fan"></i> Filigree</span>`;
    if (descText.includes('meenakari') || descText.includes('enamel')) artisanBadges += `<span class="dossier-badge-tag"><i class="fa-solid fa-palette"></i> Meenakari</span>`;
    if (descText.includes('nakashi') || descText.includes('engrav')) artisanBadges += `<span class="dossier-badge-tag"><i class="fa-solid fa-hammer"></i> Nakashi Craft</span>`;
    if (descText.includes('kundan') || descText.includes('jadau')) artisanBadges += `<span class="dossier-badge-tag"><i class="fa-solid fa-crown"></i> Kundan Setting</span>`;
    if (descText.includes('jaali') || descText.includes('pierc')) artisanBadges += `<span class="dossier-badge-tag"><i class="fa-solid fa-border-all"></i> Jaali Openwork</span>`;
    if (!artisanBadges) {
      artisanBadges = `<span class="dossier-badge-tag"><i class="fa-solid fa-sparkles"></i> High Polished</span><span class="dossier-badge-tag"><i class="fa-solid fa-gem"></i> Claw Prong Setting</span>`;
    }

    // Dynamic motifs extractor
    let motifChips = '';
    if (descText.includes('peacock') || descText.includes('mayur')) motifChips += `<span class="dossier-badge-tag"><i class="fa-solid fa-feather"></i> Mayur (Peacock)</span>`;
    if (descText.includes('lotus') || descText.includes('kamal')) motifChips += `<span class="dossier-badge-tag"><i class="fa-solid fa-seedling"></i> Kamal (Lotus)</span>`;
    if (descText.includes('floral') || descText.includes('flower') || descText.includes('phool')) motifChips += `<span class="dossier-badge-tag"><i class="fa-solid fa-leaf"></i> Floral Motifs</span>`;
    if (descText.includes('crescent') || descText.includes('moon') || descText.includes('chandra')) motifChips += `<span class="dossier-badge-tag"><i class="fa-solid fa-moon"></i> Chandra (Crescent)</span>`;
    if (descText.includes('elephant') || descText.includes('gaja')) motifChips += `<span class="dossier-badge-tag"><i class="fa-solid fa-republican"></i> Gaja (Elephant)</span>`;
    if (!motifChips) {
      motifChips = `<span class="dossier-badge-tag"><i class="fa-solid fa-cubes"></i> Geometric Patterns</span><span class="dossier-badge-tag"><i class="fa-solid fa-shapes"></i> Royal Medallions</span>`;
    }

    
    // Build Identity HTML
    const idHtml = `
      ${!narrative.isJson ? `
        <div class="legacy-warning-pill">
          <i class="fa-solid fa-triangle-exclamation"></i> Legacy Format - Re-Analyze for Enhanced Dossier
        </div>
      ` : ''}

      <div class="dossier-section">
        <div class="section-label">Jewellery Identification</div>
        <div class="dossier-grid">
          <div class="dossier-item">
            <div class="item-label">Indian Category</div>
            <div class="item-value">${narrative.identification?.indian_category_name || 'Fine Jewellery'}</div>
          </div>
          <div class="dossier-item">
            <div class="item-label">Traditional Names</div>
            <div class="item-value">${(narrative.identification?.traditional_name_variations || []).join(', ') || 'N/A'}</div>
          </div>
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label">Emotional Narrative & Vibe</div>
        <p class="section-text">${narrative.identity || 'No detailed narrative available.'}</p>
      </div>
      
      <div class="dossier-grid">
        <div class="dossier-item">
          <div class="item-label">Visual Identity</div>
          <div class="item-value">${narrative.design?.overall_visual_identity || (narrative.isJson ? 'N/A' : 'Traditional')}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Design Era</div>
          <div class="item-value">${narrative.design?.design_era_reference || (narrative.isJson ? 'N/A' : 'Contemporary')}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Ornamental Richness</div>
          <div class="item-value">${narrative.design?.ornamental_richness_level || (narrative.isJson ? 'N/A' : 'Intricate')}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Heritage Cues</div>
          <div class="item-value">${narrative.design?.heritage_cues || (narrative.isJson ? 'N/A' : 'Royal Heritage')}</div>
        </div>
      </div>

      <div class="dossier-section highlight-box">
        <div class="section-label"><i class="fas fa-eye"></i> Visual Dominance Analysis</div>
        <div class="hierarchy-content">
          <div class="hierarchy-main"><strong>First Read:</strong> ${narrative.hierarchy?.first_read_dominance || 'Exquisite craftsmanship and balanced design.'}</div>
          <div class="hierarchy-meters">
            ${narrative.isJson && narrative.hierarchy?.surface_split_percentages ? Object.entries(narrative.hierarchy.surface_split_percentages).map(([key, val]) => `
              <div class="meter-row">
                <span class="meter-label">${key.replace('_', ' ')}</span>
                <div class="meter-bar-bg"><div class="meter-bar-fill" style="width: ${val}"></div></div>
                <span class="meter-val">${val}</span>
              </div>
            `).join('') : `
              <div class="meter-row">
                <span class="meter-label">Gold Work</span>
                <div class="meter-bar-bg"><div class="meter-bar-fill" style="width: 70%"></div></div>
                <span class="meter-val">70%</span>
              </div>
              <div class="meter-row">
                <span class="meter-label">Stone Setting</span>
                <div class="meter-bar-bg"><div class="meter-bar-fill" style="width: 30%"></div></div>
                <span class="meter-val">30%</span>
              </div>
            `}
          </div>
        </div>
      </div>

      ${narrative.regional && narrative.regional.length > 0 ? `
        <div class="dossier-section">
          <div class="section-label">Regional Influences</div>
          <div class="tag-cloud">
            ${narrative.regional.map(r => `<span class="tag-chip">${r}</span>`).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Build Materials HTML
    const matHtml = `
      <div class="dossier-grid">
        <div class="dossier-item">
          <div class="item-label">Metal Type</div>
          <div class="item-value">${narrative.metal?.metal_type_and_karat || (narrative.isJson ? 'N/A' : (product.purity || '18K Gold'))}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Metal Tone</div>
          <div class="item-value">${narrative.metal?.metal_tone || (narrative.isJson ? 'N/A' : 'Lustrous Gold')}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Polish Level</div>
          <div class="item-value">${narrative.metal?.polish_level || 'High Polish'}</div>
        </div>
      </div>

      <div class="dossier-section highlight-box">
        <div class="section-label"><i class="fas fa-palette"></i> Color System & Impression</div>
        <div class="hierarchy-content">
          <p><strong>Dominant Impression:</strong> ${narrative.colors?.dominant_color_impression || 'N/A'}</p>
          <div class="tag-cloud">
             ${(narrative.colors?.stone_colors || []).map(c => `<span class="tag-chip" style="border-left: 4px solid ${c}">${c}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label">Stone Inventory</div>
        <div class="stone-grid">
          ${narrative.isJson && (narrative.materials?.stone_inventory || []).length > 0 ? narrative.materials.stone_inventory.map(stone => `
            <div class="stone-card">
              <div class="stone-name">${stone.name_english} <small>(${stone.name_indian_hindi || ''})</small></div>
              <div class="stone-details">
                <span><strong>Cut:</strong> ${stone.cut_style || 'N/A'}</span>
                <span><strong>Setting:</strong> ${stone.setting_style || 'N/A'}</span>
                <span><strong>Color:</strong> ${stone.color_plain_language || 'N/A'}</span>
              </div>
            </div>
          `).join('') : `
            <div class="stone-card">
              <div class="stone-name">${product.diamond_weight_numeric > 0 ? 'Brilliant Diamonds' : 'Heritage Gemstones'}</div>
              <div class="stone-details">
                <span><strong>Weight:</strong> ${product.diamond_weight_numeric > 0 ? product.diamond_weight_numeric + 'ct' : 'See Specs'}</span>
                <span><strong>Setting:</strong> Master Artisan Prong</span>
              </div>
            </div>
          `}
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label">Master Craftsmanship & Techniques</div>
        <div class="tag-cloud">
          ${narrative.isJson && (narrative.craftsmanship?.techniques || []).length > 0 ? (narrative.craftsmanship.techniques.map(t => `<span class="tag-chip highlight">${t}</span>`).join('')) : `
            <span class="tag-chip">Hand-Finished</span>
            <span class="tag-chip">Precision Setting</span>
            <span class="tag-chip">Luxury Polish</span>
          `}
        </div>
        <p class="section-text" style="margin-top: 10px; font-size: 0.9em; opacity: 0.8;">${narrative.craftsmanship?.details || ''}</p>
      </div>

      ${narrative.meenakari?.meenakari_present === 'Yes' ? `
        <div class="dossier-section highlight-box">
          <div class="section-label">Meenakari Deep Dive</div>
          <div class="dossier-grid" style="margin-top: 10px;">
            <div class="dossier-item">
              <div class="item-label">School</div>
              <div class="item-value">${narrative.meenakari.school_inference}</div>
            </div>
            <div class="dossier-item">
              <div class="item-label">Appearance</div>
              <div class="item-value">${narrative.meenakari.technique_appearance}</div>
            </div>
          </div>
        </div>
      ` : ''}
    `;

    // Build Motifs HTML
    const motHtml = `
      <div class="dossier-section">
        <div class="section-label"><i class="fa-solid fa-sparkles"></i> Motif Details & Prominence</div>
        <div class="stone-grid">
          ${(narrative.motifs?.motif_details || []).map(m => {
            const prominence = (m.prominence || 'Secondary').toLowerCase();
            const prominenceClass = prominence.includes('primary') ? 'prominence-primary' : 
                                   (prominence.includes('subtle') ? 'prominence-subtle' : 'prominence-secondary');
            
            // Visual prominence meter value (100% for primary, 60% for secondary, 30% for subtle)
            const meterWidth = prominence.includes('primary') ? '100%' : (prominence.includes('subtle') ? '30%' : '65%');
            
            return `
              <div class="motif-card">
                <div class="motif-header">
                  <div class="motif-title"><i class="fa-solid fa-gem" style="font-size: 10px; opacity:0.6; margin-right:4px;"></i> ${m.motif_name}</div>
                  <span class="prominence-badge ${prominenceClass}">${m.prominence}</span>
                </div>
                
                <div class="dossier-rating-bar" style="margin-bottom: 4px;">
                  <div class="dossier-rating-bg" style="height: 2px;">
                    <div class="dossier-rating-fill" style="width: ${meterWidth}; opacity: 0.8;"></div>
                  </div>
                </div>

                <div class="motif-meaning">
                  ${m.symbolic_cultural_association}
                </div>
              </div>
            `;
          }).join('') || '<p class="section-text">Detailed motif analysis highlights traditional forms and organic patterns.</p>'}
        </div>
      </div>

      <div class="motifs-categorized">
        <div class="motif-cat">
          <div class="motif-cat-label"><i class="fas fa-leaf"></i> Floral & Botanical</div>
          <div class="tag-cloud">
            ${[...(narrative.motifs?.floral_motifs || []), ...(narrative.motifs?.botanical_nature_motifs || [])]
              .map(m => `<span class="tag-chip">${m}</span>`).join('') || '<span class="tag-chip">Organic Elements</span>'}
          </div>
        </div>
        <div class="motif-cat">
          <div class="motif-cat-label"><i class="fas fa-dove"></i> Fauna (Animals)</div>
          <div class="tag-cloud">
            ${(narrative.motifs?.fauna_motifs || []).map(m => `<span class="tag-chip">${m}</span>`).join('') || '<span class="tag-chip">Heritage Fauna</span>'}
          </div>
        </div>
        <div class="motif-cat">
          <div class="motif-cat-label"><i class="fas fa-shapes"></i> Geometric & Cosmic</div>
          <div class="tag-cloud">
            ${[...(narrative.motifs?.geometric_motifs || []), ...(narrative.motifs?.celestial_cosmic_motifs || [])]
              .map(m => `<span class="tag-chip">${m}</span>`).join('') || '<span class="tag-chip">Classic Symmetry</span>'}
          </div>
        </div>
        <div class="motif-cat">
          <div class="motif-cat-label"><i class="fas fa-gopuram"></i> Heritage & Temple</div>
          <div class="tag-cloud">
            ${(narrative.motifs?.heritage_temple_deity_motifs || []).map(m => `<span class="tag-chip">${m}</span>`).join('') || '<span class="tag-chip">Divine Cues</span>'}
          </div>
        </div>
      </div>
    `;

    // Build Styling HTML
    const styHtml = `
      <div class="dossier-grid">
        <div class="dossier-item">
          <div class="item-label">Scale</div>
          <div class="item-value">${narrative.scale?.scale || 'Standard'}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Weight Appearance</div>
          <div class="item-value">${narrative.scale?.weight_appearance || 'Substantial'}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Practicality</div>
          <div class="item-value">${narrative.scale?.daily_wear_practicality || 'Occasional'}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Comfort</div>
          <div class="item-value">${narrative.scale?.comfort_perception || 'High'}</div>
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label">Outfit & Ensemble Pairings</div>
        <div class="tag-cloud">
          ${(() => {
            const styling = narrative.styling || {};
            const pairings = [
              ...(styling.outfit_pairings || []),
              ...(styling.sarees || []),
              ...(styling.lehengas || []),
              ...(styling.festive_styling || [])
            ];
            return pairings.length > 0 
              ? [...new Set(pairings)].map(p => `<span class="tag-chip">${p}</span>`).join('')
              : '<span class="tag-chip">Traditional Indian Ensembles</span><span class="tag-chip">Silk Sarees</span>';
          })()}
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label"><i class="fa-solid fa-calendar-check"></i> Primary Occasions</div>
        <div class="tag-cloud">
          ${(() => {
            const occasions = narrative.occasions || {};
            return Object.entries(occasions)
              .filter(([_, rating]) => rating >= 7)
              .sort((a, b) => b[1] - a[1])
              .map(([name, _]) => `<span class="tag-chip highlight">${name.replace(/_/g, ' ')}</span>`)
              .join('') || '<span class="tag-chip highlight">Versatile Luxury</span>';
          })()}
        </div>
      </div>

      <div class="dossier-section highlight-box">
        <div class="section-label"><i class="fa-solid fa-arrows-to-circle"></i> Movement & Fluidity</div>
        <div class="dossier-grid">
           <div class="dossier-item">
             <div class="item-label">Swing</div>
             <div class="item-value">${narrative.movement?.static_fluid_swing || 'Graceful'}</div>
           </div>
           <div class="dossier-item">
             <div class="item-label">Sound</div>
             <div class="item-value">${narrative.movement?.ghungroo_sound || 'Silent'}</div>
           </div>
           <div class="dossier-item" style="grid-column: span 2;">
             <div class="item-label">In Motion</div>
             <div class="item-value">${narrative.movement?.movement_during_walking || 'Subtle radiance'}</div>
           </div>
        </div>
      </div>

      <div class="dossier-section highlight-box">
        <div class="section-label"><i class="fa-solid fa-chart-line"></i> Detailed Occasion Mapping</div>
        <div class="rating-grid">
          ${(() => {
            const occasionIcons = {
              'wedding_guest': 'fa-solid fa-people-group',
              'bridal_wear': 'fa-solid fa-crown',
              'festive_wear': 'fa-solid fa-om',
              'daily_wear': 'fa-solid fa-sun',
              'office_wear': 'fa-solid fa-briefcase',
              'karwa_chauth': 'fa-solid fa-moon',
              'diwali': 'fa-solid fa-lamp',
              'sangeet': 'fa-solid fa-music',
              'mehendi': 'fa-solid fa-hands-holding-diamond',
              'reception_cocktail': 'fa-solid fa-glass-martini-alt',
              'temple_visits': 'fa-solid fa-place-of-worship',
              'traditional_family_functions': 'fa-solid fa-house-chimney-window',
              'gifting': 'fa-solid fa-gift',
              'eid': 'fa-solid fa-star-and-crescent',
              'elevated_essentials': 'fa-solid fa-gem'
            };
            
            if (narrative.isJson && narrative.occasion_mapping_ratings_out_of_10) {
              return Object.entries(narrative.occasion_mapping_ratings_out_of_10)
                .filter(([_, rating]) => rating > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([name, rating]) => {
                  const icon = occasionIcons[name] || 'fa-solid fa-calendar-star';
                  return `
                    <div class="rating-item">
                      <div class="rating-label">
                        <span><i class="${icon}" style="margin-right:8px; width:16px; color:var(--gold-primary);"></i> ${name.replace(/_/g, ' ')}</span>
                        <span class="rating-num">${rating}/10</span>
                      </div>
                      <div class="rating-bar-bg"><div class="rating-bar-fill" style="width: ${rating * 10}%"></div></div>
                    </div>
                  `;
                }).join('');
            } else {
              return `
                <div class="rating-item">
                  <div class="rating-label">
                    <span><i class="fa-solid fa-om" style="margin-right:8px; width:16px; color:var(--gold-primary);"></i> Festive Wear</span>
                    <span class="rating-num">8/10</span>
                  </div>
                  <div class="rating-bar-bg"><div class="rating-bar-fill" style="width: 80%"></div></div>
                </div>
              `;
            }
          })()}
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label"><i class="fa-solid fa-layer-group"></i> Structural & Craftsmanship Insights</div>
        <div class="insight-grid">
          ${[
            { label: 'Silhouette', value: narrative.structural_breakdown?.main_silhouette },
            { label: 'Symmetry', value: narrative.structural_breakdown?.symmetry },
            { label: 'Density', value: narrative.structural_breakdown?.openwork_vs_dense },
            { label: 'Dangling', value: narrative.structural_breakdown?.dangling_elements },
            { label: 'Filigree', value: narrative.structural_breakdown?.filigree_quality },
            { label: 'Artisan Finish', value: narrative.indian_craftsmanship_cues?.artisan_detailing_level },
            { label: 'Intricacy', value: narrative.indian_craftsmanship_cues?.handcrafted_intricacy_level }
          ].filter(i => i.value && i.value !== '...').map(i => `
            <div class="structural-card">
              <span class="struct-label">${i.label}</span>
              <span class="struct-value">${i.value}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="dossier-grid">
        <div class="dossier-item">
          <div class="item-label">Age Range</div>
          <div class="item-value">${narrative.profile?.likely_age_range || 'N/A'}</div>
        </div>
        <div class="dossier-item">
          <div class="item-label">Style Persona</div>
          <div class="item-value">${narrative.profile?.traditional_vs_modern || 'Heritage Lover'}</div>
        </div>
      </div>

      <div class="dossier-section">
        <div class="section-label">Body Suitability</div>
        <div class="tag-cloud">
           ${[...(narrative.body?.skin_tones || []), ...(narrative.body?.face_shapes || [])].map(b => `<span class="tag-chip">${b}</span>`).join('')}
        </div>
      </div>
    `;

    contentHtml = `
      <!-- Curator Quote Note -->
      <div class="curator-quote-card">
        <div class="curator-quote-text">${narrative.curatorNote}</div>
      </div>

      <!-- Tab Navigation -->
      <div class="analysis-dossier-tabs-nav">
        <button class="analysis-dossier-tab-btn active" onclick="switchAnalysisDossierTab(event, 'identity')"><i class="fa-solid fa-crown"></i> Design Identity</button>
        <button class="analysis-dossier-tab-btn" onclick="switchAnalysisDossierTab(event, 'materials')"><i class="fa-regular fa-gem"></i> Materials & Craft</button>
        <button class="analysis-dossier-tab-btn" onclick="switchAnalysisDossierTab(event, 'motifs')"><i class="fa-solid fa-sparkles"></i> Motif Symbolism</button>
        <button class="analysis-dossier-tab-btn" onclick="switchAnalysisDossierTab(event, 'styling')"><i class="fa-solid fa-user"></i> Styling Guidelines</button>
      </div>

      <!-- Tab Panels -->
      <div id="anal-tab-identity" class="analysis-dossier-tab-content active">${idHtml}</div>
      <div id="anal-tab-materials" class="analysis-dossier-tab-content">${matHtml}</div>
      <div id="anal-tab-motifs" class="analysis-dossier-tab-content">${motHtml}</div>
      <div id="anal-tab-styling" class="analysis-dossier-tab-content">${styHtml}</div>

      <!-- Refinement Container -->
      <div class="refine-container" style="margin-top: 32px; border-top: 1px solid var(--border-glass); padding-top: 20px;">
        <h4 style="margin-bottom: 8px; font-family: var(--font-display); color: var(--gold-primary);"><i class="fa-solid fa-circle-question"></i> Refine Editorial Perspective</h4>
        <div style="display: flex; gap: 12px; margin-top:10px;">
          <input type="text" id="refine-input-${product.sku}" placeholder="e.g. emphasize the heritage aspects or Jaali work..." style="flex:1; background: var(--bg-dark); border: 1px solid var(--border-glass); padding: 10px 16px; border-radius: var(--radius-sm); color: var(--text-primary); font-size:13px; outline:none; transition: var(--transition-smooth);">
          <button class="btn-primary" onclick="refineAnalysis('${product.sku}')"><i class="fa-solid fa-wand-magic-sparkles"></i> Refine</button>
        </div>
      </div>
    `;
    
    metaHtml = `<button class="btn-secondary" onclick="triggerAnalysis('${product.sku}', '${product.name}', '${product.category || 'Jewellery'}')"><i class="fa-solid fa-rotate"></i> Re-Analyze</button>`;
  } else {
    contentHtml = `
      <div class="empty-state" style="padding: 60px 20px; border:none; background:transparent; text-align:center;">
        <i class="fa-solid fa-microscope" style="font-size: 40px; color: var(--gold-primary); margin-bottom: 16px;"></i>
        <h3 style="color:var(--text-primary); margin-bottom:8px;">Catalogue Ingestion Pending</h3>
        <p style="margin-bottom: 24px; color:var(--text-muted); font-size:14px; max-width:400px; margin-left:auto; margin-right:auto;">This product does not have an AI-driven cultural evaluation dossier generated in the database.</p>
        <button class="btn-primary" onclick="triggerAnalysis('${product.sku}', '${product.name}', '${product.category || 'Jewellery'}')">
          <i class="fa-solid fa-wand-magic-sparkles"></i> Generate AI Dossier
        </button>
      </div>
    `;
  }

  dossier.innerHTML = `
    <div class="dossier-header">
      <img src="${imageUrl}" class="dossier-image" />
      <div class="dossier-meta">
        <h2 class="dossier-title">${product.name}</h2>
        <div class="dossier-sku">SKU: ${product.sku}</div>
        <div class="dossier-actions" style="display: flex; gap: 12px; margin-top: auto; flex-wrap: wrap; align-items: center;">
          ${metaHtml}
          ${product.product_url ? `
            <a href="${product.product_url}" target="_blank" class="btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px;">
              <i class="fa-solid fa-arrow-up-right-from-square"></i> View on Indriya Website
            </a>
          ` : ''}
        </div>
      </div>
    </div>
    <div id="dossier-content-area">
      ${contentHtml}
    </div>
  `;
}

// Global dossier sub-tabs switcher
window.switchAnalysisDossierTab = function(event, tabId) {
  const btn = event.currentTarget;
  const navContainer = btn.parentElement;
  
  // Clear active tab buttons
  Array.from(navContainer.children).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  
  // Hide all panels
  const contentArea = navContainer.parentElement;
  Array.from(contentArea.querySelectorAll('.analysis-dossier-tab-content')).forEach(c => {
    c.classList.remove('active');
  });

  // Show active panel
  const target = contentArea.querySelector(`#anal-tab-${tabId}`);
  if (target) {
    target.classList.add('active');
  }
};

// Refine Analysis logic
window.refineAnalysis = async function refineAnalysis(sku) {
  const inputEl = document.getElementById(`refine-input-${sku}`);
  const feedback = inputEl ? inputEl.value.trim() : '';
  if (!feedback) return;
  
  const p = loadedProductsMap.get(sku) || selectedAnalysisProducts.get(sku);
  if (!p) return;
  
  const currentDescription = p.ai_description || '';
  
  try {
    const btn = inputEl.nextElementSibling;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Refining...';
    btn.disabled = true;

    const response = await fetch('/api/refine-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, currentDescription, feedback })
    });
    const data = await response.json();
    
    if (data.success && data.analysis) {
      p.ai_description = data.analysis;
      p.is_analyzed = true;
      
      // Re-select to render newly refined tabs
      let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
      if (p.image_urls && p.image_urls.length > 0) {
        imageUrl = `/api/proxy-image?url=${encodeURIComponent(p.image_urls[0])}`;
      }
      selectProductForAnalysis(p, imageUrl);
      
      // Update sidebar badge
      filterAndRenderAnalysisProducts();
    } else {
      console.error('Refine failed:', data.error);
      btn.innerHTML = oldHtml;
      btn.disabled = false;
    }
  } catch (err) {
    console.error('Refine network error:', err);
    const btn = inputEl.nextElementSibling;
    if(btn) {
      btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Refine';
      btn.disabled = false;
    }
  }
}

// Single SKU Analysis Ingest Trigger
window.triggerAnalysis = async function(sku, name, category) {
  const contentArea = document.getElementById('dossier-content-area');
  
  contentArea.innerHTML = `
    <div class="loading-state" style="padding: 60px 0; text-align:center;">
      <div class="spinner"></div>
      <p style="color: var(--gold-primary); font-weight: 500; margin-top: 16px;">AI evaluation in progress...</p>
      <p style="font-size: 12px; color: var(--text-muted); margin-top: 8px;">Triggering Mastra and Google Gemini 2.5 Flash agents...</p>
    </div>
  `;

  try {
    const p = loadedProductsMap.get(sku);
    const specs = p ? p.product_specifications : {};

    const res = await fetch('/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, name: p.name, category: p.category || 'Jewellery', specs })
    });
    
    const data = await res.json();
    if (data.success) {
      // Ingestion is asynchronous, so we poll /api/products until the AI description is ready
      let attempts = 0;
      const maxAttempts = 30; // 45 seconds maximum waiting time
      const pollInterval = 1500; // Poll every 1.5 seconds
      
      const poll = async () => {
        try {
          // Fetch products matching the SKU, appending a timestamp to prevent browser-level caching
          const checkRes = await fetch(`/api/products?search=${sku}&_t=${Date.now()}`);
          const checkData = await checkRes.json();
          const updatedProduct = checkData.products?.find(prod => prod.sku === sku);
          
          if (updatedProduct && updatedProduct.is_analyzed && updatedProduct.ai_description) {
            // Update local catalogue state with the complete dossier
            const localProd = loadedProductsMap.get(sku);
            if (localProd) {
              localProd.is_analyzed = true;
              localProd.ai_description = updatedProduct.ai_description;
            }
            
            // Refresh list in sidebar
            filterAndRenderAnalysisProducts();
            
            // Render the completed visual dossier with all tabs fully populated
            let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
            if (localProd && localProd.image_urls && localProd.image_urls.length > 0) {
              imageUrl = `/api/proxy-image?url=${encodeURIComponent(localProd.image_urls[0])}`;
            }
            if (localProd) selectProductForAnalysis(localProd, imageUrl);
          } else if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, pollInterval);
          } else {
            contentArea.innerHTML = `
              <div class="empty-state" style="padding: 40px 20px; text-align:center;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 32px; color: var(--accent-orange); margin-bottom: 12px;"></i>
                <h3 style="color:var(--text-primary); margin-bottom:8px;">Evaluation is taking longer</h3>
                <p style="color:var(--text-muted); font-size:13px; max-width:350px; margin:0 auto 16px auto;">The AI is still processing the design details. Please refresh the sidebar or search this SKU again in a few moments.</p>
                <button class="btn-primary" onclick="selectProductForAnalysis(loadedProductsMap.get('${sku}'), '${p && p.image_urls && p.image_urls.length > 0 ? `/api/proxy-image?url=${encodeURIComponent(p.image_urls[0])}` : ''}')">Return to Product</button>
              </div>
            `;
          }
        } catch (pollErr) {
          console.error('Polling error:', pollErr);
          if (attempts < maxAttempts) {
            attempts++;
            setTimeout(poll, pollInterval);
          } else {
            contentArea.innerHTML = `<div class="dossier-content" style="color: var(--accent-red); text-align:center; padding: 40px 20px;">Failed to fetch updated analysis status.</div>`;
          }
        }
      };
      
      // Start polling
      setTimeout(poll, pollInterval);
    } else {
      contentArea.innerHTML = `<div class="dossier-content" style="color: var(--accent-red); text-align:center; padding: 40px 20px;">Error: ${data.error || 'Failed to analyze'}</div>`;
    }
  } catch (err) {
    console.error(err);
    contentArea.innerHTML = `<div class="dossier-content" style="color: var(--accent-red);">Network Error: Failed to trigger analysis.</div>`;
  }
};

// ----------------------------------------------------------------------------
// BATCH INGESTION RUNNER PIPELINE (BULK ANALYZER)
// ----------------------------------------------------------------------------

let activeBulkAnalyzing = false;

async function triggerBulkAnalysis() {
  if (selectedAnalysisSkus.size === 0 || activeBulkAnalyzing) return;

  const skusToAnalyze = Array.from(selectedAnalysisSkus).filter(sku => {
    const p = loadedProductsMap.get(sku);
    return p && !p.is_analyzed;
  });

  if (skusToAnalyze.length === 0) {
    selectedAnalysisSkus.clear();
    updateBulkActionButtonState();
    return;
  }

  activeBulkAnalyzing = true;
  updateBulkActionButtonState();

  // Show progress elements
  const progressContainer = document.getElementById('analysis-bulk-progress');
  const currentSkuSpan = document.getElementById('bulk-progress-current-sku');
  const currentIdxSpan = document.getElementById('bulk-progress-current-idx');
  const totalSpan = document.getElementById('bulk-progress-total');
  const barFill = document.getElementById('bulk-progress-bar-fill');

  if (progressContainer) progressContainer.classList.remove('hidden');
  if (totalSpan) totalSpan.innerText = skusToAnalyze.length;

  // Disable controls to prevent race conditions during bulk queue runs
  const searchInput = document.getElementById('analysis-search');
  const filterBtns = document.querySelectorAll('.analysis-filters .filter-pill');
  const sortSelect = document.getElementById('analysis-sort');
  const selectAllCheckbox = document.getElementById('analysis-select-all');

  if (searchInput) searchInput.disabled = true;
  if (sortSelect) sortSelect.disabled = true;
  if (selectAllCheckbox) selectAllCheckbox.disabled = true;
  filterBtns.forEach(b => b.style.pointerEvents = 'none');

  // Process sequentially to respect Gemini API concurrent rate limit safety boundaries
  for (let i = 0; i < skusToAnalyze.length; i++) {
    const sku = skusToAnalyze[i];
    
    // Update individual progress UI state
    if (currentSkuSpan) currentSkuSpan.innerText = sku;
    if (currentIdxSpan) currentIdxSpan.innerText = i + 1;
    if (barFill) {
      const pct = Math.round(((i) / skusToAnalyze.length) * 100);
      barFill.style.width = `${pct}%`;
    }

    // Set loading icon in sidebar
    bulkAnalyzingSkus.add(sku);
    renderFilteredListOnly();

    const p = loadedProductsMap.get(sku);
    if (p) {
      try {
        const response = await fetch('/api/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sku,
            name: p.name,
            category: p.category || 'Jewellery',
            specs: p.product_specifications || {}
          })
        });
        const data = await response.json();
        
        if (data.success) {
          p.is_analyzed = true;
          p.ai_description = data.aiDescription;
          selectedAnalysisSkus.delete(sku); // Clear on success
        }
      } catch (err) {
        console.error(`Bulk ingestion failed for SKU ${sku}:`, err);
      }
    }

    bulkAnalyzingSkus.delete(sku);
  }

  // Complete filled state
  if (barFill) barFill.style.width = '100%';
  setTimeout(() => {
    if (progressContainer) progressContainer.classList.add('hidden');
  }, 1200);

  // Restore sidebar state
  activeBulkAnalyzing = false;
  if (searchInput) searchInput.disabled = false;
  if (sortSelect) sortSelect.disabled = false;
  if (selectAllCheckbox) selectAllCheckbox.disabled = false;
  filterBtns.forEach(b => b.style.pointerEvents = 'auto');

  selectedAnalysisSkus.clear();
  filterAndRenderAnalysisProducts();

  // If currently viewed product was just analyzed, re-render immediately
  const dossierSkuEl = document.querySelector('.dossier-sku');
  if (dossierSkuEl) {
    const currentViewSku = dossierSkuEl.innerText.replace('SKU: ', '').trim();
    const updatedViewProduct = loadedProductsMap.get(currentViewSku);
    if (updatedViewProduct && updatedViewProduct.is_analyzed) {
      let imageUrl = 'https://mcprod.noveljewels.com/static/version1777986575/frontend/Magento/luma/en_US/Magento_Catalog/images/product/placeholder/image.jpg';
      if (updatedViewProduct.image_urls && updatedViewProduct.image_urls.length > 0) {
        imageUrl = `/api/proxy-image?url=${encodeURIComponent(updatedViewProduct.image_urls[0])}`;
      }
      selectProductForAnalysis(updatedViewProduct, imageUrl);
    }
  }
}
