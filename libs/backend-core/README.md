# @tumbaland/backend-core

Core shared functionality for Tumbaland backend services.

## Installation

```bash
npm install @tumbaland/backend-core
```

## Usage

### Basic Service Setup

```typescript
import express from 'express';
import {
  logger,
  healthCheck,
  connectDB,
  requestLogger,
  errorHandler,
  correlationMiddleware
} from '@tumbaland/backend-core';

const app = express();

// Environment variables
process.env.SERVICE_NAME = 'my-service';
process.env.SERVICE_DESCRIPTION = 'My awesome service';

// Middleware
app.use(correlationMiddleware);
app.use(requestLogger);

// Routes
app.get('/health', healthCheck);

// Error handling (must be last)
app.use(errorHandler);

// Start server
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      logger.info(`🚀 Service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    logger.error('Failed to start service:', error);
    process.exit(1);
  });
```

### Using Authentication

```typescript
import { authenticateToken } from '@tumbaland/backend-core';

app.get('/protected', authenticateToken, (req, res) => {
  const user = (req as any).user;
  res.json({ message: `Hello ${user.name}!` });
});
```

### Health Checks (unified standard)

Every service mounts the same `/health` readiness endpoint via the
`createHealthCheck` factory — one response contract across all services, so
monitoring and dashboards see identical shapes:

```typescript
import { createHealthCheck } from '@tumbaland/backend-core';

// DB-backed service (default): reports `dependencies.mongodb` and returns 503
// while the connection is down.
export const healthCheck = createHealthCheck({
  service: 'my-service',
  description: 'My awesome service'
});

// Service with no database: readiness is a static ok, no `dependencies`.
export const healthCheck = createHealthCheck({
  service: 'public-service',
  description: 'Public API endpoints service',
  checkDatabase: false
});

app.get('/health', healthCheck);
```

Response body: `{ status, service, type: 'backend', timestamp, version, description }`,
plus `dependencies.mongodb` when `checkDatabase` is on. `/health/live` (liveness,
no dependency checks — used by the Docker `HEALTHCHECK`) is mounted separately by
`createBaseApp`.

### Graceful Shutdown

`registerShutdown` wires `SIGINT` **and** `SIGTERM` (the signal Docker/Kubernetes
send on stop and rollout) to drain the HTTP server and close the MongoDB
connection before the process exits:

```typescript
import { registerShutdown } from '@tumbaland/backend-core';

const server = app.listen(PORT, () => logger.info('Service started', { port: PORT }));

// DB-backed service
registerShutdown({ serviceName: 'my-service', server });

// No-DB service: skip the Mongo disconnect
registerShutdown({ serviceName: 'public-service', server, disconnectDatabase: false });
```

The handler is idempotent and self-arms a force-exit timer so a hung close still
terminates.

### Structured Logging

```typescript
import { logger } from '@tumbaland/backend-core';

// Different log levels
logger.error('Database connection failed', { error: err.message });
logger.warn('High memory usage detected', { usage: '85%' });
logger.info('User logged in', { userId: '123', ip: '192.168.1.1' });
logger.debug('Processing request', { correlationId: req.correlationId });
```

### API Responses

```typescript
import { sendSuccess, sendError } from '@tumbaland/backend-core';

app.get('/api/users', (req, res) => {
  // Success response
  sendSuccess(res, users, 'Users retrieved successfully');

  // Error response
  sendError(res, 'Failed to retrieve users', 500, 'Database error');
});
```

## Environment Variables

- `NODE_ENV`: `development` or `production`
- `SERVICE_NAME`: Name of your service
- `SERVICE_DESCRIPTION`: Description of your service
- `LOG_TO_FILE`: Set to `true` to also log to files (development only)

## Docker Logging

This library is optimized for Docker deployments:

- Logs to stdout/stderr by default
- Use structured JSON in production
- Integrates with Docker logging drivers
- Compatible with log aggregation tools (ELK, Loki, etc.)

## Development vs Production

### Development
- Colored console output
- Debug level logging
- Human-readable format

### Production
- JSON structured logging
- Info level and above
- Optimized for log aggregation

## 📦 Releases & Versioning

This library is a real published npm package (`@tumbaland/backend-core`), versioned independently
of the monorepo with [standard-version](https://github.com/conventional-changelog/standard-version)
and [Conventional Commits](https://conventionalcommits.org/). See the root
[README's "Commits & Releases" section](../../README.md#commits--releases) for the full process
and the reasoning behind it — summary: commit with conventional messages, then from this directory
run `npm run release` (never hand-edit `version` and `npm publish` directly, or the package,
changelog, and tags drift out of sync with each other). Tags for this package are scoped as
`backend-core-vX.Y.Z` so they can't collide with `frontend-core`'s, `components`', or the
monorepo's own `app-vX.Y.Z` tags.

---

## Contributing

1. Make changes to source files in `src/`
2. Run `npm run build` to compile TypeScript
3. Test your changes
4. Submit a pull request