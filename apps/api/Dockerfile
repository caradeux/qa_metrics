FROM node:20-alpine AS builder
WORKDIR /app

# Copiar archivos de configuracion del monorepo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

# Instalar dependencias
RUN npm ci --workspace=@qa-metrics/api --workspace=@qa-metrics/database --workspace=@qa-metrics/types --workspace=@qa-metrics/utils --include-workspace-root

# Copiar codigo fuente
COPY packages/ packages/
COPY apps/api/ apps/api/

# Generar Prisma client
RUN cd packages/database && npx prisma generate

# Compilar packages y API
RUN cd packages/types && npx tsc || true
RUN cd packages/utils && npx tsc || true
RUN cd packages/database && npx tsc || true
RUN cd apps/api && npx tsc

# --- Etapa de produccion ---
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/package.json .
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
