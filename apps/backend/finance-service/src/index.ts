import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';
import financeRecordsRoutes from './routes/financeRecords';
import portfolioHistoryRoutes from './routes/tickerPriceHistory';
import trackedSymbolsRoutes from './routes/trackedTicker';
import userPortfolioRoutes from './routes/userPortfolio';
import { startDailyPortfolioUpdate } from './services/portfolioScheduler.service';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLogger } from '@tumbaland/core';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4003;

// Connect to MongoDB
connectDB();

// Start daily portfolio update job
startDailyPortfolioUpdate();

// Middleware
app.use(correlationMiddleware);
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api/finance-records', financeRecordsRoutes);
app.use('/api/ticker-price-history', portfolioHistoryRoutes);
app.use('/api/tracked-tickers', trackedSymbolsRoutes);
app.use('/api/user-portfolio', userPortfolioRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Finance service started successfully', { port: PORT }));

export default app;
