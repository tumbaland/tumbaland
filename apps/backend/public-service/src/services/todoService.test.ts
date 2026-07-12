import fs from 'fs';
import { loadTodos, getRandomTodo } from './todoService';

describe('loadTodos / getRandomTodo', () => {
  it('returns null when no todos have been loaded', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    loadTodos();

    expect(getRandomTodo()).toBeNull();
  });

  it('loads todos from the JSON file and returns a random entry', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(['Buy milk', 'Walk dog']));
    loadTodos();

    const todo = getRandomTodo();
    expect(['Buy milk', 'Walk dog']).toContain(todo);
  });

  it('resets to empty when loading fails after a previous successful load', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify(['Buy milk']));
    loadTodos();
    expect(getRandomTodo()).toBe('Buy milk');

    jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
      throw new Error('ENOENT');
    });
    loadTodos();

    expect(getRandomTodo()).toBeNull();
  });
});
