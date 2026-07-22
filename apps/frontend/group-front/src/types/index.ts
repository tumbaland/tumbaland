export interface GroupMember {
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: string;
  lastActivity?: string;
}

export interface GroupInvite {
  email: string;
  role: 'owner' | 'admin' | 'member';
  token: string;
  expiresAt: string;
  createdAt: string;
}

export interface Group {
  _id?: string;
  name: string;
  createdBy?: string;
  members?: GroupMember[];
  invites?: GroupInvite[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  email: string;
  name: string;
  picture?: string;
  roles?: string[];
  isApproved?: boolean;
}

export interface AuthResponse { authenticated: boolean; user: User | null; }
