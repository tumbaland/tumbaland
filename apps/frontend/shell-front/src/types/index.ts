// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  /** What the session token says the account may do; `admin` is the only one the shell reads. */
  roles?: string[];
}

export interface AuthResponse {
  authenticated: boolean;
  user: User | null;
}
