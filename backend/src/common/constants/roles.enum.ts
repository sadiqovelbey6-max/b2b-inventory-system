export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  BRANCH_MANAGER = 'branch_manager',
  USER = 'user',
  AUDITOR = 'auditor',
}

export const DEFAULT_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.BRANCH_MANAGER,
  UserRole.USER,
  UserRole.AUDITOR,
];
