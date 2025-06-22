import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';
import assetRoutes from './routes/assets';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001; // Using port 4001 for finance-back

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve static documentation files
app.use('/docs', express.static(path.join(__dirname, '../docs')));

// API Documentation route
app.get('/api-docs', (req: Request, res: Response) => {
  res.redirect('/docs/index.html');
});

// Routes
app.use('/api', assetRoutes);

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    service: 'finance-back',
    timestamp: new Date().toISOString(),
    mongodb: 'connected'
  });
});

// 404 handler
app.use('{*any}', (req: Request, res: Response) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The route ${req.method} ${req.originalUrl} does not exist.`,
    availableRoutes: ['/health', '/api-docs', '/docs', '/api/assets']
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
  console.log(`🚀 Finance backend server is running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/api-docs`);
  console.log(`💰 Asset tracking: http://localhost:${PORT}/api/assets`);
});

export default app;