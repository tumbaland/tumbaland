import express from 'express';
import path from 'path';
import todoRoutes from './routes/todoRoutes';
import { loadTodos } from './services/todoService';
import { healthCheck } from './controllers/healthController';
import { submitLogs, getLogsHealth } from './controllers/logController';
import { errorHandler, correlationMiddleware, requestLogger, createCorsMiddleware } from '@tumbaland/core';

const app = express();

// Middleware
app.use(correlationMiddleware);
app.use(createCorsMiddleware());
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

export default app;
