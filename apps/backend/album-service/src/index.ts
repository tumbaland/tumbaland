import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import connectDB from './config/database';
import albumRoutes from './routes/albumRoutes';
import photoRoutes from './routes/photoRoutes';
import collageRoutes from './collage/collageRoutes';
import { healthCheck } from './controllers/healthController';

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
app.use('/api/collages', collageRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

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
