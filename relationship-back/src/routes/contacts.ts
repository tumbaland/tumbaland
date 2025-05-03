import express, { Request, Response } from 'express';

const router = express.Router();

// Define contact interface
interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  relation: string;
}

// Sample contacts data - in a real app this would come from a database
const contacts: Contact[] = [
  { id: 1, name: 'John Doy', email: 'john.doe@example.com', phone: '555-123-4567', relation: 'friend' },
  { id: 2, name: 'Jane Smith', email: 'jane.smith@example.com', phone: '555-765-4321', relation: 'family' },
  { id: 3, name: 'Bob Johnson', email: 'bob.johnson@example.com', phone: '555-987-6543', relation: 'colleague' },
  { id: 4, name: 'Alice Williams', email: 'alice.williams@example.com', phone: '555-456-7890', relation: 'friend' }
];

// GET all contacts
router.get('/', (req: Request, res: Response) => {
  res.json(contacts);
});

// GET contact by ID
router.get('/:id', (req: Request, res: Response) => {
  const contact = contacts.find(c => c.id === parseInt(req.params.id));
  if (!contact) {
    return res.status(404).json({ message: 'Contact not found' });
  }
  res.json(contact);
});

// POST new contact
router.post('/', (req: Request, res: Response) => {
  const { name, email, phone, relation } = req.body;
  
  if (!name || !email || !relation) {
    return res.status(400).json({ message: 'Name, email, and relation are required' });
  }
  
  const newContact: Contact = {
    id: contacts.length + 1,
    name,
    email,
    phone: phone || '',
    relation
  };
  
  contacts.push(newContact);
  res.status(201).json(newContact);
});

// Other CRUD operations can be added here

export const contactsRouter = router;