export interface GroupMember {
  email: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: string;
}

export interface Group {
  _id?: string;
  name: string;
  createdBy?: string;
  members?: GroupMember[];
  invites?: any[];
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
