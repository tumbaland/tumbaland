import { ActivityType } from './ActivityType';

describe('ActivityType validation', () => {
  it('rejects a slug with uppercase or invalid characters', () => {
    const doc = new ActivityType({ name: 'Reading', slug: 'Not Valid!', userId: 'u1' });
    const err = doc.validateSync();
    expect(err?.errors.slug?.message).toBe('Slug can only contain lowercase letters, numbers, and hyphens');
  });

  it('accepts a well-formed slug', () => {
    const doc = new ActivityType({ name: 'Reading', slug: 'reading-time', userId: 'u1' });
    expect(doc.validateSync()?.errors.slug).toBeUndefined();
  });

  it('rejects a color that is not a hex code', () => {
    const doc = new ActivityType({ name: 'Reading', slug: 'reading', userId: 'u1', color: 'blue' });
    const err = doc.validateSync();
    expect(err?.errors.color?.message).toBe('Color must be a valid hex code (e.g., #FF5733)');
  });

  it('accepts a valid hex color', () => {
    const doc = new ActivityType({ name: 'Reading', slug: 'reading', userId: 'u1', color: '#FF5733' });
    expect(doc.validateSync()?.errors.color).toBeUndefined();
  });
});

describe('ActivityType pre-save slug generation', () => {
  // The `pre('save')` hook that derives a slug from `name` when one is missing
  // is unreachable: `slug` is `required: true`, and Mongoose runs schema
  // validation *before* pre('save') hooks, so a document without a slug always
  // fails validation first — the hook never gets a chance to fill it in.
  it('fails validation for a missing slug before the derive-from-name hook can run', async () => {
    const doc = new ActivityType({ name: 'Movie Night!', userId: 'u1' });

    await expect(doc.save()).rejects.toMatchObject({ name: 'ValidationError' });
    expect(doc.slug).toBeUndefined();
  });
});

describe('ActivityType indexes', () => {
  const indexes = ActivityType.schema.indexes();
  const find = (key: Record<string, unknown>) =>
    indexes.find(([fields]) => JSON.stringify(fields) === JSON.stringify(key));

  it('has no global unique index on slug, so scopes cannot block each other', () => {
    expect(ActivityType.schema.path('slug').options.unique).toBeUndefined();
    const [, options] = find({ slug: 1 }) ?? [];
    expect(options?.unique).toBeUndefined();
  });

  it('makes a slug unique within one group', () => {
    const [, options] = find({ groupId: 1, slug: 1 }) ?? [];
    expect(options?.unique).toBe(true);
    expect(options?.partialFilterExpression).toEqual({ groupId: { $type: 'string' } });
  });

  it('makes a slug unique within one user\'s personal types', () => {
    const [, options] = find({ userId: 1, slug: 1 }) ?? [];
    expect(options?.unique).toBe(true);
    // Null-equality, not `$exists: false` — Mongo rejects the latter in a
    // partial index, and this form matches a missing groupId as well.
    expect(options?.partialFilterExpression).toEqual({ groupId: null });
  });
});
