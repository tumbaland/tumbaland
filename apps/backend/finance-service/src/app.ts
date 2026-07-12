import express from 'express';
import path from 'path';
import assetClassesRoutes from './routes/assetClasses';
import snapshotsRoutes from './routes/snapshots';
import tickerPriceHistoryRoutes from './routes/tickerPriceHistory';
import trackedTickersRoutes from './routes/trackedTicker';
import holdingsRoutes from './routes/holdings';
import dashboardRoutes from './routes/dashboard';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler } from '@tumbaland/core';

const app = createBaseApp();

// Routes
app.use('/api/asset-classes', assetClassesRoutes);
app.use('/api/snapshots', snapshotsRoutes);
app.use('/api/ticker-price-history', tickerPriceHistoryRoutes);
app.use('/api/tracked-tickers', trackedTickersRoutes);
app.use('/api/holdings', holdingsRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint (DB-aware readiness; /health/live is mounted by createBaseApp)
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

export default app;
