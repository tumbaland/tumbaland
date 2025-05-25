# Relationship Activity API Documentation

This directory contains the OpenAPI 3.0 specification and Swagger UI documentation for the Relationship Activity Tracking API.

## Files

- `openapi.yaml` - Complete OpenAPI 3.0 specification
- `index.html` - Swagger UI documentation interface

## Accessing Documentation

### Online Documentation
When the server is running, you can access the interactive API documentation at:

- **Swagger UI**: http://localhost:4002/api-docs
- **Direct docs**: http://localhost:4002/docs/

### Local Files
- View the OpenAPI spec directly: `openapi.yaml`
- Open `index.html` in a browser for local viewing

## API Overview

The Relationship Activity Tracking API provides endpoints for:

### Core Features
- **CRUD Operations**: Create, read, update, and delete activities
- **Filtering**: Filter activities by type, date range
- **Pagination**: Paginated responses for large datasets
- **Analytics**: Activity statistics and insights

### Activity Structure
Each activity contains:
- **Date**: When the activity took place
- **Hours**: Duration (integer)
- **Activity Object**:
  - **Type**: Category (movies, cooking, dining, date, walk, shopping, gaming, other)
  - **Description**: Detailed description (max 500 chars)

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |
| GET | `/api/activities` | Get activities (with filtering & pagination) |
| POST | `/api/activities` | Create new activity |
| GET | `/api/activities/{id}` | Get specific activity |
| PUT | `/api/activities/{id}` | Update activity |
| DELETE | `/api/activities/{id}` | Delete activity |
| GET | `/api/activities/recent` | Get recent activities |
| GET | `/api/activities/stats` | Get activity statistics |
| GET | `/api/activities/date-range` | Get activities by date range |
| GET | `/api/activities/types` | Get available activity types |

## Example Usage

### Create Activity
```bash
curl -X POST http://localhost:4002/api/activities \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2024-01-25",
    "hours": 3,
    "activity": {
      "type": "movies",
      "description": "Watched a romantic comedy at the cinema"
    }
  }'
```

### Get Activities with Filtering
```bash
curl "http://localhost:4002/api/activities?activityType=movies&startDate=2024-01-01&limit=10"
```

### Get Activity Statistics
```bash
curl "http://localhost:4002/api/activities/stats?startDate=2024-01-01&endDate=2024-01-31"
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
