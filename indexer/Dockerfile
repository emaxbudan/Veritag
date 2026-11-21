FROM node:22-alpine AS base
RUN apk add --no-cache curl && corepack enable

WORKDIR /app
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/sdk/package.json packages/sdk/package.json
COPY indexer/package.json indexer/package.json
RUN pnpm install --frozen-lockfile=false

COPY packages/sdk packages/sdk
COPY indexer indexer
RUN pnpm --filter @veritag/sdk build && pnpm --filter @veritag/indexer build

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -sf http://localhost:8080/healthz || exit 1

CMD ["pnpm", "--filter", "@veritag/indexer", "start"]
