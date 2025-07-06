# ---- Build Stage ----
FROM node:24-alpine AS builder
WORKDIR /app

COPY . .
RUN npm i
RUN npm run build

# ---- Production Stage ----
FROM nginx:1.26-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
