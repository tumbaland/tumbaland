import fs from 'fs';
import os from 'os';
import path from 'path';
import express from 'express';
import { listRoutes, openApiDrift, recordMountPaths } from './openapi';

recordMountPaths();

const buildApp = () => {
  const app = express();
  app.get('/health', (_req, res) => void res.send('ok'));
  app.get('/metrics', (_req, res) => void res.send(''));
  const things = express.Router();
  things.get('/', (_req, res) => void res.send());
  things.put('/:thingId', (_req, res) => void res.send());
  const nested = express.Router();
  nested.delete('/:id', (_req, res) => void res.send());
  things.use('/:thingId/parts', nested);
  app.use('/api/things', things);
  const files = express.Router();
  files.get('/download/*fileId', (_req, res) => void res.send());
  app.use('/files', files);
  return app;
};

const writeSpec = (yaml: string) => {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'spec-')), 'openapi.yml');
  fs.writeFileSync(file, yaml);
  return file;
};

it('lists routes with the paths their routers were mounted at, in OpenAPI form', () => {
  expect(listRoutes(buildApp())).toEqual([
    { method: 'get', path: '/health' },
    { method: 'get', path: '/metrics' },
    { method: 'get', path: '/api/things' },
    { method: 'put', path: '/api/things/{thingId}' },
    { method: 'delete', path: '/api/things/{thingId}/parts/{id}' },
    { method: 'get', path: '/files/download/{fileId}' }
  ]);
});

it('reports routes missing from the spec and operations the app does not have, leaving out platform routes', () => {
  const spec = writeSpec(`
paths:
  /health:
    get: {}
  /api/things:
    get: {}
    post: {}
  /api/things/{id}:
    put: {}
    parameters: []
`);
  expect(openApiDrift(buildApp(), spec)).toEqual({
    undocumented: ['DELETE /api/things/{thingId}/parts/{id}', 'GET /files/download/{fileId}'],
    stale: ['POST /api/things']
  });
});

it('matches parameters whatever they are called, and skips what it is told to', () => {
  const spec = writeSpec(`
paths:
  /api/things:
    get: {}
  /api/things/{id}:
    put: {}
  /api/things/{a}/parts/{b}:
    delete: {}
`);
  expect(openApiDrift(buildApp(), spec, ['GET /health', /^GET \/files\//])).toEqual({ undocumented: [], stale: [] });
});

it('follows a path item kept in a file of its own', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spec-'));
  fs.mkdirSync(path.join(dir, 'paths'));
  fs.writeFileSync(path.join(dir, 'paths', 'things.yml'), 'get: {}\n');
  fs.writeFileSync(path.join(dir, 'openapi.yml'), "paths:\n  /api/things:\n    $ref: 'paths/things.yml'\n");
  expect(openApiDrift(buildApp(), path.join(dir, 'openapi.yml'), [/./]).stale).toEqual([]);
  const app = express();
  app.get('/api/things', (_req, res) => void res.send());
  expect(openApiDrift(app, path.join(dir, 'openapi.yml'))).toEqual({ undocumented: [], stale: [] });
});
