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
export interface AssetClass {
  _id: string;
  name: string;
  description?: string;
  color?: string;
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
