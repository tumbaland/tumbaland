import path from 'path';
import fs from 'fs';

const todosPath = path.join(__dirname, '../data/todos.json');
let todos: string[] = [];

export function loadTodos() {
  try {
    const data = fs.readFileSync(todosPath, 'utf-8');
    todos = JSON.parse(data);
  } catch (err) {
    console.error('Failed to load todos.json:', err);
    todos = [];
  }
}

export function getRandomTodo(): string | null {
  if (!todos.length) return null;
  const idx = Math.floor(Math.random() * todos.length);
  return todos[idx];
}
