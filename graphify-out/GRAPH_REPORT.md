# Graph Report - scalable-llm-search  (2026-07-01)

## Corpus Check
- 74 files · ~50,204 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 482 nodes · 779 edges · 39 communities (32 shown, 7 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d3c03a79`
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
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]

## God Nodes (most connected - your core abstractions)
1. `query()` - 69 edges
2. `searchCatalogue()` - 23 edges
3. `redisClient` - 14 edges
4. `generateEmbedding()` - 13 edges
5. `Accessibility Coding Guidelines` - 13 edges
6. `resolveTerminology()` - 12 edges
7. `QueryBuilder` - 12 edges
8. `Indriya AI: The Luxury Concierge Engine` - 10 edges
9. `processProductAnalysis()` - 9 edges
10. `getLatestMetalRates()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `testSessionQueryDirect()` --calls--> `searchCatalogue()`  [EXTRACTED]
  scratch/test_session_query.js → src/services/searchService.js
- `runChatIntegrationTest()` --calls--> `searchCatalogue()`  [INFERRED]
  test_chat_integration.js → src/services/searchService.js
- `runLogicalTests()` --calls--> `searchCatalogue()`  [EXTRACTED]
  test_search.js → src/services/searchService.js
- `run()` --calls--> `getSslConfig()`  [INFERRED]
  db_init.mjs → src/config/db.js
- `check()` --calls--> `query()`  [EXTRACTED]
  check_synonyms.js → src/config/db.js

## Communities (39 total, 7 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.04
Nodes (48): adminRatesPanel, adminToggleBtn, allAnalysisProducts, bulkAnalyzingSkus, chatHistoryList, chatMessagesContainer, chatSidebar, contentArea (+40 more)

### Community 1 - "Community 1"
Cohesion: 0.25
Nodes (9): connectRedis(), redisClient, run(), run(), testSessionQueryDirect(), fetchAndSyncRates(), fetchLiveGoldRate(), getPreviousMetalRates() (+1 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (37): dependencies, ai, @ai-sdk/google, @bull-board/api, @bull-board/fastify, bullmq, dotenv, fastify (+29 more)

### Community 4 - "Community 4"
Cohesion: 0.16
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
Nodes (29): queueProductIngestion(), startIngestionWorker(), resources, content, dbToolRes, __dirname, endIdx, fastify (+21 more)

### Community 14 - "Community 14"
Cohesion: 0.07
Nodes (29): 1. Zero-Cost "Pure Local" Philosophy, 2. Technical Stack, 3.5 Infrastructure & Deployment Flow, 3. System Architecture (HLD), 4.5 Observability & Distributed Tracing, 4. Engineering Deep-Dive (LLD), 5. Database Schema, 6.2 Monitoring & Admin Tools (+21 more)

### Community 15 - "Community 15"
Cohesion: 0.08
Nodes (27): chatAgent, google, indriyaAnalyzer, mastra, ollama, storage, queryDatabaseTool, runTest() (+19 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (10): build, builder, dockerfilePath, deploy, healthcheckPath, healthcheckTimeout, numReplicas, restartPolicyType (+2 more)

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (3): handleRouting(), loadSession(), startNewSession()

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (9): corrected, DB_SCHEMA, dictionary, dictionaryList, fuse, OFFICIAL_CATEGORIES, ontology, PROTECTED_WORDS (+1 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (37): pool, query(), check(), runChatIntegrationTest(), runLogicalTests(), runTests(), run(), run() (+29 more)

### Community 21 - "Community 21"
Cohesion: 0.50
Nodes (3): content, endIndex, startIndex

### Community 24 - "Community 24"
Cohesion: 0.25
Nodes (8): 5. Keyboard and Focus Management, Actionable Guidelines, Code Examples, code:css (/* Good: High contrast focus border */), code:html (<!-- Good: Skip to main content -->), code:javascript (// Good: Keyboard handlers for complex custom widgets (e.g.,), DON'Ts, DOs

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (8): 9. Color, Contrast, and Typography, Actionable Guidelines, Code Examples, code:css (/* Good: Relative sizing and line caps */), code:html (<!-- Good: Denotes state without colors alone -->), code:css (/* Dark Mode support variables */), DON'Ts, DOs

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (7): 6. Alternate Text and Media, Actionable Guidelines, Code Examples, code:html (<!-- Decorative -->), Content Visibility Decision Matrix, DON'Ts, DOs

### Community 30 - "Community 30"
Cohesion: 0.29
Nodes (7): 8. Live Regions, Actionable Guidelines, Code Example, code:html (<!-- Session Timeout Warning with controls -->), DON'Ts, DOs, Live Region Urgency Table

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (6): 10. Motions and Preferences, Actionable Guidelines, Code Examples, code:css (/* Good: Dampen spin states for reduced motion queries */), DON'Ts, DOs

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (6): 11. Modals and Native Dialogs, Actionable Guidelines, Code Examples, code:html (<!-- Dialog opens natively with showModal() and locks focus ), DON'Ts, DOs

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (6): 1. Content Navigability and Structure, Actionable Guidelines, Code Examples, code:html (<!-- Good: Semantic landmarks, heading hierarchy, skip link ), DON'Ts, DOs

### Community 34 - "Community 34"
Cohesion: 0.50
Nodes (4): 2. Semantic HTML and ARIA, Actionable Guidelines, DON'Ts, DOs

### Community 35 - "Community 35"
Cohesion: 0.33
Nodes (6): 3. Accessible Names and Descriptions, Actionable Guidelines, Code Example: Visually Hidden Utility, code:css (/* Hides content visually but keeps it in the accessibility ), DON'Ts, DOs

### Community 36 - "Community 36"
Cohesion: 0.33
Nodes (6): 4. Document Metadata and Language, Actionable Guidelines, Code Examples, code:html (<!-- Good: Distinct title and language declaration -->), DON'Ts, DOs

### Community 37 - "Community 37"
Cohesion: 0.33
Nodes (6): 7. Forms and Input Controls, Actionable Guidelines, Code Examples, code:html (<!-- Good: Semantic forms with hints for passwords -->), DON'Ts, DOs

### Community 38 - "Community 38"
Cohesion: 0.33
Nodes (5): 12. Testing Validations, Accessibility Coding Guidelines, Actionable Guidelines, DON'Ts, DOs

## Knowledge Gaps
- **196 isolated node(s):** `__filename`, `__dirname`, `fastify`, `publicPath`, `serverAdapter` (+191 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `query()` connect `Community 20` to `Community 1`, `Community 11`, `Community 4`, `Community 15`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `Accessibility Coding Guidelines` connect `Community 38` to `Community 32`, `Community 33`, `Community 34`, `Community 35`, `Community 36`, `Community 37`, `Community 24`, `Community 27`, `Community 29`, `Community 30`, `Community 31`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `QueryBuilder` connect `Community 3` to `Community 20`, `Community 15`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `searchCatalogue()` (e.g. with `runChatIntegrationTest()` and `mergeFilters()`) actually correct?**
  _`searchCatalogue()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `__filename`, `__dirname`, `fastify` to the rest of the system?**
  _196 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.038461538461538464 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.05263157894736842 - nodes in this community are weakly interconnected._