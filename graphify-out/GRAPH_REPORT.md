# Graph Report - scalable-llm-search  (2026-06-30)

## Corpus Check
- 41 files · ~26,154 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 302 nodes · 515 edges · 20 communities (16 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `0109d26f`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 36 edges
2. `searchCatalogue()` - 15 edges
3. `generateEmbedding()` - 13 edges
4. `QueryBuilder` - 12 edges
5. `getLatestMetalRates()` - 9 edges
6. `Indriya AI: The Luxury Concierge Engine` - 9 edges
7. `redisClient` - 8 edges
8. `handleSendMessage()` - 7 edges
9. `filterAndRenderAnalysisProducts()` - 7 edges
10. `loadProductsForAnalysis()` - 7 edges

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

## Communities (20 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): adminRatesPanel, adminToggleBtn, allAnalysisProducts, bulkAnalyzingSkus, chatHistoryList, chatMessagesContainer, chatSidebar, contentArea (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.12
Nodes (22): pool, query(), check(), runChatIntegrationTest(), runLogicalTests(), runTests(), checkChatHistory(), checkProduct() (+14 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (22): dependencies, ai, @ai-sdk/google, @bull-board/api, @bull-board/fastify, bullmq, dotenv, fastify (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (16): getSslConfig(), generateEmbedding(), getEmbedder(), getTranscriber(), parseWav(), transcribeAudio(), preCache(), connectRedis() (+8 more)

### Community 4 - "Community 4"
Cohesion: 0.15
Nodes (8): chatAgent, google, indriyaAnalyzer, mastra, ollama, storage, queryDatabaseTool, getDynamicContext()

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
Cohesion: 0.26
Nodes (13): filterAndRenderAnalysisProducts(), handleRouting(), loadProductsForAnalysis(), loadSession(), parseNarrativeToTabs(), queueForAnalysis(), renderAnalysisProductList(), renderFilteredListOnly() (+5 more)

### Community 11 - "Community 11"
Cohesion: 0.07
Nodes (25): queueProductIngestion(), startIngestionWorker(), content, dbToolRes, __dirname, endIdx, fastify, __filename (+17 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (22): 1. Zero-Cost "Pure Local" Philosophy, 2. Technical Stack, 3.5 Infrastructure & Deployment Flow, 3. System Architecture (HLD), 4.5 Observability & Distributed Tracing, 4. Engineering Deep-Dive (LLD), 6.2 Monitoring & Admin Tools, 6. Setup & Deployment (+14 more)

### Community 15 - "Community 15"
Cohesion: 0.18
Nodes (16): testTypo(), DB_SCHEMA, loadSchema(), OFFICIAL_CATEGORIES, startDiscoveryCron(), updateDiscovery(), calculatePriceValue(), createEmptyParse() (+8 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyType (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.14
Nodes (13): description, engines, node, main, name, scripts, db:init, ollama:pull (+5 more)

## Knowledge Gaps
- **133 isolated node(s):** `__filename`, `__dirname`, `fastify`, `publicPath`, `serverAdapter` (+128 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 1` to `Community 3`, `Community 11`, `Community 15`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `QueryBuilder` connect `Community 18` to `Community 1`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `searchCatalogue()` connect `Community 1` to `Community 3`, `Community 11`, `Community 15`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `fastify` to the rest of the system?**
  _133 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.1241565452091768 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._