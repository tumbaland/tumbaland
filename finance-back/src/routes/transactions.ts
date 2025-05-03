import express, { Request, Response } from 'express';

const router = express.Router();

// Sample transaction data - in a real app this would come from a database
const transactions = [
  { id: 1, description: 'Salary', amount: 3000, type: 'income', date: '2025-04-30' },
  { id: 2, description: 'Rent', amount: 1200, type: 'expense', date: '2025-05-01' },
  { id: 3, description: 'Groceries', amount: 200, type: 'expense', date: '2025-05-02' },
  { id: 4, description: 'Freelance work', amount: 500, type: 'income', date: '2025-05-02' }
];

// Define transaction interface
interface Transaction {
  id: number;
  description: string;
  amount: number;
  type: string;
  date: string;
}

// GET all transactions
router.get('/', (req: Request, res: Response) => {
  res.json(transactions);
});

// GET transaction by ID
router.get('/:id', (req: Request, res: Response) => {
  const transaction = transactions.find(t => t.id === parseInt(req.params.id));
  if (!transaction) {
    return res.status(404).json({ message: 'Transaction not found' });
  }
  res.json(transaction);
});

// POST new transaction
router.post('/', (req: Request, res: Response) => {
  const { description, amount, type, date } = req.body;
  
  if (!description || !amount || !type || !date) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  
  const newTransaction: Transaction = {
    id: transactions.length + 1,
    description,
    amount: parseFloat(amount),
    type,
    date
  };
  
  transactions.push(newTransaction);
  res.status(201).json(newTransaction);
});

// Other CRUD operations can be added here

export const transactionsRouter = router;