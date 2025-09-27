import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { connectDB } from './config/database';
import planRoutes from './routes/planRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';
import paymentRoutes from './routes/paymentRoutes';
import { stripeWebhook } from './controllers/stripeController';
import path from 'path';
import { healthCheck } from './controllers/healthController';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

connectDB();

// Configure CORS with explicit origin whitelist (comma separated FRONTEND_ORIGIN)
const allowedOrigins = (process.env.PAYMENT_URL || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    console.warn('Blocked CORS origin:', origin);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
// JSON parser applied after defining webhook route (so webhook keeps raw Buffer)
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser());

app.use('/api/plans', planRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);

// Serve OpenAPI docs as static files
app.use('/api/docs', express.static(path.join(__dirname, '../docs')));

// Health check endpoint
app.get('/health', healthCheck);

app.use((err: Error, _req: Request, res: Response, _next: any) => {
  console.error('Unhandled error', err);
  res.status(500).json({ success: false, message: 'internal error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Payment service running on port ${PORT}`);
});

export default app;
