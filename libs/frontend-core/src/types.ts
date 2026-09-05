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
  /**
   * When the owner asked for the account to be removed, if they have.
   *
   * Served by `/auth/profile`, which is what this type describes. A request and
   * not a removal: the account signs in and works exactly as before while it
   * stands, and an administrator does the deleting by hand. Null once the owner
   * withdraws it.
   */
  deletionRequestedAt?: string | null;
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
