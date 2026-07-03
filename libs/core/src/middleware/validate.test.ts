import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from './validate';
import { errorHandler } from './errorHandler';

function buildApp(schema: z.ZodType) {
  const app = express();
  app.use(express.json());
  app.post('/things', validate(schema), (req, res) => {
    res.json({ success: true, data: req.body });
  });
  app.use(errorHandler);
  return app;
}

describe('validate', () => {
  const schema = z.object({
    name: z.string().min(1),
    age: z.number().int().positive().optional()
  });

  it('calls the handler with the parsed body when validation passes', async () => {
    const app = buildApp(schema);

    const res = await request(app).post('/things').send({ name: 'Alice', age: 30 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { name: 'Alice', age: 30 } });
  });

  it('responds 400 via the shared errorHandler when a required field is missing', async () => {
    const app = buildApp(schema);

    const res = await request(app).post('/things').send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('BadRequestError');
    expect(res.body.message).toContain('name');
  });

  it('responds 400 when a field has the wrong type', async () => {
    const app = buildApp(schema);

    const res = await request(app).post('/things').send({ name: 'Bob', age: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('BadRequestError');
  });

  it('strips unknown fields not declared in the schema (zod default behavior)', async () => {
    const app = buildApp(schema);

    const res = await request(app).post('/things').send({ name: 'Carol', extra: 'nope' });

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ name: 'Carol' });
  });
});
