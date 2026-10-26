FROM node:20-alpine AS builder
WORKDIR /app

# Copy package manifests
COPY package*.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build shared packages & web app
RUN npm ci --workspace=@academic-risk-radar/shared-types \
           --workspace=@academic-risk-radar/scoring-engine \
           --workspace=@academic-risk-radar/web

RUN npm run build --workspace=@academic-risk-radar/shared-types
RUN npm run build --workspace=@academic-risk-radar/scoring-engine
RUN npm run build --workspace=@academic-risk-radar/web

# Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package*.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist
COPY --from=builder /app/packages/scoring-engine/dist ./packages/scoring-engine/dist
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

CMD ["npm", "run", "start", "--workspace=@academic-risk-radar/web"]
