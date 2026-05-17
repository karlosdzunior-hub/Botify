FROM node:22-alpine AS base
RUN npm install -g pnpm
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-spec/package.json ./lib/api-spec/
COPY artifacts/mini-app/package.json ./artifacts/mini-app/
COPY scripts/package.json ./scripts/
RUN pnpm install --frozen-lockfile --filter @workspace/mini-app...

FROM deps AS builder
COPY tsconfig.base.json tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/mini-app/ ./artifacts/mini-app/
COPY attached_assets/ ./attached_assets/

ENV BASE_PATH=/
ENV PORT=3000
ENV NODE_ENV=production

RUN pnpm --filter @workspace/api-zod build 2>/dev/null || true
RUN pnpm --filter @workspace/api-client-react build 2>/dev/null || true
RUN pnpm --filter @workspace/mini-app build

FROM nginx:alpine AS runner
COPY --from=builder /app/artifacts/mini-app/dist/public /usr/share/nginx/html
EXPOSE 80 443
