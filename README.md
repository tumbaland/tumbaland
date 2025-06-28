# Tumbaland Monorepo

## Quick Start

1. **Copy and configure environment variables:**
   - Copy `.env.example` to `.env` and fill in missing values.
   - For production/CI, use `.env.production`.

2. **Build all services:**
   ```sh
   sudo docker-compose build --no-cache
   ```

3. **Start all services:**
   ```sh
   sudo docker-compose up -d
   ```

4. **Access the app:**
   - Main site: https://tumbaland.eu
   - Other services: see Nginx config for subdomains.

5. **Stop all services:**
   ```sh
   sudo docker compose down && docker image prune -a
   ```
