# ============================================================================
# INDRIYA AI CATALOGUE SEARCH - HIGH-PERFORMANCE MULTI-STAGE DOCKERFILE
# Bakes local ONNX models directly into the image for instant cold-starts.
# ============================================================================

# Stage 1: Dependency builder & Model Pre-cacher
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency mappings
COPY package*.json ./

# Clean installation
RUN npm ci

# Copy full source tree
COPY . .

# Pre-cache local WASM models (Xenova Embedder + Whisper)
# This downloads them into ./onnx_cache during docker compilation
RUN npm run pre-cache

# Stage 2: Clean Lightweight Production Runner
FROM node:22-slim AS runner

WORKDIR /app

# Setup production environment
ENV NODE_ENV=production
ENV PORT=3000

# Copy node_modules and pre-cached models from Stage 1
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/onnx_cache ./onnx_cache
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/schema.sql ./
COPY --from=builder /app/db_init.mjs ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public

# Expose production port
EXPOSE 3000

# Fastify boots natively
CMD ["node", "server.js"]
