export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly branchName: string | null,
    public readonly branchId: string | null,
    public readonly total: number,
    public readonly createdAt: Date,
    public readonly createdByEmail: string,
    public readonly items: Array<{
      code: string;
      name: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>,
    public readonly recipients: string[],
  ) {}
}
