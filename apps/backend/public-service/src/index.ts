import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import todoRoutes from './routes/todoRoutes';
import { loadTodos } from './services/todoService';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Load todos into memory on app start
loadTodos();

// Routes
app.use('/api/todo', todoRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'album-service',
    timestamp: new Date().toISOString(),
    mongodb: 'connected'
  });
});

// Error handler
app.use((error: Error, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Album backend server is running on port ${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
});

export default app;
