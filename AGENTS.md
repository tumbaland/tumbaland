# Tumbaland Application Context for AI Agents

## Overview
Tumbaland is a comprehensive full-stack web application built with a microservices architecture. It provides multiple interconnected services for photo management, financial tracking, social relationships, and group collaboration.

## Architecture

### Frontend Services (React + TypeScript + Vite)
- **Port 3001**: Relationship Management Frontend
- **Port 3002**: Album/Photo Management Frontend  
- **Port 3003**: Finance Tracking Frontend
- **Port 3004**: Authentication Frontend
- **Port 3005**: Payment Processing Frontend
- **Port 3006**: Group Management Frontend
- **Port 3000**: Shell/Main Frontend

#### Tenant Components Architecture
Each frontend service includes its own `components/tenant` folder containing:
- **TenantProvider.tsx**: Context provider for tenant management
- **TenantSelector.tsx**: UI component for switching between personal/group contexts  
- **useTenant.ts**: Hook for tenant selection and group fetching
- **useTenantDataRefresh.ts**: Hook for automatic data refresh on tenant changes

> **Important**: These components are duplicated in each frontend (not shared via library) to ensure they're available during deployment without external dependencies.

### Backend Services (Node.js + Express + MongoDB)
- **Port 4000**: Public Service API
- **Port 4001**: Relationship Service API
- **Port 4002**: Album Service API
- **Port 4003**: Finance Service API
- **Port 5001**: Auth Service API
- **Port 5002**: File Service API
- **Port 5005**: Payment Service API
- **Port 5006**: Group Service API

### AI/ML Services (Python)
- **Port 8001**: Image Segmentation Service
- **Port 8002**: Object Detection Service

## Core Features

### 1. Authentication & User Management
- Google OAuth 2.0 integration
- JWT-based session management
- User approval system (auto-approval enabled)
- Multi-service authentication middleware

### 2. Group Management & Permissions
- User groups with role-based access control
- Group invitations and membership management
- Cross-service group permission validation
- Internal service-to-service authentication

### 3. Photo & Album Management
- Photo upload and storage (Google Cloud Storage)
- Album organization and sharing
- AI-powered image processing (segmentation, object detection)
- Photo collages with permission controls
- File metadata and signed URL generation

### 4. Financial Tracking
- Personal portfolio management
- Stock ticker tracking and price history
- Investment performance analytics
- Financial record keeping with group sharing
- Alpha Vantage API integration for market data

### 5. Relationship Management
- Personal and group relationship tracking
- Activity logging and statistics
- Relationship analytics and insights
- Social interaction monitoring

### 6. Payment Processing
- Stripe payment integration
- Subscription management
- Payment history and receipts

## Security Architecture

### Permission System
All services implement a consistent permission model:
- **User Ownership**: Users can access their own data
- **Group Access**: Users can access data shared with their groups  
- **Permission Filtering**: Database queries filtered by `buildAccessQuery(userId, userGroups)`
- **Resource Validation**: Individual resources checked with `canAccessResource()`

### Inter-Service Communication
- **Internal Service Tokens**: Services authenticate with each other using `INTERNAL_SERVICE_TOKEN`
- **Group Context Middleware**: `userGroupsMiddleware` fetches user's group memberships
- **Fallback Behavior**: Services continue with user-only permissions if group service unavailable

### Data Models
All user-generated content includes:
```typescript
{
  userId: string;      // Owner of the resource
  groupId?: string;    // Optional group association for sharing
}
```

## Technology Stack

### Backend
- **Runtime**: Node.js 24+
- **Framework**: Express.js
- **Database**: MongoDB (mongoose ODM)
- **Authentication**: JWT + Google OAuth
- **File Storage**: Google Cloud Storage
- **Payment**: Stripe API
- **Market Data**: Alpha Vantage API
- **Containerization**: Docker + Docker Compose

### Frontend  
- **Framework**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: CSS Modules/Styled Components
- **State Management**: React hooks + Context API
- **HTTP Client**: Fetch API
- **Routing**: React Router

### AI/ML Services
- **Language**: Python
- **Frameworks**: TensorFlow/PyTorch, OpenCV
- **Services**: Image segmentation, object detection

## Environment Configuration

