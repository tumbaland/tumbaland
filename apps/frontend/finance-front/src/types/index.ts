export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user: User | null;
}

// Asset Class types
export type AssetClassKind = 'asset' | 'liability';

/**
 * How reachable the money in a class is: `cash` is spendable now, `market` can
 * be sold within days, `locked` takes years or a penalty (pensions, property).
 */
export type AssetClassLiquidity = 'cash' | 'market' | 'locked';

export interface AssetClass {
  _id: string;
  name: string;
  description?: string;
  color?: string;
  /**
   * Liability classes subtract from net worth; values stay positive.
   * Optional because classes created before this field existed have no value
   * stored — treat a missing kind as 'asset'.
   */
  kind?: AssetClassKind;
  /** Unset on classes not yet sorted; the dashboard shows those as unsorted. */
  liquidity?: AssetClassLiquidity;
  userId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}

// Monthly net-worth snapshot: one document per month with the value of every
// asset class on the first of that month
export interface SnapshotEntry {
  assetClassId: string;
  value: number;
  gain: number;
}

export interface Snapshot {
  _id: string;
  date: string; // first of month, UTC
  entries: SnapshotEntry[];
  userId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}
