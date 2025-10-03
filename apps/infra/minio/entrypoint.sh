#!/bin/bash

set -e

echo "🚀 Starting MinIO initialization..."

# Wait for MinIO to be available
until mc alias set myminio http://minio:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}"; do
    echo "⏳ MinIO not ready, waiting..."
    sleep 2
done

echo "✅ MinIO is ready!"

# Create buckets
echo "📦 Creating buckets..."
mc mb myminio/album --ignore-existing

echo "🔐 Setting up users..."

# Create service users
mc admin user add myminio album-service "${MINIO_ALBUM_SERVICE_PASSWORD}" || echo "Album service user may already exist"

# Create and attach policies
if [ -f "/init/album-service-policy.json" ]; then
    mc admin policy create myminio album-service-policy /init/album-service-policy.json || echo "Album policy may already exist"
    mc admin policy attach myminio album-service-policy --user album-service
fi

echo "✅ MinIO initialization complete!"