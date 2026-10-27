# syntax=docker/dockerfile:1

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22.23.4-alpine@sha256:fe4f6d74e20370acb04ad889077d14d0f64a9c8ea6a42bc60cddf1e844699914
# Процесс — node, не npm. Глобальный npm Node 22.23.4 всё ещё тащит
# brace-expansion 2.0.2, pacote 19 и http-cache-semantics 4.2; в рантайме их нет.
USER root
RUN rm -rf /usr/local/lib/node_modules/npm \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx
WORKDIR /app
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    READ_ONLY=true \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3000 \
    MCP_HTTP_PATH=/mcp
# MCP_AUTH_TOKEN, WB_API_TOKEN, MCP_ALLOWED_HOSTS must be provided at runtime
# (image binds 0.0.0.0; without MCP_ALLOWED_HOSTS the process exits).
# Optional: MCP_SESSION_MAX (32), MCP_SESSION_IDLE_TTL_MS (1800000)
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.MCP_HTTP_PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
