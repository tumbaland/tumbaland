# AGENTS.md - Tumbaland Codebase Guide

Monorepo containing microservices backend and multiple React frontends for a photo album management platform.

## Quick Start

```sh
# One-time setup
cp .env.example .env
cp apps/backend/*/**.env.example apps/backend/**/.env
npm install

# Start everything
npm run dev

# Start specific service
npm run dev --workspace=album-service
npm run dev --workspace=album-front
```

## NPM Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start all services and frontends |
| `npm run dev --workspace=<name>` | Start single service/frontend |
| `npm run build` | Build all packages |
| `npm run test` | Run all tests |
| `npm run lint` | Lint all code |
| `npm run format` | Format code with Prettier |

## Codebase Structure

```
apps/
├── backend/                    # Express microservices
│   ├── album-service/         # Photo album CRUD + statistics + collages
│   ├── auth-service/          # Authentication + JWT
│   ├── file-service/          # S3-compatible file storage (MinIO)
│   ├── finance-service/       # Financial tracking
│   ├── group-service/         # Group management + members
│   ├── payment-service/       # Payment processing (Stripe)
│   ├── public-service/        # Public API gateway
│   └── relationship-service/  # Social relationships
│
├── frontend/                   # Vite + React 19 applications
│   ├── shell-front/           # Main shell/dashboard
│   ├── album-front/           # Album management + collages
│   ├── auth-front/            # Login/signup/auth flows
│   ├── finance-front/         # Financial dashboard
│   ├── payment-front/         # Payment flows
│   ├── relationship-front/    # Social features
│   ├── group-front/           # Group management
│   └── account-front/         # Account settings
│
├── infra/                      # Docker Compose configs
│   ├── mongodb/               # MongoDB setup
│   ├── rabbitmq/              # Message queue
│   ├── redis/                 # Caching
│   ├── elasticsearch/         # Search engine
│   ├── haproxy/               # Load balancer
│   ├── traefik/               # Reverse proxy
│   └── [other services]/
│
└── libs/                       # Shared code
    ├── core/                  # Backend utilities (validators, permissions, errors)
    └── components/            # React components library (Storybook)
```

## Backend Services

### Album Service (Port 4002)
- **Purpose**: Photo album management, collages, statistics
- **Key Features**:
  - Album CRUD with cover photos
  - Photo lifecycle management (create, retrieve, update, delete)
  - Collage creation and editing
  - Statistics/analytics dashboard
  - AI analysis integration
  - Signed URL generation for file access
- **Architecture**: Service-Oriented (Controllers delegate to Services)
- **Controllers**:
  - `albumController` → `albumService`
  - `photoController` → `photoService`
  - `collageController` → `collageService`
  - `statisticsController` → `statisticsService`
  - `healthController` → `healthService`

### Auth Service (Port 5001)
- **Purpose**: JWT authentication and authorization
- **Key Features**: User login/signup, token generation, token validation

### File Service (Port 5004)
- **Purpose**: S3-compatible file storage using MinIO
- **Key Features**: Direct upload/download, signed URLs, thumbnail generation

### Finance Service (Port 4003)
- **Purpose**: Financial tracking and reporting
- **Key Features**: Transaction management, budget tracking

### Payment Service (Port 5005)
- **Purpose**: Payment processing integration
- **Key Features**: Stripe integration, payment workflows

### Group Service (Port 5006)
- **Purpose**: Group management and membership
- **Key Features**: Group CRUD, member management, permissions

### Relationship Service (Port 4001)
- **Purpose**: Social relationships and connections
- **Key Features**: Friend requests, following, connections

### Public Service (Port 5003)
- **Purpose**: Public API and gateway
- **Key Features**: Rate limiting, public endpoints

## Frontend Applications

| App | Port | Purpose |
|-----|------|---------|
| shell-front | 3000 | Main dashboard and navigation shell |
| album-front | 3002 | Album and photo management UI |
| auth-front | 3004 | Authentication (login/signup) |
| finance-front | 3003 | Financial dashboard |
| payment-front | 3005 | Payment processing UI |
| relationship-front | 3001 | Social features UI |
| group-front | 3006 | Group management UI |
| account-front | 3007 | User account settings |

## Architecture Patterns

### Backend: Service-Oriented Architecture
Each service follows a three-layer pattern:

```typescript
// Controller (thin HTTP handler)
export const getAlbums = async (req: Request, res: Response) => {
  const albums = await albumService.getAlbums();
  res.json({ success: true, data: albums });
};

// Service (business logic)
export async function getAlbums() {
  return Album.find().populate('coverPhoto');
}

// Model (data access)
const album = new Album({ title, userId });
await album.save();
```

### Response Format
All API responses follow a consistent format:
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { /* response payload */ }
}
```

### Frontend: React + TanStack Query
- **State Management**: TanStack Query for server state
- **UI Framework**: Material-UI (MUI)
- **Routing**: React Router v6
- **Build Tool**: Vite

## Environment Variables

Each service needs a `.env` file. Copy from `.env.example`:

```bash
# Root level
DATABASE_URL=mongodb://localhost:27017/tumbaland
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://guest:guest@localhost:5672

