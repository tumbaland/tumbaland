import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { connectDB } from './config/database';
import assetClassesRoutes from './routes/assetClasses';
import assetAllocationsRoutes from './routes/assetAllocations';
import portfolioHistoryRoutes from './routes/tickerPriceHistory';
import trackedSymbolsRoutes from './routes/trackedTicker';
import userPortfolioRoutes from './routes/userPortfolio';
import dashboardRoutes from './routes/dashboard';
import { startDailyPortfolioUpdate } from './services/portfolioScheduler.service';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLoggerWithMetrics, metricsHandler, tracingMiddleware, requireEnv, createCorsMiddleware } from '@tumbaland/core';

// Load environment variables
dotenv.config();

// Fail fast if the JWT secret is missing — auth must never run with a default
requireEnv('JWT_SECRET');

const app = express();
const PORT = process.env.PORT || 4003;

// Connect to MongoDB
connectDB();

// Start daily portfolio update job
startDailyPortfolioUpdate();

// Middleware
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

// Start the server
app.listen(PORT, () => logger.info('Finance service started successfully', { port: PORT }));

export default app;
