import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { authenticateToken } from './middleware/authMiddleware';
import groupRoutes from './routes/groupRoutes';
import { healthCheck } from './controllers/healthController';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

const MONGODB_URI = process.env.MONGODB_URI || '';
mongoose.connect(MONGODB_URI).then(() => console.log('[group-service] Mongo connected')).catch(err => console.error('Mongo error', err));

// Health check endpoint
app.get('/health', healthCheck);

app.use('/api', authenticateToken);
app.use('/api/groups', groupRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => console.log(`[group-service] listening on ${PORT}`));
