FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests
COPY package*.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install dependencies and build shared packages & api
RUN npm ci --workspace=@academic-risk-radar/shared-types \
           --workspace=@academic-risk-radar/scoring-engine \
           --workspace=@academic-risk-radar/api

RUN npm run build --workspace=@academic-risk-radar/shared-types
RUN npm run build --workspace=@academic-risk-radar/scoring-engine
RUN npm run build --workspace=@academic-risk-radar/api

# Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache curl

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/scoring-engine/dist ./packages/scoring-engine/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 4000

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

CMD ["node", "apps/api/dist/src/server.js"]
