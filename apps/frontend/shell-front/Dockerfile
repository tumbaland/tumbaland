# ---- Build Stage ----
FROM node:24-alpine AS builder
WORKDIR /app

# Build-time environment variables
ARG VITE_ALBUM_URL
ARG VITE_FINANCE_URL
ARG VITE_RELATIONSHIP_URL
ENV VITE_ALBUM_URL=$VITE_ALBUM_URL
ENV VITE_FINANCE_URL=$VITE_FINANCE_URL
ENV VITE_RELATIONSHIP_URL=$VITE_RELATIONSHIP_URL

COPY . .
RUN npm i
RUN npm run build

# ---- Production Stage ----
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
