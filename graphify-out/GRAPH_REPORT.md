# Graph Report - scalable-llm-search  (2026-06-30)

## Corpus Check
- 40 files · ~25,554 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 298 nodes · 506 edges · 17 communities (13 shown, 4 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bba8309d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
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

## God Nodes (most connected - your core abstractions)
1. `query()` - 36 edges
2. `generateEmbedding()` - 13 edges
3. `searchCatalogue()` - 13 edges
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

## Communities (17 total, 4 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (45): adminRatesPanel, adminToggleBtn, allAnalysisProducts, bulkAnalyzingSkus, chatHistoryList, chatMessagesContainer, chatSidebar, contentArea (+37 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (37): getSslConfig(), pool, query(), generateEmbedding(), getEmbedder(), getTranscriber(), parseWav(), transcribeAudio() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.06
Nodes (35): dependencies, ai, @ai-sdk/google, @bull-board/api, @bull-board/fastify, bullmq, dotenv, fastify (+27 more)

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
Nodes (26): queueProductIngestion(), startIngestionWorker(), content, dbToolRes, __dirname, endIdx, fastify, __filename (+18 more)

### Community 14 - "Community 14"
Cohesion: 0.09
Nodes (21): 1. Zero-Cost "Pure Local" Philosophy, 2. Technical Stack, 3.5 Infrastructure & Deployment Flow, 3. System Architecture (HLD), 4.5 Observability & Distributed Tracing, 4. Engineering Deep-Dive (LLD), 6.2 Monitoring & Admin Tools, 6. Setup & Deployment (+13 more)

### Community 15 - "Community 15"
Cohesion: 0.10
Nodes (23): chatAgent, google, indriyaAnalyzer, mastra, ollama, storage, queryDatabaseTool, DB_SCHEMA (+15 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyType (+2 more)

## Knowledge Gaps
- **132 isolated node(s):** `__filename`, `__dirname`, `fastify`, `publicPath`, `serverAdapter` (+127 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 1` to `Community 11`, `Community 15`?**
  _High betweenness centrality (0.047) - this node is a cross-community bridge._
- **Why does `QueryBuilder` connect `Community 18` to `Community 1`, `Community 15`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `searchCatalogue()` connect `Community 1` to `Community 11`, `Community 15`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `__filename`, `__dirname`, `fastify` to the rest of the system?**
  _132 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08650937689050212 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05555555555555555 - nodes in this community are weakly interconnected._