#!/bin/bash
# Bash script to start all tumbaland services using individual compose files

set -e
NETWORK="tumbanet"

# Create the shared Docker network if it doesn't exist
if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  echo "Creating Docker network: $NETWORK"
  sudo docker network create "$NETWORK" || true
else
  echo "Docker network $NETWORK already exists."
fi

echo "Starting backend services..."
sudo docker-compose --env-file .env -f apps/backend/public-service/compose.yml up -d
sudo docker-compose --env-file .env -f apps/backend/auth-service/compose.yml up -d
sudo docker-compose --env-file .env -f apps/backend/file-service/compose.yml up -d
sudo docker-compose --env-file .env -f apps/backend/album-service/compose.yml up -d
sudo docker-compose --env-file .env -f apps/backend/finance-service/compose.yml up -d
sudo docker-compose --env-file .env -f apps/backend/relationship-service/compose.yml up -d

echo "Starting frontend services..."
sudo docker-compose --env-file .env -f apps/frontend/auth-front/compose.yml up -d
sudo docker-compose --env-file .env -f apps/frontend/album-front/compose.yml up -d
sudo docker-compose --env-file .env -f apps/frontend/finance-front/compose.yml up -d
sudo docker-compose --env-file .env -f apps/frontend/relationship-front/compose.yml up -d
sudo docker-compose --env-file .env -f apps/frontend/shell-front/compose.yml up -d

echo "Starting proxy..."
sudo docker-compose --env-file .env -f apps/infra/tumbaland-proxy/compose.yml up -d

echo "All services started."
