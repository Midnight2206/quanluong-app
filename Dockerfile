# Monorepo Quan Luong — một file, nhiều stage. Compose chọn bằng target.
#   backend       → API + migrate + worker (Node)
#   ui-dev        → Next.js `next dev` (không Nginx) — chỉ docker-compose.dev.yml
#   ui            → Production: Nginx + Next.js apps/web (standalone)
#   ui-superadmin → Production: Nginx + Next.js apps/superadmin (standalone)

# =============================================================================
# Backend (app | migrate | worker-email)
# =============================================================================
FROM node:22-bookworm-slim AS backend-builder
WORKDIR /app
# Prisma cần OpenSSL; bookworm-slim thiếu → cảnh báo "failed to detect libssl" nếu không cài.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# Build-time URL chỉ phục vụ `prisma generate` (Prisma 7 + prisma.config.ts). Khi compose truyền rỗng, vẫn có fallback.
ARG DATABASE_URL=mysql://root:change-me@db:3306/quanluong
ENV DATABASE_URL=${DATABASE_URL:-mysql://root:change-me@db:3306/quanluong}
COPY quanluong-app-be/package*.json ./
RUN npm ci
COPY quanluong-app-be/ ./
RUN npx prisma generate

# Dev: đủ devDependencies (nodemon) — docker-compose.dev.yml build target backend-dev
FROM backend-builder AS backend-dev
EXPOSE 3000
CMD ["npm", "run", "dev"]

FROM node:22-bookworm-slim AS backend
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ARG DATABASE_URL=mysql://root:change-me@db:3306/quanluong
ENV DATABASE_URL=${DATABASE_URL:-mysql://root:change-me@db:3306/quanluong}
COPY quanluong-app-be/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=backend-builder /app/src ./src
COPY --from=backend-builder /app/scripts ./scripts
RUN chmod +x scripts/prisma-migrate-deploy-recover.sh
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "src/server.js"]

# =============================================================================
# Next.js (workspace) — cài dependency
# =============================================================================
FROM node:22-bookworm-slim AS next-deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
COPY apps/superadmin/package.json apps/superadmin/
RUN npm ci

FROM next-deps AS next-sources
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
COPY apps/superadmin ./apps/superadmin

# =============================================================================
# UI dev — Next.js `next dev`, không Nginx (docker-compose.dev.yml ghi đè CMD / cổng).
# =============================================================================
FROM next-sources AS ui-dev
ENV NODE_ENV=development
EXPOSE 3000 3001
CMD ["npm", "run", "dev", "--workspace=@quanluong/web", "--", "-H", "0.0.0.0"]

# =============================================================================
# Build từng app (tách stage để image ui không build superadmin và ngược lại)
# =============================================================================
FROM next-sources AS next-web-built
ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_MAIN_APP_ORIGIN=http://localhost:8080
ARG NEXT_PUBLIC_SUPERADMIN_ORIGIN=http://localhost:8081
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MAIN_APP_ORIGIN=$NEXT_PUBLIC_MAIN_APP_ORIGIN
ENV NEXT_PUBLIC_SUPERADMIN_ORIGIN=$NEXT_PUBLIC_SUPERADMIN_ORIGIN
RUN npm run build --workspace=@quanluong/web

FROM next-sources AS next-superadmin-built
ARG NEXT_PUBLIC_API_BASE_URL=/api
ARG NEXT_PUBLIC_MAIN_APP_ORIGIN=http://localhost:8080
ARG NEXT_PUBLIC_SUPERADMIN_ORIGIN=http://localhost:8081
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_MAIN_APP_ORIGIN=$NEXT_PUBLIC_MAIN_APP_ORIGIN
ENV NEXT_PUBLIC_SUPERADMIN_ORIGIN=$NEXT_PUBLIC_SUPERADMIN_ORIGIN
RUN npm run build --workspace=@quanluong/superadmin

# =============================================================================
# UI chính → Nginx :80 + Next :3000 (target: ui)
# =============================================================================
FROM node:22-bookworm-slim AS ui
RUN apt-get update -y && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/conf.d/default.conf \
  && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY --from=next-web-built /app/apps/web/.next/standalone ./
COPY --from=next-web-built /app/apps/web/.next/static ./apps/web/.next/static

COPY docker/nginx/next-spa-api.conf /etc/nginx/conf.d/default.conf
COPY docker/docker-entrypoint-next-ui.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV NEXT_UI_APP=web
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]

# =============================================================================
# UI superadmin (target: ui-superadmin)
# =============================================================================
FROM node:22-bookworm-slim AS ui-superadmin
RUN apt-get update -y && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && rm -f /etc/nginx/conf.d/default.conf \
  && rm -f /etc/nginx/sites-enabled/default

WORKDIR /app
COPY --from=next-superadmin-built /app/apps/superadmin/.next/standalone ./
COPY --from=next-superadmin-built /app/apps/superadmin/.next/static ./apps/superadmin/.next/static

COPY docker/nginx/next-spa-api.conf /etc/nginx/conf.d/default.conf
COPY docker/docker-entrypoint-next-ui.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV NEXT_UI_APP=superadmin
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
