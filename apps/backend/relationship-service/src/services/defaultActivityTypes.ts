import { ActivityType, IActivityType } from '../models/ActivityType';

/**
 * The set a brand-new scope starts with.
 *
 * Without these, a new account is unusable from an assistant: entries are
 * recorded against a type, so "we went for dinner last night" answers with "no
 * activity types are defined yet" and the first conversation — the only one that
 * decides whether someone comes back — dead-ends on a setup task.
 *
 * Chosen to cover the common shapes rather than to be exhaustive: something you
 * describe (Dining), something you measure (Together), something that either
 * happened or did not (Exercise), and a catch-all so nothing has to be forced
 * into a type it does not belong in. Anyone can rename, delete, or add to them.
 */
export interface DefaultActivityType {
  name: string;
  slug: string;
  description: string;
  color: string;
  valueType: 'string' | 'boolean' | 'number';
  hasLocation: boolean;
}

export const DEFAULT_ACTIVITY_TYPES: DefaultActivityType[] = [
  {
    name: 'Together',
    slug: 'together',
    description: 'Time spent together',
    color: '#E91E63',
    valueType: 'number',
    hasLocation: false
  },
  {
    name: 'Dining',
    slug: 'dining',
    description: 'Meals out',
    color: '#FF9800',
    valueType: 'string',
    hasLocation: true
  },
  {
    name: 'Coffee',
    slug: 'coffee',
    description: 'Coffee and cafés',
    color: '#795548',
    valueType: 'string',
    hasLocation: true
  },
  {
    name: 'Movies',
    slug: 'movies',
    description: 'Films and shows watched',
    color: '#3F51B5',
    valueType: 'string',
    hasLocation: false
  },
  {
    name: 'Travel',
    slug: 'travel',
    description: 'Trips and places visited',
    color: '#009688',
    valueType: 'string',
    hasLocation: true
  },
  {
    name: 'Exercise',
    slug: 'exercise',
    description: 'Walks, sport, anything active',
    color: '#4CAF50',
    valueType: 'string',
    hasLocation: true
  },
  {
    name: 'Other',
    slug: 'other',
    description: 'Anything that does not fit elsewhere',
    color: '#9E9E9E',
    valueType: 'string',
    hasLocation: false
  }
];

/**
 * Give a scope its starting types, once.
 *
 * Idempotent by construction rather than by checking first: the unique partial
 * indexes on (userId, slug) and (groupId, slug) mean a duplicate insert is
 * rejected by the database, so two concurrent first-requests cannot both seed.
 * `ordered: false` lets the rest through when one collides, and the duplicate-key
 * error that comes back is the expected outcome, not a failure.
 *
 * Returns the types that were actually created, which is empty on every call
 * after the first.
 */
export const seedDefaultActivityTypes = async (
  userId: string,
  groupId?: string | null
): Promise<IActivityType[]> => {
  const documents = DEFAULT_ACTIVITY_TYPES.map((type, index) => ({
    ...type,
    userId,
    groupId: groupId ?? undefined,
    isActive: true,
    sortOrder: index
  }));

  try {
    return await ActivityType.insertMany(documents, { ordered: false });
  } catch (error) {
    // A duplicate key means someone else seeded this scope first — the desired
    // end state either way. Anything else is a real failure worth surfacing.
    const code = (error as { code?: number }).code;
    if (code === 11000) return [];
    throw error;
  }
};
