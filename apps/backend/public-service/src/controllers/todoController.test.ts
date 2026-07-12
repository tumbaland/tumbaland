import { Request, Response } from 'express';

jest.mock('../services/todoService', () => ({ getRandomTodo: jest.fn() }));

import { getRandomTodo } from '../services/todoService';
import { getRandomTodoHandler } from './todoController';

const mockedGetRandomTodo = getRandomTodo as jest.Mock;

function mockRes(): Response {
  const res: Partial<Response> = {};
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

beforeEach(() => jest.clearAllMocks());

describe('getRandomTodoHandler', () => {
  it('returns a random todo', () => {
    mockedGetRandomTodo.mockReturnValue('Buy milk');
    const res = mockRes();

    getRandomTodoHandler({} as Request, res);

    expect(res.json).toHaveBeenCalledWith({ todo: 'Buy milk' });
  });

  it('throws when there are no todos available', () => {
    mockedGetRandomTodo.mockReturnValue(null);
    const res = mockRes();

    expect(() => getRandomTodoHandler({} as Request, res)).toThrow('No todos available');
  });
});
