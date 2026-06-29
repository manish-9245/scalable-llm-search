-- ============================================================================
-- Indriya AI Catalogue Search - Foolproof Production Database Schema
-- Optimized for Dynamic Indian Jewellery Pricing, Vernacular NLP, and AI Search
-- ============================================================================

-- Enable pgvector extension for high-performance semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop existing tables if they conflict (for clean bootstrapping/migrations)
DROP TABLE IF EXISTS "product_clicks" CASCADE;
DROP TABLE IF EXISTS "search_logs" CASCADE;
DROP TABLE IF EXISTS "chat_messages" CASCADE;
DROP TABLE IF EXISTS "chat_sessions" CASCADE;
DROP TABLE IF EXISTS "system_prompts" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "search_ontology" CASCADE;
DROP TABLE IF EXISTS "slang_vectors" CASCADE;
DROP TABLE IF EXISTS "knowledge_base" CASCADE;
DROP TABLE IF EXISTS "knowledge_source_metadata" CASCADE;
DROP TABLE IF EXISTS "product_occasions" CASCADE;
DROP TABLE IF EXISTS "product_motifs" CASCADE;
DROP TABLE IF EXISTS "product_craftsmanship" CASCADE;
DROP TABLE IF EXISTS "product_gemstone_metrics" CASCADE;
DROP TABLE IF EXISTS "product_materials_metrics" CASCADE;
DROP TABLE IF EXISTS "catalog_products" CASCADE;
DROP TABLE IF EXISTS "daily_metal_rates" CASCADE;

-- Drop existing types if they conflict
DROP TYPE IF EXISTS "gold_purity" CASCADE;
DROP TYPE IF EXISTS "metal_color" CASCADE;
DROP TYPE IF EXISTS "gender_target" CASCADE;
DROP TYPE IF EXISTS "making_charge_type" CASCADE;

-- Create strict custom domains / types for data integrity
CREATE TYPE "gold_purity" AS ENUM ('14K', '18K', '22K', '24K');
CREATE TYPE "metal_color" AS ENUM ('Yellow', 'White', 'Pink', 'Rose', 'Dual-Tone', 'Tri-Tone');
CREATE TYPE "gender_target" AS ENUM ('Women', 'Men', 'Unisex', 'Kids');
CREATE TYPE "making_charge_type" AS ENUM ('per_gram', 'percentage', 'flat');

-- 1. Daily Fluctuating Metal Rates (Dynamic pricing baseline)
CREATE TABLE "daily_metal_rates" (
    "id" SERIAL PRIMARY KEY,
    "record_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "metal_type" VARCHAR(50) NOT NULL, -- e.g., '22KT Gold', '18KT Gold', '14KT Gold', 'Platinum', 'Silver'
    "rate_per_gram" NUMERIC(12, 2) NOT NULL,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "unique_metal_rate_date" UNIQUE ("record_date", "metal_type")
);

