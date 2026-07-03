import { Request, Response } from 'express';
import { getRandomTodo } from '../services/todoService';

export function getRandomTodoHandler(req: Request, res: Response) {
  const todo = getRandomTodo();
  if (!todo) {
    throw new Error('No todos available');
  }
  res.json({ todo });
}
