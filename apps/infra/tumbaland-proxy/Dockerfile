FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY conf.d/ /etc/nginx/conf.d/

RUN apk add --no-cache nano certbot openssl

WORKDIR /app

COPY . .

RUN chmod +x /app/ensure_certs.sh /app/refresh_certificates.sh

# Expose ports
EXPOSE 80 443

CMD ["/app/ensure_certs.sh", "nginx", "-g", "daemon off;"]
