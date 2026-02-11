export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  BRANCH_MANAGER: 'branch_manager',
  USER: 'user',
  AUDITOR: 'auditor',
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export interface Branch {
  id: string;
  name: string;
  code?: string;
}

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  branch?: Branch | null;
  twoFactorEnabled?: boolean;
}

export interface TwoFactorSetupResult {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface ProductInventoryByBranch {
  branchId: string;
  branchName: string;
  availableQty: number;
  calculatedQty?: number;
  inTransitQty: number;
  reservedQty: number;
}

export interface ProductInventory {
  byBranch: ProductInventoryByBranch[];
  currentBranch: ProductInventoryByBranch | null;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  barcode?: string | null;
  unit?: string | null;
  price: number;
  purchasePrice?: number;
  branch?: {
    id: string;
    name: string;
    code: string;
  } | null;
  inventory: ProductInventory;
  isSubstitute?: boolean; // Əvəz edici olduğunu göstərmək üçün
}

export interface CodeLookupProduct {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  barcode?: string | null;
  unit?: string | null;
  price: number;
  purchasePrice?: number;
  inventory: {
    availableQty: number;
    inTransitQty: number;
    reservedQty: number;
  };
  isSubstitute?: boolean; // Əvəz edici olduğunu göstərmək üçün
}

export interface ProductSubstitute {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  category?: string | null;
  barcode?: string | null;
  unit?: string | null;
  price: number;
  inventory: {
    availableQty: number;
    inTransitQty: number;
    reservedQty: number;
  };
  createdAt: string;
}

export interface CartProduct {
  id: string;
  code: string;
  name: string;
  price: number;
  imageUrl?: string | null;
}

export interface CartItem {
  id: string;
  product: CartProduct;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Cart {
  id: string;
  branch: Branch;
  totalAmount: number;
  items: CartItem[];
}

export interface OrderSummaryItem {
  id: string;
  product: {
    id: string;
    code: string;
    name: string;
  };
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  branch: Branch | null;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
  confirmedAt?: string | null;
  approvedAt?: string | null;
  approvedBy?: { id: string; email: string } | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  deliveredAt?: string | null;
  stockShortageItems?: Array<{
    productCode: string;
    productName: string;
    requestedQty: number;
    availableQty: number;
    shortageQty: number;
  }> | null;
  items: OrderSummaryItem[];
  createdBy?: { id: string; email: string } | null;
}

export interface AuditLogEntry {
  id: string;
  actor?: User | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  createdAt: string;
  changes: AuditLogChange[];
}

export interface AuditLogChange {
  path: string;
  type: 'added' | 'removed' | 'modified';
  before?: unknown;
  after?: unknown;
}

export interface ImportSummary {
  processed: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

