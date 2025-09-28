import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import todoRoutes from './routes/todoRoutes';
import { loadTodos } from './services/todoService';
import { healthCheck } from './controllers/healthController';
import { submitLogs, getLogsHealth } from './controllers/logController';
import { logger, errorHandler, correlationMiddleware, requestLogger } from '@tumbaland/core';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5003;

// Middleware
app.use(correlationMiddleware);
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-correlation-id', 'x-session-id']
}));
app.use(express.json());
app.use(requestLogger);

// Load todos into memory on app start
loadTodos();

// Routes
app.use('/api/todo', todoRoutes);

// Logging routes
app.post('/logs', submitLogs);
app.get('/logs/health', getLogsHealth);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

// Error handler
app.use(errorHandler);

// Start the server
app.listen(PORT, () => logger.info('Public service started successfully', { port: PORT }));

export default app;
