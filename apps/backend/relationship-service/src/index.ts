import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';
import activityRoutes from './routes/activities';
import activityTypeRoutes from './routes/activityTypes';
import statisticsRoutes from './routes/statistics';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLogger } from '@tumbaland/core';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(correlationMiddleware);
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Routes
app.use('/api/activities', activityRoutes);
app.use('/api/activity-types', activityTypeRoutes);
app.use('/api/statistics', statisticsRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Relationship service started successfully', { port: PORT }));

export default app;