# Service-specific (auth-service, album-service, etc.)
PORT=5001
NODE_ENV=development
LOG_LEVEL=debug
JWT_SECRET=your-secret-key
STRIPE_API_KEY=sk_test_...
```

## Port Mapping Reference

### Frontends (3000-3007)
| Port | Service |
|------|---------|
| 3000 | shell-front |
| 3001 | relationship-front |
| 3002 | album-front |
| 3003 | finance-front |
| 3004 | auth-front |
| 3005 | payment-front |
| 3006 | group-front |
| 3007 | account-front |

### Backend Services (4000-5006)
| Port | Service |
|------|---------|
| 4001 | relationship-service |
| 4002 | album-service |
| 4003 | finance-service |
| 5001 | auth-service |
| 5003 | public-service |
| 5004 | file-service |
| 5005 | payment-service |
| 5006 | group-service |

### Infrastructure
| Port | Service |
|------|---------|
| 27017 | MongoDB |
| 6379 | Redis |
| 5672 | RabbitMQ |
| 9200 | Elasticsearch |
| 80/443 | HAProxy/Traefik |

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express 5
- **Database**: MongoDB with Mongoose 8.15.0
- **Authentication**: JWT (jsonwebtoken 9.0.2)
- **Validation**: Joi
- **File Processing**: Sharp 0.34.4 (image thumbnails)
- **Message Queue**: RabbitMQ
- **Caching**: Redis

### Frontend
- **Runtime**: Node.js
- **UI Framework**: React 19
- **Build Tool**: Vite
- **Component Library**: Material-UI (MUI)
- **Routing**: React Router v6
- **State Management**: TanStack Query
- **HTTP Client**: Axios
- **Styling**: CSS-in-JS with MUI

### DevOps
- **Containerization**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Orchestration**: Docker Compose (development), Kubernetes (production)
- **Reverse Proxy**: Traefik/HAProxy
- **Monitoring**: Prometheus + Grafana + Jaeger

## Development Workflow

### Adding a Feature

1. **Backend**:
   - Create model in `src/models/`
   - Create service in `src/services/` (business logic)
   - Create controller in `src/controllers/` (thin HTTP handler)
   - Add routes in `src/routes/`
   - Type everything with TypeScript interfaces

2. **Frontend**:
   - Create service in `src/services/` (API client)
   - Create custom hook in `src/hooks/` (TanStack Query wrapper)
   - Create components in `src/components/`
   - Add pages in `src/pages/`

3. **Testing**:
   - Add unit tests alongside source files
   - Run `npm run test`

4. **Type Safety**:
   - Define shared types in `src/types/`
   - Keep types close to usage
   - Export from barrel files for cleaner imports

## Common Tasks

### Debug a Service
```bash
# Terminal 1: Start service with logging
npm run dev --workspace=album-service

# Terminal 2: Check logs
docker logs tumbaland-album-service

# Or inspect MongoDB directly
mongosh
use tumbaland
db.albums.find()
```

### Test API Endpoints
```bash
# Install REST client or use curl
curl -H "Authorization: Bearer $TOKEN" http://localhost:4002/albums
```

### Check Database
```bash
# Connect to MongoDB
docker exec -it tumbaland-mongodb mongosh
use tumbaland
db.albums.find().pretty()
```

### Update Dependencies
```bash
npm install  # Updates all workspaces
npm update   # Check for updates
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port already in use | Kill process: `lsof -i :3000` → `kill -9 <PID>` |
| MongoDB connection error | Ensure Docker: `docker ps \| grep mongodb` |
| Frontend can't reach API | Check CORS headers and service port in `.env` |
| TypeScript errors | Run `npm run lint` and fix issues |
| Hot reload not working | Clear node_modules: `npm install` |

## Deployment

### GitHub Actions
Workflow: `.github/workflows/deploy-single-service.yml`

Triggers:
- Manual dispatch via GitHub UI
- Push to main branch (automatic)

Process:
1. Build Docker image
2. Push to registry
3. SSH into server
4. Run Docker Compose up with new image
5. Verify health endpoints

### Local Docker Compose
```bash
docker-compose -f apps/infra/docker-compose.yml up -d
```

## Performance Considerations

- **Caching**: Redis for session + frequent queries
- **Pagination**: All list endpoints support `page` and `limit`
- **Batch Operations**: Aggregate pipelines for analytics
- **Signed URLs**: S3-style temporary URLs for file access (avoid streaming)
- **Thumbnails**: Generated on upload, cached in file-service

## Security Practices

- **JWT**: Verified on every request
- **CORS**: Configured per-service
- **Rate Limiting**: Applied at public-service gateway
- **Validation**: Joi schemas on all inputs
- **Secrets**: Environment variables, never committed
- **Permissions**: `canAccessResource()` util for fine-grained checks

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes following the architecture patterns
3. Run tests: `npm run test`
4. Lint: `npm run lint`
5. Format: `npm run format`
6. Push and create pull request