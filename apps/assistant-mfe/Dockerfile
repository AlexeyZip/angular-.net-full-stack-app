# syntax=docker/dockerfile:1
# The assistant microfrontend: built and deployed independently of the shop (apps/web).
# It needs nothing from libs/; the host loads /mfe/assistant/main.js at runtime.
# Build context: repository root (see docker-compose.yml).

FROM node:22-bookworm-slim AS build
ENV NX_DAEMON=false \
    NX_NO_CLOUD=true \
    CI=true
WORKDIR /workspace

# npm 10.9.0 (bundled with this Node line) has an install bug with this lockfile; see KNOWN_ISSUES.md.
RUN npm install -g npm@11
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY nx.json tsconfig.base.json ./
COPY apps/assistant-mfe apps/assistant-mfe
RUN npx nx run assistant-mfe:build:production --outputPath=dist/docker-mfe --skip-nx-cache

FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime
COPY apps/assistant-mfe/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/dist/docker-mfe/browser /usr/share/nginx/html/mfe/assistant
EXPOSE 8080
