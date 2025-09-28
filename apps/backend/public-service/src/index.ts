import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import todoRoutes from './routes/todoRoutes';
import { loadTodos } from './services/todoService';
import { healthCheck } from './controllers/healthController';
import { logger, errorHandler, correlationMiddleware, requestLogger } from '@tumbaland/core';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(correlationMiddleware);
app.use(cors());
app.use(express.json());
app.use(requestLogger);

// Load todos into memory on app start
loadTodos();

// Routes
app.use('/api/todo', todoRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Public service started successfully', { port: PORT }));

export default app;
