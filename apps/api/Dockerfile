FROM node:20-alpine AS builder
WORKDIR /app

# Build deps para native canvas (chartjs-node-canvas): cairo, pango, jpeg, giflib
RUN apk add --no-cache build-base cairo-dev pango-dev jpeg-dev giflib-dev pixman-dev python3

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

RUN npm ci --workspace=@qa-metrics/api --workspace=@qa-metrics/database --workspace=@qa-metrics/types --workspace=@qa-metrics/utils --include-workspace-root

COPY packages/ packages/
COPY apps/api/ apps/api/

RUN cd packages/database && npx prisma generate
RUN cd packages/types && npx tsc || true
RUN cd packages/utils && npx tsc || true
RUN cd packages/database && npx tsc || true
RUN cd apps/api && npx tsc

# --- Etapa de produccion ---
FROM node:20-alpine
WORKDIR /app

# Runtime libs para canvas (chartjs-node-canvas): cairo, pango, jpeg, giflib
RUN apk add --no-cache cairo pango jpeg giflib pixman

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

# Instalar deps sin dev pero incluyendo nativos recompilados en builder
RUN apk add --no-cache --virtual .build-deps build-base cairo-dev pango-dev jpeg-dev giflib-dev pixman-dev python3 \
 && npm ci --omit=dev --workspace=@qa-metrics/api --workspace=@qa-metrics/database --workspace=@qa-metrics/types --workspace=@qa-metrics/utils --include-workspace-root \
 && apk del .build-deps
RUN npm i -g tsx

COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/assets ./apps/api/assets

WORKDIR /app/apps/api

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["tsx", "dist/index.js"]
