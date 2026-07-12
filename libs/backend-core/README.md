# @tumbaland/core

Core shared functionality for Tumbaland backend services.

## Installation

```bash
npm install @tumbaland/core
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
} from '@tumbaland/core';

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
import { authenticateToken } from '@tumbaland/core';

app.get('/protected', authenticateToken, (req, res) => {
  const user = (req as any).user;
  res.json({ message: `Hello ${user.name}!` });
});
```

### Structured Logging

```typescript
import { logger } from '@tumbaland/core';

// Different log levels
logger.error('Database connection failed', { error: err.message });
logger.warn('High memory usage detected', { usage: '85%' });
logger.info('User logged in', { userId: '123', ip: '192.168.1.1' });
logger.debug('Processing request', { correlationId: req.correlationId });
```

### API Responses

```typescript
import { sendSuccess, sendError } from '@tumbaland/core';

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

This library uses [standard-version](https://github.com/conventional-changelog/standard-version) for automated versioning and follows [Conventional Commits](https://conventionalcommits.org/) specification.

### Release Types

- **PATCH** (`1.0.0` → `1.0.1`): Bug fixes
- **MINOR** (`1.0.0` → `1.1.0`): New features (backward compatible)
- **MAJOR** (`1.0.0` → `2.0.0`): Breaking changes

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(auth): add JWT token refresh
fix(logging): resolve memory leak in Winston transport
docs(api): update health check endpoint documentation
```

### Release Process

1. **Make changes** with conventional commit messages
2. **Run release script**: `./release.sh`
3. **Push changes**: `git push origin main`
4. **Publish**: Automated via GitHub Actions

### Changelog

Changelogs are maintained at the project level in the root `CHANGELOG.md` file. Individual library changelogs are not generated to maintain consistency across the monorepo.

### Beta Releases

For beta releases: `npm run release:beta`

---

## Contributing

1. Make changes to source files in `src/`
2. Run `npm run build` to compile TypeScript
3. Test your changes
4. Submit a pull request