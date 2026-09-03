# ---- Build Stage ----
FROM node:26-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm i --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf

# Copy and make entrypoint script executable
COPY ./docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
