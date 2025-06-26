# ---- Build Stage ----
FROM node:24-alpine AS builder
WORKDIR /app

# Build-time environment variables
ARG VITE_GOOGLE_CLIENT_ID
ARG VITE_AUTH_SERVICE_URL
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL

COPY . .
RUN npm i
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
