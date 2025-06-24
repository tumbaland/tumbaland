import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/database';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/albums', albumRoutes);
app.use('/api/photos', photoRoutes);

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'album-service',
    timestamp: new Date().toISOString(),
    mongodb: 'connected'
  });
});

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.method} ${req.originalUrl} does not exist.`,
    availableRoutes: ['/api/docs']
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