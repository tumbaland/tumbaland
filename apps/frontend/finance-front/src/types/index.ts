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

// Asset Allocation types
export interface AssetAllocation {
  _id: string;
  assetClassId: string | AssetClass;
  totalValue: number;
  gain: number;
  date: string;
  userId: string;
  groupId?: string;
  createdAt: string;
  updatedAt: string;
}
