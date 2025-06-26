# Tumbaland Monorepo

## Quick Start

1. **Copy and configure environment variables:**
   - Copy `.env.example` to `.env` and fill in required values.
   - For production/CI, use `.env.production`.

2. **Build all services:**
   ```sh
   docker compose build --no-cache
   ```

3. **Start all services:**
   ```sh
   docker compose up -d
   ```

4. **Access the app:**
   - Main site: https://tumbaland.eu
   - Other services: see your Nginx config for subdomains.

5. **Stop all services:**
   ```sh
   docker compose down
   ```

---
- Make sure your DNS and SSL certificates are set up for your domains.
- For local development, use the appropriate `.env` values (e.g., localhost URLs).
- For troubleshooting, check logs with `docker compose logs <service>`.
