FROM node:20-alpine AS builder
WORKDIR /app

# Copiar archivos de configuracion del monorepo
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/database/package.json packages/database/
COPY packages/types/package.json packages/types/
COPY packages/utils/package.json packages/utils/

# Instalar dependencias
RUN npm ci --workspace=@qa-metrics/web --workspace=@qa-metrics/database --workspace=@qa-metrics/types --workspace=@qa-metrics/utils --include-workspace-root

# Copiar codigo fuente
COPY packages/ packages/
COPY apps/web/ apps/web/

# Generar Prisma client
RUN cd packages/database && npx prisma generate

# Build arguments para variables de entorno en build time
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Build Next.js
RUN cd apps/web && npm run build

# --- Etapa de produccion ---
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json .
COPY --from=builder /app/apps/web/next.config.ts .
COPY --from=builder /app/packages ./packages

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
