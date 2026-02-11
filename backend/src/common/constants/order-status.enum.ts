export enum OrderStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval', // İkinci admin təsdiqini gözləyir
  APPROVED = 'approved', // İkinci admin tərəfindən təsdiqlənib
  REJECTED = 'rejected', // İkinci admin tərəfindən rədd edilib
  CONFIRMED = 'confirmed',
  PROCESSING = 'processing',
  SHIPPED = 'shipped',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}
