# Tumbaland Monorepo

## Quick Start

1. **Copy and configure environment variables:**
   - Copy `.env.example` to `.env` and fill in missing values.
   - For production/CI, use `.env.production`.

2. **Build services:**
   - You can build all services at once (from the root):
     ```sh
     sudo docker-compose --env-file .env -f apps/backend/{service-name}/compose.yml build
     ```
   - Or use the provided script to build and start everything:
     ```sh
     sh startup.sh
     ```

3. **Access the app:**
   - Main site: http://localhost:3000 or https://tumbaland.eu
   - Other services: see Nginx config for subdomains.

4. **Stop services:**
   ```sh
   sudo docker-compose -f apps/backend/{service-name}/compose.yml down
   # Or stop all containers:
   sudo docker rm -f $(sudo docker ps -aq)
   sudo docker image prune -a
   ```

6. **Build or start a single service separately:**
   ```sh
   sudo docker-compose --env-file .env -f apps/backend/album-service/compose.yml build
   sudo docker-compose --env-file .env -f apps/backend/album-service/compose.yml up -d
   ```

---

- All services use a shared external Docker network: `tumbanet`.
- The root `.env` file is used for all services via the `--env-file` option.
- See `startup.sh` (Linux/macOS/WSL) for automated startup.