-- 2. Core Catalog Table (Consolidated high-performance master catalog)
CREATE TABLE "catalog_products" (
    "id" INT PRIMARY KEY, -- Maps 1-to-1 with global products ID
    "sku" VARCHAR(100) UNIQUE NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL, -- Earrings, Necklaces, Bangles, Rings, Mangalsutras, Pendants, Bracelets, Chains, Coins, Nose Pins, Anklets
    "sub_category" VARCHAR(100), -- Studs, Hoops, Drops, Danglers, Jhumkas, Chandbalis, Sui Dhaga, Chokers, Rani Haar, Kadas, Cuffs, Bands, Solitaires
    "collection" VARCHAR(100), -- Anantara, Rajashree, Raasvi, Padma Ranjini, Vanjyotsna, Garden of Emotions, etc.
    "gender" "gender_target" DEFAULT 'Women',
    "occasion" VARCHAR(100), -- Daily Wear, Elevated Essentials, Light Occasion, Heavy Occasion, Bridal Wear
    "design_theme" VARCHAR(100), -- Modern, Contemporary, Traditional, Elevated Traditional, Classic, Minimalist, Floral, Geometric
    "description" TEXT,
    "ai_description" TEXT, -- Rich spec-driven context generated once by Gemini 2.5 Flash
    "image_urls" TEXT[] NOT NULL DEFAULT '{}', -- Supports multiple high-resolution photos
    "product_url" VARCHAR(512),
    "availability" VARCHAR(50) NOT NULL DEFAULT 'In Stock', -- In Stock, Out of Stock, Made to Order
    
    -- Component Weight Specifications (Transparent material breakdown)
    "gold_weight_numeric" NUMERIC(8, 3) DEFAULT 0.000,
    "purity" VARCHAR(50) DEFAULT '22K',
    "platinum_weight_numeric" NUMERIC(8, 3) DEFAULT 0.000,
    "silver_weight_numeric" NUMERIC(8, 3) DEFAULT 0.000,
    "diamond_weight_numeric" NUMERIC(8, 3) DEFAULT 0.000, -- in carats
    "diamond_clarity" VARCHAR(50), -- SI, VS, VVS, VVS-EF, SI-FG, etc.
    "diamond_color" VARCHAR(50), -- D-F, G-H, I-J, etc.
    "gemstone_weight_numeric" NUMERIC(8, 3) DEFAULT 0.000, -- in carats
    "gemstone_type" VARCHAR(100), -- Ruby, Emerald, Pearl, Sapphire, Synthetic, etc.
    
    -- Transparent Pricing Configuration (For live real-time price updates)
    "making_charge_type" "making_charge_type" DEFAULT 'per_gram',
    "making_charge_value" NUMERIC(12, 2) DEFAULT 0.00,
    "diamond_rate_per_carat" NUMERIC(12, 2) DEFAULT 0.00,
    "gemstone_rate_per_carat" NUMERIC(12, 2) DEFAULT 0.00,
    "base_price" NUMERIC(12, 2), -- Cached price for reference
    "base_gold_rate" NUMERIC(12, 2), -- Gold rate at the time base_price was cached
    
    -- Visual Split Parameters (Fractional visual dominance for aesthetic filtering)
    "visible_gold_pct" NUMERIC(5, 2) DEFAULT 0.00 CONSTRAINT "valid_gold_pct" CHECK ("visible_gold_pct" BETWEEN 0.00 AND 100.00),
    "visible_diamond_pct" NUMERIC(5, 2) DEFAULT 0.00 CONSTRAINT "valid_diamond_pct" CHECK ("visible_diamond_pct" BETWEEN 0.00 AND 100.00),
    "visible_polki_pct" NUMERIC(5, 2) DEFAULT 0.00 CONSTRAINT "valid_polki_pct" CHECK ("visible_polki_pct" BETWEEN 0.00 AND 100.00),
    "visible_enamel_pct" NUMERIC(5, 2) DEFAULT 0.00 CONSTRAINT "valid_enamel_pct" CHECK ("visible_enamel_pct" BETWEEN 0.00 AND 100.00),
    
    -- Hard Negation Array Fields (GIN indexed for <1ms exact exclusions)
    "all_gemstones_array" TEXT[] DEFAULT '{}', -- e.g., {'diamond', 'ruby', 'pearl'}
    "all_motifs_array" TEXT[] DEFAULT '{}', -- e.g., {'floral', 'peacock', 'crescent'}
    "all_craftsmanship_array" TEXT[] DEFAULT '{}', -- e.g., {'filigree', 'meenakari', 'nakashi'}
    
    -- 384-Dimension Local Semantic Embedding Vector
    "embedding" halfvec(384), -- Matryoshka Representation Learning (MRL) optimized
    
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Fine-Grained Material Metrics (Detailed breakdowns)
CREATE TABLE "product_materials_metrics" (
    "id" SERIAL PRIMARY KEY,
    "product_id" INT REFERENCES "catalog_products" ("id") ON DELETE CASCADE,
    "material_type" VARCHAR(50) NOT NULL, -- Gold, Platinum, Silver, Rhodium
    "color" "metal_color" DEFAULT 'Yellow',
    "purity" VARCHAR(20) DEFAULT '22K',
    "weight_grams" NUMERIC(8, 3) NOT NULL,
    CONSTRAINT "unique_product_material" UNIQUE ("product_id", "material_type", "color", "purity")
);

-- 4. Fine-Grained Gemstone Details
CREATE TABLE "product_gemstone_metrics" (
    "id" SERIAL PRIMARY KEY,
    "product_id" INT REFERENCES "catalog_products" ("id") ON DELETE CASCADE,
    "stone_category" VARCHAR(50) NOT NULL, -- Diamond, Ruby, Emerald, Sapphire, Pearl, Polki, Synthetic
    "stone_type" VARCHAR(100), -- Natural, Treated, Lab-Grown, Synthetic
    "total_carat_weight" NUMERIC(8, 3) NOT NULL,
    "stone_count" INT DEFAULT 1,
    CONSTRAINT "unique_product_gemstone" UNIQUE ("product_id", "stone_category", "stone_type")
);

-- 5. Sub-table: Craftsmanship Techniques Mapping
CREATE TABLE "product_craftsmanship" (
    "product_id" INT REFERENCES "catalog_products" ("id") ON DELETE CASCADE,
    "technique" VARCHAR(100) NOT NULL, -- Filigree, Jaali, Nakashi, Meenakari (Enamel), Kundan, Jadau, Pavé, Prong, bezel
    PRIMARY KEY ("product_id", "technique")
);

-- 6. Sub-table: Visual Motifs Mapping
CREATE TABLE "product_motifs" (
    "product_id" INT REFERENCES "catalog_products" ("id") ON DELETE CASCADE,
    "motif" VARCHAR(100) NOT NULL, -- Peacock, Lotus, Floral, Crescent, Elephant, Mango (Kalka), Geometric, Chevron
    PRIMARY KEY ("product_id", "motif")
);

-- 7. Sub-table: Occasions Mapping (A product can fit sangeet, wedding day, sabyasachi style)
CREATE TABLE "product_occasions" (
    "product_id" INT REFERENCES "catalog_products" ("id") ON DELETE CASCADE,
    "occasion" VARCHAR(100) NOT NULL, -- Bridal Sangeet, Bridal Sabyasachi, Daily Wear, Cocktail Party, Festive Wear
    PRIMARY KEY ("product_id", "occasion")
);

-- 8. Vernacular Slang Synonym Mapping Table (Live regional terminology translations)
CREATE TABLE "slang_vectors" (
    "id" SERIAL PRIMARY KEY,
    "term" TEXT UNIQUE NOT NULL, -- e.g., 'vanki', 'mookuthi', 'thushi', 'haar', 'kolhapuri saaj', 'kada'
    "meaning" TEXT NOT NULL, -- English translation or conceptual meaning
    "embedding" halfvec(384), -- In-process generated synonym embedding vector
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Native Glossary Knowledge Base (For terminology-based pre-parsing RAG)
CREATE TABLE "knowledge_base" (
    "id" SERIAL PRIMARY KEY,
    "source_name" VARCHAR(255) NOT NULL, -- e.g., Caratlane Glossary, Hamstech terms blog
    "content" TEXT NOT NULL, -- Glossary text chunk containing term definitions
    "embedding" halfvec(384), -- Vector embedding of definition chunk
    "parent_id" INT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "knowledge_source_metadata" (
    "source_name" VARCHAR(255) PRIMARY KEY,
    "original_url" TEXT,
    "summary" TEXT,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Lexical Ontology Mapping (Direct hard-coded rules for query translation)
CREATE TABLE "search_ontology" (
    "id" SERIAL PRIMARY KEY,
    "domain" VARCHAR(50) NOT NULL, -- 'category', 'sub_category', 'collection', 'purity', 'metal_color', 'gemstone'
    "synonym" VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'jhumka'
    "target_value" VARCHAR(100) NOT NULL -- e.g., 'Earrings'
);

-- 11. Security Guardrails & Prompt Configuration
CREATE TABLE "system_prompts" (
    "agent_name" VARCHAR(100) PRIMARY KEY,
    "instructions" TEXT NOT NULL,
    "prompt_metadata" JSONB DEFAULT '{}'::jsonb,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Sales Associates & Admin Users Table
CREATE TABLE "users" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(255) NOT NULL,
    "store_location" VARCHAR(255) NOT NULL, -- e.g., 'Indriya South Ex, Delhi', 'Head Office'
    "role" VARCHAR(50) DEFAULT 'user', -- 'admin', 'user'
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Customer Chat Sessions
CREATE TABLE "chat_sessions" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" INT REFERENCES "users" ("id") ON DELETE CASCADE,
    "title" VARCHAR(255) NOT NULL DEFAULT 'New Search Session',
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. Customer Conversational Chat Logs
CREATE TABLE "chat_messages" (
    "id" SERIAL PRIMARY KEY,
    "session_id" UUID REFERENCES "chat_sessions" ("id") ON DELETE CASCADE,
    "sender" VARCHAR(50) NOT NULL, -- 'user', 'ai'
    "text" TEXT NOT NULL,
    "products" JSONB, -- Array of product cards shown
    "tool_params" JSONB, -- The parsed query filters used
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 15. Search Analytics logs (To refine lexicon/slang vocabulary over time)
CREATE TABLE "search_logs" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INT REFERENCES "users" ("id") ON DELETE SET NULL,
    "session_id" UUID REFERENCES "chat_sessions" ("id") ON DELETE SET NULL,
    "query" TEXT NOT NULL,
    "semantic_category" VARCHAR(100),
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. User In-app Interaction Logs
CREATE TABLE "product_clicks" (
    "id" SERIAL PRIMARY KEY,
    "user_id" INT REFERENCES "users" ("id") ON DELETE SET NULL,
    "product_id" INT REFERENCES "catalog_products" ("id") ON DELETE CASCADE,
    "product_name" VARCHAR(255),
    "timestamp" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- HIGH-PERFORMANCE INDEXING STRATEGY
-- ============================================================================

-- A. B-Tree Indexes on Numeric Price Components for instant numeric logic
CREATE INDEX "idx_cat_prod_gold_wt" ON "catalog_products" ("gold_weight_numeric");
CREATE INDEX "idx_cat_prod_diamond_wt" ON "catalog_products" ("diamond_weight_numeric");
CREATE INDEX "idx_cat_prod_gemstone_wt" ON "catalog_products" ("gemstone_weight_numeric");
CREATE INDEX "idx_cat_prod_base_price" ON "catalog_products" ("base_price");
CREATE INDEX "idx_cat_prod_visible_gold" ON "catalog_products" ("visible_gold_pct");
CREATE INDEX "idx_cat_prod_visible_diamond" ON "catalog_products" ("visible_diamond_pct");
CREATE INDEX "idx_cat_prod_visible_enamel" ON "catalog_products" ("visible_enamel_pct");

-- B. B-Tree Indexes on Categorical Columns for extremely high-speed exact filtering
CREATE INDEX "idx_cat_prod_category" ON "catalog_products" ("category");
CREATE INDEX "idx_cat_prod_sub_category" ON "catalog_products" ("sub_category");
CREATE INDEX "idx_cat_prod_collection" ON "catalog_products" ("collection");
CREATE INDEX "idx_cat_prod_purity" ON "catalog_products" ("purity");
CREATE INDEX "idx_cat_prod_availability" ON "catalog_products" ("availability");

-- C. GIN (Generalized Inverted Index) Indexes on Exclusions and Motifs
-- Guarantees <1.5ms relational array exclusions like: NOT (all_gemstones_array @> ARRAY['pearl'])
CREATE INDEX "idx_cat_prod_gemstones_array" ON "catalog_products" USING GIN ("all_gemstones_array");
CREATE INDEX "idx_cat_prod_motifs_array" ON "catalog_products" USING GIN ("all_motifs_array");
CREATE INDEX "idx_cat_prod_craftsmanship_array" ON "catalog_products" USING GIN ("all_craftsmanship_array");

-- D. pgvector HNSW Cosine Distance Vector Indexes
-- Optimised for 384 dimensions using halfvec to keep indexes inside memory footprint (512MB RAM standard tier)
CREATE INDEX "idx_cat_prod_embedding_hnsw" ON "catalog_products" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX "idx_slang_embedding_hnsw" ON "slang_vectors" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX "idx_kb_embedding_hnsw" ON "knowledge_base" USING hnsw ("embedding" halfvec_cosine_ops) WITH (m = 16, ef_construction = 64);
