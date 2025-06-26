# ---- Build Stage ----
FROM node:24-alpine AS builder
WORKDIR /app

# Build-time environment variables
ARG VITE_RELATIONSHIP_API_URL
ARG VITE_AUTH_SERVICE_URL
ARG VITE_AUTH_FRONT_URL
ENV VITE_RELATIONSHIP_API_URL=$VITE_RELATIONSHIP_API_URL
ENV VITE_AUTH_SERVICE_URL=$VITE_AUTH_SERVICE_URL
ENV VITE_AUTH_FRONT_URL=$VITE_AUTH_FRONT_URL

COPY . .
RUN npm i
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
