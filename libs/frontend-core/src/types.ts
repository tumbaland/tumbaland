export interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
  picture?: string;
  roles?: string[];
  isApproved?: boolean;
  lastLoginAt?: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user: User | null;
}

export interface Group {
  _id: string;
  name: string;
  description?: string;
  memberCount?: number;
  isOwner?: boolean;
  createdAt?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}
