export const queryKeys = {
  products: (branchId?: string | null) => ['products', branchId ?? 'all'] as const,
  cart: (branchId?: string | null) => ['cart', branchId ?? 'none'] as const,
  orders: (branchId?: string | null) => ['orders', branchId ?? 'all'] as const,
  branches: ['branches'] as const,
  adminUsers: ['admin', 'users'] as const,
  registrationConfig: ['admin', 'registration-config'] as const,
  tenants: ['tenants'] as const,
  codeLookup: (code: string, branchId?: string | null) =>
    ['code-lookup', code, branchId ?? 'all'] as const,
};


