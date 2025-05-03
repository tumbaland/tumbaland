import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { transactionsRouter } from './routes/transactions';

const app = express();
const PORT = process.env.PORT || 4001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/transactions', transactionsRouter);

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'finance-back' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Finance backend server is running on port ${PORT}`);
});

export default app;