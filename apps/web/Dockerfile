# syntax=docker/dockerfile:1
# Builds one state-management variant of the storefront and serves it with an unprivileged nginx
# that also reverse-proxies /api to the API container, so the browser sees a single origin.
# Build context: repository root (see docker-compose.yml).
#   WEB_CONFIGURATION=production       -> Signals variant
#   WEB_CONFIGURATION=production-ngrx  -> NgRx variant

FROM node:22-bookworm-slim AS build
ARG WEB_CONFIGURATION=production
ENV NX_DAEMON=false \
    NX_NO_CLOUD=true \
    CI=true
WORKDIR /workspace

# npm 10.9.0 (bundled with this Node line) has an install bug with this lockfile; see KNOWN_ISSUES.md.
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY nx.json tsconfig.base.json vitest.config.mts eslint.config.mjs ./
COPY apps/web apps/web
COPY libs libs
RUN npx nx run "web:build:${WEB_CONFIGURATION}" --outputPath=dist/docker-web --skip-nx-cache

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY apps/web/nginx-security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /workspace/dist/docker-web/browser /usr/share/nginx/html
EXPOSE 8080
