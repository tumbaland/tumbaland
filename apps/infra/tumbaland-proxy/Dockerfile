FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY conf.d/ /etc/nginx/conf.d/

RUN apk add nano certbot openssl

WORKDIR /app

# Copy entrypoint script
COPY ../certificates/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

COPY . .

# Expose ports
EXPOSE 80 443

ENTRYPOINT ["/entrypoint.sh"]
