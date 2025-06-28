import { Router } from 'express';
import { getRandomTodoHandler } from '../controllers/todoController';

const router = Router();

router.get('/random', getRandomTodoHandler);

export default router;
