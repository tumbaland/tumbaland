import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'path';
import assetClassesRoutes from './routes/assetClasses';
import assetAllocationsRoutes from './routes/assetAllocations';
import portfolioHistoryRoutes from './routes/tickerPriceHistory';
import trackedSymbolsRoutes from './routes/trackedTicker';
import userPortfolioRoutes from './routes/userPortfolio';
import dashboardRoutes from './routes/dashboard';
import { healthCheck } from './controllers/healthController';
import { errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, createCorsMiddleware, securityHeaders, standardRateLimiter } from '@tumbaland/core';

const app = express();

// Middleware
app.use(securityHeaders);
app.use(standardRateLimiter);
app.use(correlationMiddleware);
app.use(tracingMiddleware);
app.use(requestLoggerWithMetrics);
app.use(express.json()); // Parse JSON request bodies
app.use(cookieParser());
app.use(createCorsMiddleware());

// Routes
app.use('/api/asset-classes', assetClassesRoutes);
app.use('/api/asset-allocations', assetAllocationsRoutes);
app.use('/api/ticker-price-history', portfolioHistoryRoutes);
app.use('/api/tracked-tickers', trackedSymbolsRoutes);
app.use('/api/user-portfolio', userPortfolioRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

export default app;
