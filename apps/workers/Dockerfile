FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests
COPY package*.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY apps/workers/ ./apps/workers/

# Install dependencies and build shared packages, api and workers
RUN npm ci --workspace=@academic-risk-radar/shared-types \
           --workspace=@academic-risk-radar/scoring-engine \
           --workspace=@academic-risk-radar/api \
           --workspace=@academic-risk-radar/workers

RUN npm run build --workspace=@academic-risk-radar/shared-types
RUN npm run build --workspace=@academic-risk-radar/scoring-engine
RUN npm run build --workspace=@academic-risk-radar/api
RUN npm run build --workspace=@academic-risk-radar/workers

# Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY apps/workers/ ./apps/workers/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/scoring-engine/dist ./packages/scoring-engine/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/workers/dist ./apps/workers/dist
COPY --from=builder /app/node_modules ./node_modules

CMD ["node", "apps/workers/dist/scoring.worker.js"]
