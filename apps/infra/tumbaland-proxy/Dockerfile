FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom configs
COPY conf.d/ /etc/nginx/conf.d/

RUN apk add --no-cache nano certbot openssl python3 py3-pip && \
    python3 -m venv /opt/certbot-venv && \
    /opt/certbot-venv/bin/pip install certbot-dns-cloudflare

ENV PATH="/opt/certbot-venv/bin:$PATH"

WORKDIR /app

COPY . .

RUN chmod +x /app/ensure_certs.sh /app/refresh_certificates.sh

# Expose ports
EXPOSE 80 443

CMD ["/app/ensure_certs.sh", "nginx", "-g", "daemon off;"]
