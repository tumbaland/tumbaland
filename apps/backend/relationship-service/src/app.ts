import express from 'express';
import path from 'path';
import activityRoutes from './routes/activities';
import activityTypeRoutes from './routes/activityTypes';
import statisticsRoutes from './routes/statistics';
import { healthCheck } from './controllers/healthController';
import { errorHandler, createBaseApp, metricsHandler } from '@tumbaland/core';

const app = createBaseApp();

// Routes
app.use('/api/activities', activityRoutes);
app.use('/api/activity-types', activityTypeRoutes);
app.use('/api/statistics', statisticsRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus
app.get('/metrics', metricsHandler);

// Error handler
app.use(errorHandler);

export default app;
