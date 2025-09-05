# Tumbaland - AI-Powered Photo Album Platform

## Project Overview

Tumbaland is a comprehensive photo album management platform with AI-powered features including image segmentation, object detection, and intelligent photo organization. The platform supports user authentication, group collaboration, financial tracking, and relationship management.

## Architecture

### Micro-Frontend Architecture
- **Shell Application**: Main container app (`shell-front`) that orchestrates other frontend applications
- **Feature Applications**: Independent frontend apps for specific domains:
  - `album-front`: Photo album management with AI features
  - `auth-front`: User authentication and authorization
  - `account-front`: User account management
  - `finance-front`: Financial tracking and payments
  - `group-front`: Group collaboration features
  - `payment-front`: Payment processing
  - `relationship-front`: Social relationship management

### Microservices Backend
- **album-service**: Photo album business logic and AI processing
- **auth-service**: Authentication and user management
- **file-service**: File storage and processing
- **finance-service**: Financial operations
- **group-service**: Group management
- **payment-service**: Payment processing
- **relationship-service**: Relationship management
- **public-service**: Public API endpoints
- **tumbaland-proxy**: API gateway and reverse proxy

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context API
- **Container**: Docker with Nginx

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT tokens
- **File Storage**: Google Cloud Storage
- **Payment**: Stripe integration

### Infrastructure
- **Containerization**: Docker & Docker Compose
- **CI/CD**: GitHub Actions
- **Reverse Proxy**: Nginx

## Project Structure

```
tumbaland/
├── apps/
│   ├── frontend/
│   │   ├── shell-front/          # Main container application
│   │   ├── album-front/          # Photo album management
│   │   ├── auth-front/           # Authentication
│   │   ├── account-front/        # Account management
│   │   ├── finance-front/        # Financial tracking
│   │   ├── group-front/          # Group collaboration
│   │   ├── payment-front/        # Payment processing
│   │   ├── relationship-front/   # Relationship management
│   │   └── [each has]:
│   │       ├── src/
│   │       │   ├── components/   # Reusable UI components
│   │       │   ├── config/       # Configuration management
│   │       │   ├── pages/        # Page components
│   │       │   ├── services/     # API service layer
│   │       │   └── utils/        # Utility functions
│   │       ├── public/           # Static assets
│   │       ├── Dockerfile        # Container build
│   │       ├── docker-entrypoint.sh  # Runtime config generation
│   │       ├── compose.yml       # Local development
│   │       ├── nginx.conf        # Web server config
│   │       ├── package.json      # Dependencies
│   │       ├── tsconfig.json     # TypeScript config
│   │       └── vite.config.ts    # Build configuration
│   └── backend/
│       ├── [service-name]/
│       │   ├── src/
│       │   ├── Dockerfile
│       │   ├── compose.yml
│       │   ├── package.json
│       │   └── nodemon.json
│       └── tumbaland-proxy/      # API Gateway
├── libs/
│   └── components/               # Shared UI components
├── infra/
│   └── stripe-cli/               # Stripe CLI configuration
├── scripts/                      # Utility scripts
└── .github/
    └── workflows/
        └── deploy-single-service.yml  # CI/CD pipeline
```

## Deployment Architecture

### Development Environment
- **Local Development**: Docker Compose for all services
- **Hot Reload**: Vite dev server for frontend apps
- **Environment Variables**: `.env.example` files with VITE_ prefixes
- **Service Communication**: Direct HTTP calls between services

### Production Environment
- **Containerization**: Each service runs in Docker container
- **Orchestration**: Docker Compose on production server
- **Configuration**: Runtime environment variables (no VITE_ prefixes)
- **Load Balancing**: Nginx reverse proxy

### CI/CD Pipeline
- **Trigger**: Manual deployment via GitHub Actions
- **Build Process**:
  1. Checkout code
  2. Build Docker image
  3. Push to Docker Hub
  4. Generate environment variables
  5. Deploy to production server via SSH
  6. Restart services with new configuration

## Configuration Management

### Environment Variables Strategy

#### Development (VITE_ prefixed)
```bash
# .env.example files
VITE_ALBUM_API_URL=http://localhost:4002
VITE_AUTH_SERVICE_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=your_client_id
```

#### Production (Clean names)
```bash
# GitHub Actions generates
ALBUM_API_URL=https://album-api.tumbaland.eu
AUTH_SERVICE_URL=https://auth-api.tumbaland.eu
GOOGLE_CLIENT_ID=production_client_id
```

### Runtime Configuration Generation

Each frontend application generates `config.json` at runtime:

```javascript
// Development: Uses VITE_ variables directly
const config = {
  ALBUM_API_URL: import.meta.env.VITE_ALBUM_API_URL,
  AUTH_SERVICE_URL: import.meta.env.VITE_AUTH_SERVICE_URL
}

// Production: Loads from config.json
fetch('/config.json').then(config => {
  // Use runtime configuration
})
```

## Key Workflows

### Development Workflow
1. **Clone Repository**: `git clone <repo>`
2. **Install Dependencies**: `npm install` in each frontend/backend service
3. **Environment Setup**: Copy `.env.example` to `.env` and configure
4. **Start Services**: `docker-compose up` for all services
5. **Development**: Use Vite dev servers for hot reload

### Deployment Workflow
1. **GitHub Actions Trigger**: Manual deployment selection
2. **Service Selection**: Choose which service to deploy
3. **Docker Build**: Build and push image to Docker Hub
4. **Environment Generation**: Create production .env file
5. **Server Deployment**: SSH to production server
6. **Service Restart**: Update and restart containers

### Environment Management
- **Development**: VITE_ prefixed variables in .env files
- **Production**: Clean variable names via GitHub repository variables
- **Runtime Config**: Generated config.json with actual values
- **Security**: Secrets stored in GitHub repository secrets

## Service Communication

### API Gateway (tumbaland-proxy)
- **Routing**: Routes requests to appropriate backend services
- **Load Balancing**: Distributes load across service instances
- **Authentication**: Validates JWT tokens
- **CORS**: Handles cross-origin requests

### Inter-Service Communication
- **HTTP/HTTPS**: RESTful APIs between services
- **Service Discovery**: Direct URLs for service communication
- **Authentication**: Internal service tokens for backend communication

## Security Considerations

### Authentication & Authorization
- **JWT Tokens**: Stateless authentication
- **Google OAuth**: Social login integration
- **Role-Based Access**: Different permission levels

### Data Protection
- **Environment Variables**: No secrets in codebase
- **HTTPS Only**: Encrypted communication
- **Input Validation**: Sanitized user inputs

### Infrastructure Security
- **Container Security**: Minimal base images
- **Secret Management**: GitHub secrets for sensitive data
- **Access Control**: SSH key-based server access

## Development Best Practices

### Code Organization
- **Component Structure**: Reusable, modular components
- **Service Layer**: Centralized API communication
- **Type Safety**: Full TypeScript coverage

### Testing Strategy
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user journey testing

This architecture provides a scalable, maintainable, and secure platform for photo album management with AI-powered features, supporting both development and production environments efficiently.

## Development Best Practices

### Code Organization
- **Component Structure**: Reusable, modular components
- **Service Layer**: Centralized API communication
- **Type Safety**: Full TypeScript coverage
- **Error Boundaries**: Graceful error handling

### Testing Strategy
- **Unit Tests**: Component and utility testing
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Full user journey testing

This architecture provides a scalable, maintainable, and secure platform for photo album management with AI-powered features, supporting both development and production environments efficiently.