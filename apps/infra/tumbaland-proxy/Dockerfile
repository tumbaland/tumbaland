FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY conf.d/ /etc/nginx/conf.d/

RUN apk add nano certbot

WORKDIR /app

COPY . .

# Expose ports
EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
