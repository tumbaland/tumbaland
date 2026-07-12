FROM node:26-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm i
COPY . .
RUN npm run build

FROM node:26-alpine AS production
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/docs ./docs
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 5002
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:${PORT:-5002}/health/live || exit 1
CMD ["node", "dist/index.js"]
