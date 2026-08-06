import express from 'express';
import path from 'path';
import assetClassesRoutes from './routes/assetClasses';
import snapshotsRoutes from './routes/snapshots';
import tickerPriceHistoryRoutes from './routes/tickerPriceHistory';
import trackedTickersRoutes from './routes/trackedTicker';
import holdingsRoutes from './routes/holdings';
import tradesRoutes from './routes/trades';
import transactionsRoutes from './routes/transactions';
import dashboardRoutes from './routes/dashboard';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler } from '@tumbaland/backend-core';

// The CSV export names its file in Content-Disposition, and a cross-origin
// response hides every header the server does not expose — without this the
// browser silently saves every export as "transactions.csv" regardless of
// which filter produced it.
const app = createBaseApp({ corsOptions: { exposedHeaders: ['Content-Disposition'] } });

// Routes
app.use('/api/asset-classes', assetClassesRoutes);
app.use('/api/snapshots', snapshotsRoutes);
app.use('/api/ticker-price-history', tickerPriceHistoryRoutes);
app.use('/api/tracked-tickers', trackedTickersRoutes);
app.use('/api/holdings', holdingsRoutes);
app.use('/api/trades', tradesRoutes);
app.use('/api/transactions', transactionsRoutes);
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
