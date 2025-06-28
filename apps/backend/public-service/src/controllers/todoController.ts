import { Request, Response } from 'express';
import { getRandomTodo } from '../services/todoService';

export function getRandomTodoHandler(req: Request, res: Response) {
  const todo = getRandomTodo();
  if (!todo) {
    res.status(500).json({ error: 'No todos available' });
    return;
  }
  res.json({ todo });
}
