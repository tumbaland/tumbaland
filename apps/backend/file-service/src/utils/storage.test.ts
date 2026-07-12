import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resolvePath,
  writeFile,
  readFile,
  fileExists,
  getMetadata,
  deleteFile,
  deleteByPrefix,
  listFiles
} from './storage';

let tmpDir: string;
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'file-service-test-'));
  process.env = { ...ORIGINAL_ENV, FILE_SERVICE_DATA_DIR: tmpDir };
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  process.env = ORIGINAL_ENV;
});

describe('resolvePath', () => {
  it('joins the fileId onto the data dir', () => {
    expect(resolvePath('a/b/c.jpg')).toBe(path.join(tmpDir, 'a/b/c.jpg'));
  });

  it('strips leading ../ path traversal segments', () => {
    const resolved = resolvePath('../../etc/passwd');
    expect(resolved.startsWith(tmpDir)).toBe(true);
    expect(resolved).not.toContain('..');
  });
});

describe('writeFile / readFile', () => {
  it('creates nested directories and writes+reads the same buffer back', () => {
    const buffer = Buffer.from('hello world');
    writeFile('a/b/c/file.txt', buffer);

    expect(readFile('a/b/c/file.txt')).toEqual(buffer);
  });
});

describe('fileExists', () => {
  it('returns true for a file that was written', () => {
    writeFile('exists.txt', Buffer.from('x'));
    expect(fileExists('exists.txt')).toBe(true);
  });

  it('returns false for a file that does not exist', () => {
    expect(fileExists('missing.txt')).toBe(false);
  });
});

describe('getMetadata', () => {
  it('returns size and lastModified matching the real file', () => {
    writeFile('meta.txt', Buffer.from('12345'));
    const meta = getMetadata('meta.txt');

    expect(meta.size).toBe(5);
    expect(typeof meta.lastModified.getTime).toBe('function');
    expect(meta.lastModified.getTime()).toBeGreaterThan(0);
  });
});

describe('deleteFile', () => {
  it('removes an existing file', () => {
    writeFile('to-delete.txt', Buffer.from('x'));
    deleteFile('to-delete.txt');
    expect(fileExists('to-delete.txt')).toBe(false);
  });

  it('does not throw when the file does not exist', () => {
    expect(() => deleteFile('never-existed.txt')).not.toThrow();
  });
});

describe('deleteByPrefix', () => {
  it('deletes an entire directory subtree when the prefix matches a directory', () => {
    writeFile('albums/album-1/photo1.jpg', Buffer.from('a'));
    writeFile('albums/album-1/photo2.jpg', Buffer.from('b'));
    writeFile('albums/album-2/photo3.jpg', Buffer.from('c'));

    const count = deleteByPrefix('albums/album-1');

    expect(count).toBe(2);
    expect(fileExists('albums/album-1/photo1.jpg')).toBe(false);
    expect(fileExists('albums/album-2/photo3.jpg')).toBe(true);
  });

  it('deletes files matching a filename prefix within a directory (not a directory match)', () => {
    writeFile('thumbs/photo-1-thumb.jpg', Buffer.from('a'));
    writeFile('thumbs/photo-1-full.jpg', Buffer.from('b'));
    writeFile('thumbs/photo-2-thumb.jpg', Buffer.from('c'));

    const count = deleteByPrefix('thumbs/photo-1');

    expect(count).toBe(2);
    expect(fileExists('thumbs/photo-2-thumb.jpg')).toBe(true);
  });

  it('returns 0 when nothing matches the prefix', () => {
    expect(deleteByPrefix('nothing-here')).toBe(0);
  });

  it('recurses into nested subdirectories when deleting a directory prefix', () => {
    writeFile('albums/album-1/photo.jpg', Buffer.from('a'));
    writeFile('albums/album-1/thumbs/photo-thumb.jpg', Buffer.from('b'));
    writeFile('albums/album-1/thumbs/nested/deep.jpg', Buffer.from('c'));

    const count = deleteByPrefix('albums/album-1');

    expect(count).toBe(3);
    expect(fileExists('albums/album-1/thumbs/nested/deep.jpg')).toBe(false);
  });
});

describe('listFiles', () => {
  it('lists all files recursively under the data dir when no prefix is given', () => {
    writeFile('a/one.txt', Buffer.from('1'));
    writeFile('b/two.txt', Buffer.from('22'));

    const files = listFiles();

    expect(files).toHaveLength(2);
    expect(files.map((f) => f.name).sort()).toEqual([path.join('a', 'one.txt'), path.join('b', 'two.txt')].sort());
  });

  it('lists only files under the given prefix', () => {
    writeFile('albums/album-1/photo.jpg', Buffer.from('1'));
    writeFile('albums/album-2/photo.jpg', Buffer.from('2'));

    const files = listFiles('albums/album-1');

    expect(files).toHaveLength(1);
  });

  it('respects maxKeys and stops early', () => {
    writeFile('a.txt', Buffer.from('1'));
    writeFile('b.txt', Buffer.from('2'));
    writeFile('c.txt', Buffer.from('3'));

    const files = listFiles(undefined, 2);

    expect(files).toHaveLength(2);
  });

  it('returns an empty array when the directory does not exist', () => {
    expect(listFiles('does-not-exist')).toEqual([]);
  });
});
