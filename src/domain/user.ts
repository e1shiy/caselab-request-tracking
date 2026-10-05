export const USER_ROLES = ['viewer', 'technician', 'admin'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  technicianId: string | null;
}

export interface StoredUser extends AuthUser {
  passwordHash: string;
  tokenVersion: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}