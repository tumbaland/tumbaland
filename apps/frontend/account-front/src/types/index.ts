export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    albums?: T[];
    photos?: T[];
    pagination: PaginationInfo;
  };
}

// Auth types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  name: string;
  picture?: string;
  username?: string;
  lastLoginAt?: string;
  /**
   * When the owner asked for the account to be removed, if they have.
   *
   * A request, not a removal: the account keeps working exactly as before while
   * this stands, and an administrator does the deleting by hand. Null means no
   * request, which is also what it becomes when the owner withdraws one.
   */
  deletionRequestedAt?: string | null;
}

export interface AuthResponse {
  authenticated: boolean;
  user: User | null;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  user: User;
  message?: string;
}

export interface DeletionRequestResponse {
  success: boolean;
  deletionRequestedAt: string | null;
  message?: string;
}
