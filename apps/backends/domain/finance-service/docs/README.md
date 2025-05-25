# Finance Asset Tracking API Documentation

This directory contains the OpenAPI 3.0 specification and Swagger UI documentation for the Finance Asset Tracking API.

## Files

- `openapi.yaml` - Complete OpenAPI 3.0 specification
- `index.html` - Swagger UI documentation interface

## Accessing Documentation

### Online Documentation
When the server is running, you can access the interactive API documentation at:

- **Swagger UI**: http://localhost:4001/api-docs
- **Direct docs**: http://localhost:4001/docs/

### Local Files
- View the OpenAPI spec directly: `openapi.yaml`
- Open `index.html` in a browser for local viewing

## API Overview

The Finance Asset Tracking API provides endpoints for:

### Core Features
- **CRUD Operations**: Create, read, update, and delete assets
- **Portfolio Management**: Get portfolio summary and performance metrics
- **Analytics**: Top performing assets and trend analysis
- **Filtering**: Filter assets by name, date range
- **Bulk Operations**: Update multiple asset prices at once

### Asset Structure
Each asset contains:
- **Name**: Asset name/symbol (e.g., "AAPL", "Tesla Stock")
- **Quantity**: Number of shares/units owned
- **Buy Price**: Price at which the asset was purchased
- **Current Price**: Current market price
- **Date**: Date of purchase/entry

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/assets` | Get assets (with filtering & pagination) |
| POST | `/api/assets` | Create new asset |
| GET | `/api/assets/{id}` | Get specific asset |
| PUT | `/api/assets/{id}` | Update asset |
| DELETE | `/api/assets/{id}` | Delete asset |
| GET | `/api/assets/recent` | Get recent assets |
| GET | `/api/assets/portfolio-summary` | Get portfolio summary |
| GET | `/api/assets/date-range` | Get assets by date range |
| GET | `/api/assets/top-performers` | Get top performing assets |
| PUT | `/api/assets/update-prices` | Bulk update current prices |

## Example Usage

### Create Asset
```bash
curl -X POST http://localhost:4001/api/assets \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AAPL",
    "quantity": 10,
    "buyPrice": 150.00,
    "currentPrice": 175.50,
    "date": "2024-01-15"
  }'
```

### Get Assets with Filtering
```bash
curl "http://localhost:4001/api/assets?name=AAPL&startDate=2024-01-01&limit=10"
```

### Get Portfolio Summary
```bash
curl "http://localhost:4001/api/assets/portfolio-summary"
```

### Bulk Update Prices
```bash
curl -X PUT http://localhost:4001/api/assets/update-prices \
  -H "Content-Type: application/json" \
  -d '[
    {"id": "asset_id_1", "currentPrice": 180.00},
    {"id": "asset_id_2", "currentPrice": 95.50}
  ]'
```

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

### Error Response
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Development

To update the documentation:

1. Edit `openapi.yaml` with your changes
2. Restart the server
3. Refresh the documentation page

The Swagger UI will automatically load the updated specification.
