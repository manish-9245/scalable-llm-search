# Graph Report - scalable-llm-search  (2026-06-29)

## Corpus Check
- 21 files · ~18,458 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 182 nodes · 277 edges · 14 communities (12 shown, 2 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 13 edges
2. `searchCatalogue()` - 13 edges
3. `handleSendMessage()` - 7 edges
4. `filterAndRenderAnalysisProducts()` - 7 edges
5. `loadProductsForAnalysis()` - 7 edges
6. `generateEmbedding()` - 7 edges
7. `stopRecordingFlow()` - 6 edges
8. `parseQuery()` - 6 edges
9. `scripts` - 5 edges
10. `queueForAnalysis()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `runChatIntegrationTest()` --calls--> `searchCatalogue()`  [INFERRED]
  test_chat_integration.js → src/services/searchService.js
- `runLogicalTests()` --calls--> `searchCatalogue()`  [EXTRACTED]
  test_search.js → src/services/searchService.js
- `run()` --calls--> `getSslConfig()`  [INFERRED]
  db_init.mjs → src/config/db.js
- `check()` --calls--> `query()`  [EXTRACTED]
  check_synonyms.js → src/config/db.js
- `manualTest()` --calls--> `searchCatalogue()`  [EXTRACTED]
  scratch/manual_test.js → src/services/searchService.js

## Communities (14 total, 2 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): adminRatesPanel, adminToggleBtn, allAnalysisProducts, bulkAnalyzingSkus, chatHistoryList, chatMessagesContainer, chatSidebar, contentArea (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (12): dependencies, @ai-sdk/google, dotenv, fastify, @fastify/multipart, @fastify/static, @google/genai, @mastra/core (+4 more)

### Community 2 - "Community 2"
Cohesion: 0.15
Nodes (12): description, engines, node, main, name, scripts, db:init, pre-cache (+4 more)

### Community 3 - "Community 3"
Cohesion: 0.35
Nodes (8): getSslConfig(), generateEmbedding(), getEmbedder(), getTranscriber(), parseWav(), transcribeAudio(), preCache(), run()

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (23): pool, query(), connectRedis(), redisClient, check(), runChatIntegrationTest(), runLogicalTests(), runTests() (+15 more)

### Community 6 - "Community 6"
Cohesion: 0.29
Nodes (8): encodeWAV(), encodeWavHeader(), executeSearch(), renderNlpInsights(), renderProductsList(), startRecordingFlow(), stopRecordingFlow(), writeString()

### Community 7 - "Community 7"
Cohesion: 0.50
Nodes (4): fetchRates(), loadLiveRates(), updateHeaderRatesDisplay(), updateRate()

### Community 9 - "Community 9"
Cohesion: 0.32
Nodes (8): addSessionToSidebar(), appendAIBubble(), appendTypingBubble(), appendUserBubble(), ensureSession(), handleSendMessage(), removeBubble(), scrollToBottom()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (12): filterAndRenderAnalysisProducts(), handleRouting(), loadProductsForAnalysis(), parseNarrativeToTabs(), queueForAnalysis(), renderAnalysisProductList(), renderFilteredListOnly(), selectProductForAnalysis() (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.10
Nodes (18): chatAgent, google, indriyaAnalyzer, mastra, content, __dirname, endIdx, fastify (+10 more)

## Knowledge Gaps
- **85 isolated node(s):** `__filename`, `__dirname`, `fastify`, `publicPath`, `content` (+80 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 4` to `Community 11`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **Why does `searchCatalogue()` connect `Community 4` to `Community 3`, `Community 11`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Community 1` to `Community 2`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `fastify` to the rest of the system?**
  _85 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.0392156862745098 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.1310483870967742 - nodes in this community are weakly interconnected._
- **Should `Community 11` be split into smaller, more focused modules?**
  _Cohesion score 0.1038961038961039 - nodes in this community are weakly interconnected._