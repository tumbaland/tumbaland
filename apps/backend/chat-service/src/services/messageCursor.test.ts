import { Types } from 'mongoose';
import { BadRequestError } from '@tumbaland/backend-core';
import { cursorOf, parseCursor } from './messageCursor';

const id = new Types.ObjectId();
const createdAt = new Date('2026-10-28T10:00:00.000Z');

describe('cursorOf', () => {
  it('joins the time and the id', () => {
    expect(cursorOf({ createdAt, _id: id })).toBe(`2026-10-28T10:00:00.000Z_${id.toString()}`);
  });
});

describe('parseCursor', () => {
  it('reads back what cursorOf wrote', () => {
    const { at, id: parsed } = parseCursor(cursorOf({ createdAt, _id: id }), 'before');
    expect(at).toEqual(createdAt);
    expect(parsed?.equals(id)).toBe(true);
  });

  it('still accepts a bare timestamp, as older clients and the stream replay send', () => {
    expect(parseCursor('2026-10-28T10:00:00.000Z', 'before')).toEqual({ at: createdAt, id: null });
  });

  it('refuses a cursor that is not a date', () => {
    expect(() => parseCursor('yesterday', 'before')).toThrow(BadRequestError);
    expect(() => parseCursor('yesterday', 'before')).toThrow('before is not a date');
  });

  it('refuses a cursor whose id is not an ObjectId', () => {
    expect(() => parseCursor('2026-10-28T10:00:00.000Z_nope', 'after')).toThrow('after is not a cursor');
  });
});
