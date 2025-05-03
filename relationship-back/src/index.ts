import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { contactsRouter } from './routes/contacts';

const app = express();
const PORT = process.env.PORT || 4002; // Using port 4002 to avoid conflict with finance-back

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Routes
app.use('/api/contacts', contactsRouter);

// Basic health check route
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'relationship-back' }); // Fixed service name
});

// Start the server
app.listen(PORT, () => {
  console.log(`Relationship backend server is running on port ${PORT}`);
});

export default app;