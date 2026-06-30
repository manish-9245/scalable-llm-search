# Graph Report - scalable-llm-search  (2026-07-01)

## Corpus Check
- 70 files · ~45,828 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 393 nodes · 682 edges · 28 communities (22 shown, 6 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8aae6ef4`
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
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 65 edges
2. `searchCatalogue()` - 23 edges
3. `redisClient` - 14 edges
4. `generateEmbedding()` - 13 edges
5. `resolveTerminology()` - 12 edges
6. `QueryBuilder` - 12 edges
7. `Indriya AI: The Luxury Concierge Engine` - 10 edges
8. `getLatestMetalRates()` - 9 edges
9. `filterAndRenderAnalysisProducts()` - 8 edges
10. `4. Engineering Deep-Dive (LLD)` - 8 edges

## Surprising Connections (you probably didn't know these)
- `run()` --calls--> `getSslConfig()`  [INFERRED]
  db_init.mjs → src/config/db.js
- `testSessionQueryDirect()` --calls--> `searchCatalogue()`  [EXTRACTED]
  scratch/test_session_query.js → src/services/searchService.js
- `runChatIntegrationTest()` --calls--> `searchCatalogue()`  [INFERRED]
  test_chat_integration.js → src/services/searchService.js
- `runLogicalTests()` --calls--> `searchCatalogue()`  [EXTRACTED]
  test_search.js → src/services/searchService.js
- `check()` --calls--> `query()`  [EXTRACTED]
  check_synonyms.js → src/config/db.js

## Communities (28 total, 6 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): adminRatesPanel, adminToggleBtn, allAnalysisProducts, bulkAnalyzingSkus, chatHistoryList, chatMessagesContainer, chatSidebar, contentArea (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (14): runTest(), runTests(), runTestCases(), calculatePriceValue(), createEmptyParse(), loadOntologyAndSlang(), mapToExclusionKeyword(), ontologyCache (+6 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (37): dependencies, ai, @ai-sdk/google, @bull-board/api, @bull-board/fastify, bullmq, dotenv, fastify (+29 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (7): chatAgent, google, indriyaAnalyzer, mastra, ollama, storage, getDynamicContext()

### Community 4 - "Community 4"
Cohesion: 0.13
Nodes (21): generateEmbedding(), getEmbedder(), getTranscriber(), parseWav(), transcribeAudio(), preCache(), connectRedis(), redisClient (+13 more)

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
Cohesion: 0.07
Nodes (24): resources, content, dbToolRes, __dirname, endIdx, fastify, __filename, finalResult (+16 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (29): 1. Zero-Cost "Pure Local" Philosophy, 2. Technical Stack, 3.5 Infrastructure & Deployment Flow, 3. System Architecture (HLD), 4.5 Observability & Distributed Tracing, 4. Engineering Deep-Dive (LLD), 5. Database Schema, 6.2 Monitoring & Admin Tools (+21 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyType (+2 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (9): corrected, DB_SCHEMA, dictionary, dictionaryList, fuse, OFFICIAL_CATEGORIES, ontology, PROTECTED_WORDS (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (36): getSslConfig(), pool, query(), check(), runChatIntegrationTest(), runLogicalTests(), runTests(), run() (+28 more)

### Community 21 - "Community 21"
Cohesion: 0.50
Nodes (3): content, endIndex, startIndex

### Community 23 - "Community 23"
Cohesion: 0.28
Nodes (4): queryDatabaseTool, DB_SCHEMA, OFFICIAL_CATEGORIES, getRawSql()

### Community 24 - "Community 24"
Cohesion: 0.38
Nodes (5): queueProductIngestion(), startIngestionWorker(), getChildLogger(), log, logger

### Community 27 - "Community 27"
Cohesion: 0.48
Nodes (5): run(), loadSchema(), normalizeProductData(), startDiscoveryCron(), updateDiscovery()

## Knowledge Gaps
- **152 isolated node(s):** `__filename`, `__dirname`, `fastify`, `publicPath`, `serverAdapter` (+147 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 20` to `Community 1`, `Community 4`, `Community 11`, `Community 23`, `Community 27`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Why does `QueryBuilder` connect `Community 15` to `Community 20`, `Community 23`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `searchCatalogue()` connect `Community 20` to `Community 1`, `Community 11`, `Community 4`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `searchCatalogue()` (e.g. with `runChatIntegrationTest()` and `mergeFilters()`) actually correct?**
  _`searchCatalogue()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `__filename`, `__dirname`, `fastify` to the rest of the system?**
  _152 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._