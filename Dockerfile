# ==============================================================================
# Multi-stage Dockerfile for Hono Server
# Optimized for Docker 29+ & ARM64 (linux/arm64) / AMD64 (linux/amd64)
# ==============================================================================

# -------------------------------------------------------------
# Stage 1: Build stage (compile TypeScript & bundle into ESM)
# -------------------------------------------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for fast reproducible pnpm package manager
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy dependency manifests first for Docker layer caching
COPY package.json pnpm-lock.yaml* tsconfig.json tsup.config.ts ./

# Install dependencies
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source code
COPY src ./src

# Build standalone bundled ESM application (dist/index.js)
RUN pnpm run build

# -------------------------------------------------------------
# Stage 2: Minimalist Production Runner
# -------------------------------------------------------------
FROM node:22-alpine AS runner

LABEL maintainer="TomatoX <tomatox@xujiuran.top>"
LABEL description="Production-ready lightweight Hono Server for ARM64 VPS"

WORKDIR /app

# Run as non-root user (node) for container security
USER node

# Copy only the compiled standalone production artifact
COPY --from=builder --chown=node:node /app/dist/index.js ./dist/index.js

# Production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    DOCKER_CONTAINER=true

EXPOSE 3000

# Docker native healthcheck (wget is built-in in Alpine)
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1

# Start server directly with Node
CMD ["node", "dist/index.js"]