### Required Environment Variables
```bash
# Database
MONGODB_URI=mongodb+srv://...

# Authentication  
JWT_SECRET=your-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id

# File Storage
GOOGLE_CLOUD_KEY_FILE_BASE64=base64-encoded-service-account
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_BUCKET_NAME=your-bucket-name

# Inter-Service Communication
INTERNAL_SERVICE_TOKEN=group_service_internal_token_2024
GROUP_API_URL=http://localhost:5006

# External APIs
ALPHA_VANTAGE_API_KEY=your-api-key
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# CORS & Security
CORS_ORIGIN=http://localhost:3000,http://localhost:3001...
COOKIE_DOMAIN=localhost
```

## Development Workflow

### Common Tasks
1. **Adding New Endpoints**: Follow the pattern of routes → controller → service → model
2. **Permission Checks**: Always add `userGroupsMiddleware` and implement `buildAccessQuery` filtering
3. **Error Handling**: Use consistent error responses with appropriate HTTP status codes
4. **Service Communication**: Use internal tokens for service-to-service calls

### Security Checklist
- [ ] Routes have `authenticateToken` middleware
- [ ] Routes have `userGroupsMiddleware` for group context
- [ ] Service functions accept `userId` and `userGroups` parameters  
- [ ] Database queries use `buildAccessQuery()` for permission filtering
- [ ] Individual resources checked with `canAccessResource()`
- [ ] Proper error handling for `ACCESS_DENIED` (403 status)

## Recent Security Fixes (Applied)

### Critical Vulnerabilities Fixed
1. **Relationship Statistics**: Previously exposed all user statistics to any authenticated user
2. **Album Collages**: Fixed unauthorized access to other users' collages  
3. **Finance Portfolios**: Resolved data exposure where all portfolios were visible
4. **Tracked Tickers**: Added user-specific permissions to financial ticker management

### Security Pattern Applied
All services now consistently implement:
```typescript
// Route level
router.get('/', authenticateToken, userGroupsMiddleware, controller);

// Controller level  
const user = (req as any).user;
const userGroups = (req as any).userGroups || [];
const data = await service.getData(user.id, userGroups);

// Service level
export const getData = async (userId: string, userGroups: string[] = []) => {
  const accessQuery = buildAccessQuery(userId, userGroups, false);
  return Model.find(accessQuery);
};
```

## Troubleshooting Common Issues

### Group Service 401 Errors
- Ensure all services use same `INTERNAL_SERVICE_TOKEN=group_service_internal_token_2024`
- Check `GROUP_API_URL` points to correct group service endpoint
- Verify group service is running and accessible

### CORS Issues
- Update `CORS_ORIGIN` environment variable with all frontend URLs
- Check frontend API URLs match backend service ports

### File Upload Issues
- Verify Google Cloud Storage credentials and bucket permissions
- Check `GOOGLE_CLOUD_KEY_FILE_BASE64` is properly encoded service account

## API Patterns

### Standard Response Format
```typescript
// Success
{ data: any, success: true }

// Error  
{ error: string, success: false }

// List with metadata
{ items: any[], total: number, page: number }
```

### Common HTTP Status Codes
- `200`: Success
- `201`: Created
- `204`: No Content (successful delete)
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `500`: Internal Server Error

## Database Schema Patterns

### User-Owned Resources
```typescript
interface UserResource {
  _id: ObjectId;
  userId: string;        // Required: Resource owner
  groupId?: string;      // Optional: Group sharing
  createdAt: Date;
  updatedAt: Date;
  // ... other fields
}
```

### Audit Fields
Most models include:
- `createdAt`: Resource creation timestamp
- `updatedAt`: Last modification timestamp  
- `userId`: Resource owner for permission checking
- `groupId`: Optional group association for sharing

## Deployment Notes

### Docker Compose Structure
- Each service has its own `compose.yml` and `Dockerfile`
- Services communicate through `tumbanet` Docker network
- Environment variables passed through `.env` files
- Build images tagged as `toomastahves/service-name:latest`

### Production Considerations
- All services should run behind reverse proxy (nginx)
- Implement rate limiting and request size limits
- Use production MongoDB cluster with proper indexing
- Enable HTTPS with SSL certificates
- Configure monitoring and logging
- Set up automated backups for user data

---

*This document should be updated as new features are added or architectural changes are made.*