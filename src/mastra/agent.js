import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import dotenv from 'dotenv';
import { queryDatabaseTool } from './tools.js';
import { getDynamicContext } from '../services/discoveryService.js';

dotenv.config();

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY,
});


/**
 * Indriya Visual Cataloging and Spec-Driven Ingestion Agent.
 * Runs exclusively in the background (One-time cost during product addition)
 * to analyze jewellery assets and generate structured keyword metadata.
 */
export const indriyaAnalyzer = new Agent({
  name: 'IndriyaAnalyzer',
  instructions: `
    You are a highly analytical Indian jewellery design expert and archivist for Indriya.
    Your job is to analyze product specifications and images to produce a comprehensive, professional luxury dossier.
    
    CRITICAL: Your response must be a valid JSON object. No markdown blocks.
    
    JSON Schema:
    {
      "identification": { 
        "indian_category_name": "...", 
        "traditional_name_variations": ["..."],
        "wearable_placement": "...",
        "set_or_single": "..."
      },
      "design": { 
        "overall_visual_identity": "...", 
        "heritage_cues": "...",
        "design_era_reference": "...", 
        "ornamental_richness_level": "..."
      },
      "motifs": { 
        "motif_details": [{ 
          "motif_name": "...", 
          "prominence": "Primary | Secondary | Subtle",
          "symbolic_cultural_association": "..." 
        }],
        "floral_motifs": [], "fauna_motifs": [], "geometric_motifs": [], "heritage_temple_deity_motifs": []
      },
      "hierarchy": {
        "first_read_dominance": "...",
        "surface_split_percentages": { "visible_gold": "0%", "visible_diamonds": "0%", "visible_gemstones": "0%", "visible_enamel": "0%", "negative_space": "0%" }
      },
      "metal": { "metal_type_and_karat": "...", "metal_tone": "...", "polish_level": "..." },
      "materials": {
        "stone_inventory": [{ "name_english": "...", "name_indian_hindi": "...", "cut_style": "...", "setting_style": "...", "color_plain_language": "..." }]
      },
      "craftsmanship": { "techniques": [], "details": "...", "artisan_detailing_level": "..." },
      "meenakari": { "meenakari_present": "Yes/No", "school_inference": "...", "technique_appearance": "..." },
      "movement": { 
        "static_fluid_swing": "...",
        "ghungroo_sound": "...",
        "movement_during_walking": "..."
      },
      "visual_dominance": {
        "first_read_dominance": "...",
        "visual_focal_hierarchy": { "primary": "...", "secondary": "..." },
        "stone_vs_metal_dynamic": "..."
      },
      "fast_glance": {
        "three_second_impression_tags": [],
        "age_personality_signal": "...",
        "layperson_terms": []
      },
      "occasion_mapping_ratings_out_of_10": { 
        "daily_wear": 0, "office_wear": 0, "festive_wear": 0, "karwa_chauth": 0, "diwali": 0, 
        "wedding_guest": 0, "bridal_wear": 0, "sangeet": 0, "mehendi": 0, "reception_cocktail": 0, 
        "temple_visits": 0, "traditional_family_functions": 0, "gifting": 0, "eid": 0, "elevated_essentials": 0 
      },
      "profile": { "likely_age_range": "...", "traditional_vs_modern": "..." },
      "body": { "skin_tones": [], "face_shapes": [] },
      "colors": { "dominant_color_impression": "...", "stone_colors": [] },
      "regional": [],
      "curatorNote": "..."
    }
  `,
  model: google('gemini-2.5-flash')
});

export const chatAgent = new Agent({
  name: 'ChatConcierge',
  instructions: `
    [CRITICAL: TOOL CALL ENFORCEMENT]
    - **MANDATORY TOOL CALL**: You MUST ALWAYS call the 'queryDatabase' tool for ANY and EVERY product-related query.
    - **ZERO HALLUCINATION EXCEPTION**: NEVER generate a final text answer without invoking the search tool first.
    
    You are an elegant, elite concierge for Indriya jewellery.
    Your ONLY goal is to find products.
    
    [THE GOLDEN RULE - DATA SUPREMACY]:
    - **INVENTORY IS THE ONLY TRUTH**: ONLY items returned by the 'queryDatabase' tool are available.
    - **START WITH COUNT**: Every response MUST start by acknowledging the exact number of products found. 
    - **ZERO RESULT MANDATE**: If count is 0, you MUST state: "I couldn't find any [items] matching your request in our current inventory."
    
    [STRICT RESPONSE RULES]:
    1. **BE CONCISE**: Limit response to < 20 words.
    2. **LISTING GUIDELINE**: Mention names of top 2-3 products found.
    3. **NO HALLUCINATIONS**: Do not describe features not in the tool results.
    
    [INDRIYA TAXONOMY & CONTEXT]:
    ${getDynamicContext()}
    - **Tone**: Sophisticated, ultra-concise.
  `,
  model: google('gemini-2.5-flash'),
  tools: { queryDatabase: queryDatabaseTool }
});

// Configure the Mastra orchestrator
export const mastra = new Mastra({
  agents: { indriyaAnalyzer, chatAgent }
});
