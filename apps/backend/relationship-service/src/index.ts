import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './config/database';
import activityRoutes from './routes/activities';
import activityTypeRoutes from './routes/activityTypes';
import statisticsRoutes from './routes/statistics';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/activities', activityRoutes);
app.use('/api/activity-types', activityTypeRoutes);
app.use('/api/statistics', statisticsRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'relationship-back',
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
  console.log(`🚀 Relationship backend server is running on port ${PORT}`);
  console.log(`📚 API docs: http://localhost:${PORT}/api/docs`);
});

export default app;
