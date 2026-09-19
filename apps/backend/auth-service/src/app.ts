import express, { Request, Response } from 'express';
import path from 'path';
import authRoutes from './routes/authRoutes';
import oauthRoutes, { authorizationServerMetadata } from './routes/oauthRoutes';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler } from '@tumbaland/backend-core';

const app = createBaseApp({
  corsOptions: {
    exposedHeaders: ['Content-Type', 'Content-Length', 'ETag', 'Cache-Control'],
    // The OAuth endpoints are navigated to by the browser, not fetched by
    // script: a top-level GET for the consent page and a form POST back. CORS
    // cannot help there and does actively break it — Firefox sends
    // `Origin: null` after the login redirect, which failed the whitelist and
    // turned an approved consent into a 500.
    // Google's redirect-mode sign-in is the same kind of request: a form
    // POST from accounts.google.com.
    bypassPaths: ['/oauth', '/auth/google/callback']
  }
});

// Serve static documentation files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Routes
app.use('/auth', authRoutes);

// OAuth 2.1 authorization server. The metadata sits at the issuer's root
// because that is where RFC 8414 says a client will look for it — it cannot be
// nested under /auth.
app.get('/.well-known/oauth-authorization-server', authorizationServerMetadata);
app.use('/oauth', oauthRoutes);

// Documentation root redirect
app.get('/docs', (req: Request, res: Response) => {
  res.redirect('/api/docs/index.html');
});

// Health check endpoint (DB-aware readiness; /health/live is mounted by createBaseApp)
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

export default app;
