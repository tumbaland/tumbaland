import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/database';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';
import collageRoutes from './collage/collageRoutes';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLogger } from '@tumbaland/core';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(correlationMiddleware);
app.use(requestLogger);
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/albums', albumRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/collages', collageRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Album service started successfully', { port: PORT }));

export default app;
