# Graph Report - scalable-llm-search  (2026-07-01)

## Corpus Check
- 73 files · ~46,248 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 400 nodes · 697 edges · 26 communities (20 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fc340492`
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
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 69 edges
2. `searchCatalogue()` - 23 edges
3. `redisClient` - 14 edges
4. `generateEmbedding()` - 13 edges
5. `resolveTerminology()` - 12 edges
6. `QueryBuilder` - 12 edges
7. `Indriya AI: The Luxury Concierge Engine` - 10 edges
8. `processProductAnalysis()` - 9 edges
9. `getLatestMetalRates()` - 9 edges
10. `filterAndRenderAnalysisProducts()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `runChatIntegrationTest()` --calls--> `query()`  [EXTRACTED]
  test_chat_integration.js → src/config/db.js
- `runChatIntegrationTest()` --calls--> `searchCatalogue()`  [INFERRED]
  test_chat_integration.js → src/services/searchService.js
- `runLogicalTests()` --calls--> `searchCatalogue()`  [EXTRACTED]
  test_search.js → src/services/searchService.js
- `run()` --calls--> `getSslConfig()`  [INFERRED]
  db_init.mjs → src/config/db.js
- `check()` --calls--> `query()`  [EXTRACTED]
  check_synonyms.js → src/config/db.js

## Communities (26 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): adminRatesPanel, adminToggleBtn, allAnalysisProducts, bulkAnalyzingSkus, chatHistoryList, chatMessagesContainer, chatSidebar, contentArea (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (23): chatAgent, google, indriyaAnalyzer, mastra, ollama, storage, queryDatabaseTool, DB_SCHEMA (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (37): dependencies, ai, @ai-sdk/google, @bull-board/api, @bull-board/fastify, bullmq, dotenv, fastify (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (24): pool, connectRedis(), redisClient, runChatIntegrationTest(), runLogicalTests(), runTests(), run(), manualTest() (+16 more)

### Community 4 - "Community 4"
Cohesion: 0.17
Nodes (16): getSslConfig(), generateEmbedding(), getEmbedder(), getTranscriber(), parseWav(), transcribeAudio(), preCache(), run() (+8 more)

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
Cohesion: 0.30
Nodes (12): filterAndRenderAnalysisProducts(), loadProductsForAnalysis(), parseNarrativeToTabs(), poll(), queueForAnalysis(), renderAnalysisProductList(), renderFilteredListOnly(), selectProductForAnalysis() (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.06
Nodes (27): queueProductIngestion(), startIngestionWorker(), resources, content, dbToolRes, __dirname, endIdx, fastify (+19 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (29): 1. Zero-Cost "Pure Local" Philosophy, 2. Technical Stack, 3.5 Infrastructure & Deployment Flow, 3. System Architecture (HLD), 4.5 Observability & Distributed Tracing, 4. Engineering Deep-Dive (LLD), 5. Database Schema, 6.2 Monitoring & Admin Tools (+21 more)

### Community 15 - "Community 15"
Cohesion: 0.20
Nodes (6): test(), testNewPricing(), buildDynamicPriceSQL(), getLatestMetalRates(), getRawSql(), QueryBuilder

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyType (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (9): corrected, DB_SCHEMA, dictionary, dictionaryList, fuse, OFFICIAL_CATEGORIES, ontology, PROTECTED_WORDS (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.07
Nodes (23): query(), check(), run(), run(), checkChatHistory(), run(), main(), run() (+15 more)

### Community 21 - "Community 21"
Cohesion: 0.50
Nodes (3): content, endIndex, startIndex

## Knowledge Gaps
- **153 isolated node(s):** `__filename`, `__dirname`, `fastify`, `publicPath`, `serverAdapter` (+148 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 20` to `Community 1`, `Community 3`, `Community 4`, `Community 11`, `Community 15`?**
  _High betweenness centrality (0.089) - this node is a cross-community bridge._
- **Why does `QueryBuilder` connect `Community 15` to `Community 1`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `searchCatalogue()` connect `Community 3` to `Community 1`, `Community 4`, `Community 11`, `Community 15`, `Community 20`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `searchCatalogue()` (e.g. with `runChatIntegrationTest()` and `mergeFilters()`) actually correct?**
  _`searchCatalogue()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `__filename`, `__dirname`, `fastify` to the rest of the system?**
  _153 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.0907563025210084 - nodes in this community are weakly interconnected._