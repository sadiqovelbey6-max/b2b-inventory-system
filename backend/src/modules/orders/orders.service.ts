import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Inject,
  forwardRef,
  ForbiddenException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { OrderItem, OrderItemDocument } from './schemas/order-item.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CartsService } from '../carts/carts.service';
import { OrderStatus } from '../../common/constants/order-status.enum';
import { OrderCreatedEvent } from '../notifications/events/order-created.event';
import { StockCalculationService } from '../transactions/stock-calculation.service';

type UserLike = {
  id?: string;
  _id?: Types.ObjectId;
  email?: string;
  branch?: Types.ObjectId | { id?: string; _id?: Types.ObjectId } | null;
};

function toId(
  d: { _id?: Types.ObjectId } | Types.ObjectId | string | null | undefined,
): string | null {
  if (!d) return null;
  if (typeof d === 'string') return d;
  if (typeof (d as Types.ObjectId).toString === 'function')
    return (d as Types.ObjectId).toString();
  return (d as { _id?: Types.ObjectId })?._id?.toString() ?? null;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    @InjectModel(OrderItem.name)
    private readonly orderItemModel: Model<OrderItemDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly cartsService: CartsService,
    private readonly events: EventEmitter2,
    @Inject(forwardRef(() => StockCalculationService))
    private readonly stockCalculationService: StockCalculationService,
  ) {}

  async createOrderFromGeneralCart(user: UserLike) {
    try {
      const userId = toId(user?._id ?? user?.id);
      const userEmail = (user as { email?: string })?.email ?? '';
      this.logger.debug(`createOrderFromGeneralCart başladı: userId=${userId}`);

      try {
        await this.stockCalculationService.calculateStockForAllProducts();
      } catch (stockCalcError) {
        this.logger.warn(
          'Stock calculation xətası (bloklamır)',
          stockCalcError instanceof Error ? stockCalcError.stack : undefined,
        );
      }

      const cartEntity = await this.cartsService.getOrCreateGeneralCart();
      if (!cartEntity.items || cartEntity.items.length === 0) {
        throw new BadRequestException('Səbət boşdur');
      }

      let subtotal = 0;
      const stockShortageItems: Array<{
        productCode: string;
        productName: string;
        requestedQty: number;
        availableQty: number;
        shortageQty: number;
      }> = [];

      const orderItemInputs: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }> = [];

      for (const cartItem of cartEntity.items as Array<{
        product: { id?: string; code?: string; name?: string; price?: number };
        quantity: number;
      }>) {
        const prod = cartItem.product;
        if (!prod?.id) continue;

        let currentStock = 0;
        let inventory: Record<string, unknown> | null = null;
        try {
          const inv = await this.inventoryModel
            .findOne({ branch: null, product: prod.id })
            .lean()
            .exec();
          inventory = inv as Record<string, unknown>;
          currentStock = Number(
            inventory?.calculatedQty ?? inventory?.availableQty ?? 0,
          );
        } catch {
          currentStock = 0;
        }

        const qty = Number(cartItem.quantity ?? 0);
        const shortageQty = Math.max(qty - currentStock, 0);
        if (shortageQty > 0) {
          stockShortageItems.push({
            productCode: prod.code ?? '',
            productName: prod.name ?? '',
            requestedQty: qty,
            availableQty: currentStock,
            shortageQty,
          });
          if (inventory && currentStock > 0) {
            await this.inventoryModel
              .updateOne(
                { _id: inventory._id },
                { $inc: { reservedQty: currentStock } },
              )
              .exec();
          }
        } else if (inventory) {
          await this.inventoryModel
            .updateOne({ _id: inventory._id }, { $inc: { reservedQty: qty } })
            .exec();
        }

        const productPrice = Number(prod.price ?? 0);
        if (isNaN(productPrice))
          throw new BadRequestException(`Məhsul qiyməti düzgün deyil`);
        const lineTotal = productPrice * qty;
        subtotal += lineTotal;
        orderItemInputs.push({
          productId: prod.id,
          quantity: qty,
          unitPrice: productPrice,
          lineTotal,
        });
      }

      if (orderItemInputs.length === 0) {
        throw new BadRequestException('Səbət boşdur');
      }

      const createdById = userId ? new Types.ObjectId(userId) : null;
      if (!createdById) throw new BadRequestException('İstifadəçi tapılmadı');

      const [savedOrder] = await this.orderModel.create([
        {
          branch: null,
          createdBy: createdById,
          status: OrderStatus.PENDING_APPROVAL,
          subtotal,
          total: subtotal,
          stockShortageItems:
            stockShortageItems.length > 0 ? stockShortageItems : undefined,
        },
      ]);

      const orderId = savedOrder._id;
      const itemIds: Types.ObjectId[] = [];
      for (const inp of orderItemInputs) {
        const [oi] = await this.orderItemModel.create([
          {
            order: orderId,
            product: new Types.ObjectId(inp.productId),
            quantity: inp.quantity,
            unitPrice: inp.unitPrice,
            lineTotal: inp.lineTotal,
          },
        ]);
        itemIds.push(oi._id);
      }

      await this.orderModel
        .updateOne({ _id: orderId }, { $set: { items: itemIds } })
        .exec();

      try {
        await this.cartsService.clearGeneralCart();
      } catch {
        // ignore
      }

      const eventItems = orderItemInputs.map((inp, i) => {
        const cartProd = (
          cartEntity.items as Array<{
            product?: { code?: string; name?: string };
          }>
        )?.[i]?.product;
        return {
          code: cartProd?.code ?? '',
          name: cartProd?.name ?? '',
          quantity: inp.quantity,
          unitPrice: inp.unitPrice,
          lineTotal: inp.lineTotal,
        };
      });

      try {
        this.events.emit(
          'order.created',
          new OrderCreatedEvent(
            orderId.toString(),
            null,
            null,
            subtotal,
            savedOrder.createdAt ?? new Date(),
            userEmail,
            eventItems,
            this.resolveOrderRecipients(userEmail, null),
          ),
        );
      } catch {
        // ignore
      }

      const orderWithItems = await this.orderModel
        .findById(orderId)
        .populate('items')
        .populate({ path: 'items', populate: { path: 'product' } })
        .populate('branch')
        .populate('createdBy')
        .populate('approvedBy')
        .lean()
        .exec();

      const orderData = orderWithItems ?? savedOrder;
      return this.formatOrderResponse(
        orderData as unknown as Record<string, unknown>,
        userEmail,
      );
    } catch (error) {
      this.logger.error(
        `createOrderFromGeneralCart xətası: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async createOrderFromCart(branchId: string, user: UserLike) {
    try {
      const branch = await this.branchModel.findById(branchId).lean().exec();
      if (!branch) throw new NotFoundException('Filial tapılmadı');

      const cartEntity = await this.cartsService.getOrCreateCart(branchId);
      if (!cartEntity.items || cartEntity.items.length === 0) {
        throw new BadRequestException('Səbət boşdur');
      }

      const orderItemInputs: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        product: Record<string, unknown>;
      }> = [];

      for (const cartItem of cartEntity.items as Array<{
        product: { id?: string; code?: string; name?: string; price?: number };
        quantity: number;
      }>) {
        const prod = cartItem.product;
        if (!prod?.id)
          throw new BadRequestException(
            'Səbət elementində məhsul məlumatı yoxdur',
          );

        const qty = Number(cartItem.quantity ?? 0);
        const inventory = await this.inventoryModel
          .findOne({ branch: null, product: prod.id })
          .lean()
          .exec();
        const publishedStock = Number(inventory?.availableQty ?? 0);
        if (!inventory || publishedStock < qty) {
          throw new BadRequestException(
            `Məhsul üçün kifayət qədər ehtiyat yoxdur: ${prod.name} (mövcud: ${publishedStock})`,
          );
        }

        await this.inventoryModel
          .updateOne(
            { _id: (inventory as { _id: Types.ObjectId })._id },
            { $inc: { reservedQty: qty } },
          )
          .exec();

        const productPrice = Number(prod.price ?? 0);
        if (isNaN(productPrice))
          throw new BadRequestException(`Məhsul qiyməti düzgün deyil`);
        const lineTotal = productPrice * qty;
        orderItemInputs.push({
          productId: prod.id,
          quantity: qty,
          unitPrice: productPrice,
          lineTotal,
          product: prod as Record<string, unknown>,
        });
      }

      const subtotal = orderItemInputs.reduce((s, i) => s + i.lineTotal, 0);
      const userId = toId(user?._id ?? user?.id);
      if (!userId) throw new BadRequestException('İstifadəçi tapılmadı');

      const [savedOrder] = await this.orderModel.create([
        {
          branch: new Types.ObjectId(branchId),
          createdBy: new Types.ObjectId(userId),
          status: OrderStatus.PENDING_APPROVAL,
          subtotal,
          total: subtotal,
        },
      ]);

      const orderId = savedOrder._id;
      const itemIds: Types.ObjectId[] = [];
      for (const inp of orderItemInputs) {
        const [oi] = await this.orderItemModel.create([
          {
            order: orderId,
            product: new Types.ObjectId(inp.productId),
            quantity: inp.quantity,
            unitPrice: inp.unitPrice,
            lineTotal: inp.lineTotal,
          },
        ]);
        itemIds.push(oi._id);
      }
      await this.orderModel
        .updateOne({ _id: orderId }, { $set: { items: itemIds } })
        .exec();

      try {
        await this.cartsService.clearCart(branchId);
      } catch {
        // ignore
      }

      try {
        const eventItems = orderItemInputs.map((i) => ({
          code: (i.product as { code?: string })?.code ?? '',
          name: (i.product as { name?: string })?.name ?? '',
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        }));
        this.events.emit(
          'order.created',
          new OrderCreatedEvent(
            orderId.toString(),
            (branch as { name?: string })?.name ?? 'Ümumi',
            branchId,
            subtotal,
            savedOrder.createdAt ?? new Date(),
            (user as { email?: string })?.email ?? '',
            eventItems,
            this.resolveOrderRecipients(
              (user as { email?: string })?.email ?? '',
              (branch as { email?: string })?.email ?? null,
            ),
          ),
        );
      } catch {
        // ignore
      }

      const orderWithItems = await this.orderModel
        .findById(orderId)
        .populate('items')
        .populate({ path: 'items', populate: { path: 'product' } })
        .populate('branch')
        .populate('createdBy')
        .lean()
        .exec();

      const orderData = orderWithItems ?? savedOrder;
      return this.formatOrderResponse(
        orderData as unknown as Record<string, unknown>,
        (user as { email?: string })?.email ?? '',
      );
    } catch (error) {
      this.logger.error(
        `createOrderFromCart xətası: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  async approveOrder(orderId: string, adminUser: UserLike) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('items')
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('branch')
      .populate('createdBy')
      .lean()
      .exec();

    if (!order) throw new NotFoundException('Sifariş tapılmadı');
    if (
      (order as { status?: string }).status !== OrderStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException('Sifariş təsdiqlənməyə hazır deyil');
    }

    const approvedById = toId(adminUser?._id ?? adminUser?.id);
    if (!approvedById) throw new BadRequestException('Admin tapılmadı');

    await this.orderModel
      .updateOne(
        { _id: orderId },
        {
          $set: {
            status: OrderStatus.APPROVED,
            approvedAt: new Date(),
            approvedBy: new Types.ObjectId(approvedById),
          },
        },
      )
      .exec();

    const orderForTx = await this.orderModel
      .findById(orderId)
      .populate({ path: 'items', populate: { path: 'product' } })
      .lean()
      .exec();

    const txOrder = (orderForTx ?? null) as unknown as {
      _id: Types.ObjectId;
      items?: Array<{
        product: { _id?: Types.ObjectId } | Types.ObjectId;
        quantity: number;
      }>;
    };
    const items = txOrder?.items ?? [];
    await this.stockCalculationService.createTransactionFromOrder({
      _id: txOrder._id,
      items: items.map((i) => {
        const p = i.product;
        const productWithId =
          typeof (p as Types.ObjectId).toString === 'function'
            ? { _id: p }
            : (p as { _id: Types.ObjectId });
        return { product: productWithId, quantity: i.quantity };
      }),
    });

    return this.getOrderById(orderId);
  }

  async rejectOrder(orderId: string, adminUser: UserLike, reason?: string) {
    const order = await this.orderModel
      .findById(orderId)
      .populate({ path: 'items', populate: { path: 'product' } })
      .lean()
      .exec();

    if (!order) throw new NotFoundException('Sifariş tapılmadı');
    if (
      (order as { status?: string }).status !== OrderStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException('Sifariş rədd edilə bilməz');
    }

    const items =
      (
        (order ?? null) as unknown as {
          items?: Array<{
            product: { _id?: Types.ObjectId } | Types.ObjectId;
            quantity: number;
          }>;
        }
      )?.items ?? [];
    for (const item of items) {
      const inv = await this.inventoryModel
        .findOne({
          branch: null,
          product:
            (item.product as { _id?: Types.ObjectId })?._id ?? item.product,
        })
        .exec();
      if (inv) {
        inv.reservedQty = Math.max(0, inv.reservedQty - item.quantity);
        await inv.save();
      }
    }

    await this.orderModel
      .updateOne(
        { _id: orderId },
        {
          $set: {
            status: OrderStatus.REJECTED,
            rejectedAt: new Date(),
            rejectionReason: reason ?? null,
          },
        },
      )
      .exec();

    return this.getOrderById(orderId);
  }

  async getPendingApprovalOrders(branchId?: string) {
    const filter: Record<string, unknown> = {
      status: OrderStatus.PENDING_APPROVAL,
    };
    if (branchId) {
      filter.branch = new Types.ObjectId(branchId);
    } else {
      filter.branch = null;
    }

    const orders = await this.orderModel
      .find(filter)
      .populate('items')
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('branch')
      .populate('createdBy')
      .populate('approvedBy')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return this.mapOrdersToDto(orders as Array<Record<string, unknown>>);
  }

  async getOrderById(orderId: string) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('items')
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('branch')
      .populate('createdBy')
      .populate('approvedBy')
      .lean()
      .exec();

    if (!order) throw new NotFoundException('Sifariş tapılmadı');
    return this.formatOrderResponse(order as Record<string, unknown>, '');
  }

  async markAsShipped(orderId: string, user: UserLike) {
    const order = await this.orderModel
      .findById(orderId)
      .populate('branch')
      .lean()
      .exec();

    if (!order) throw new NotFoundException('Sifariş tapılmadı');

    const orderBranchId = toId(
      (order as { branch?: { _id?: Types.ObjectId } })?.branch,
    );
    const userBranchId = toId(
      user?.branch?._id ?? (user?.branch as { id?: string })?.id,
    );
    if (orderBranchId && userBranchId && orderBranchId !== userBranchId) {
      throw new ForbiddenException(
        'Bu sifarişi çatdırmaq üçün icazəniz yoxdur',
      );
    }

    if ((order as { status?: string }).status !== OrderStatus.APPROVED) {
      throw new BadRequestException(
        'Sifariş çatdırıla bilməz (status: ' +
          (order as { status?: string }).status +
          ')',
      );
    }

    await this.orderModel
      .updateOne({ _id: orderId }, { $set: { status: OrderStatus.SHIPPED } })
      .exec();

    return this.getOrderById(orderId);
  }

  async markAsDelivered(orderId: string, adminUser: UserLike) {
    const order = await this.orderModel.findById(orderId).lean().exec();
    if (!order) throw new NotFoundException('Sifariş tapılmadı');

    const status = (order as { status?: string }).status;
    if (status !== OrderStatus.SHIPPED && status !== OrderStatus.APPROVED) {
      throw new BadRequestException(
        'Sifariş çatdırılmış kimi işarələnə bilməz (status: ' + status + ')',
      );
    }

    await this.orderModel
      .updateOne(
        { _id: orderId },
        { $set: { status: OrderStatus.DELIVERED, deliveredAt: new Date() } },
      )
      .exec();

    this.events.emit('order.delivered', { orderId });
    return this.getOrderById(orderId);
  }

  async listOrdersForBranch(branchId?: string) {
    if (!branchId) return this.listAllOrders();

    const orders = await this.orderModel
      .find({ branch: new Types.ObjectId(branchId) })
      .populate('items')
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('branch')
      .populate('createdBy')
      .populate('approvedBy')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return this.mapOrdersToDto(orders as Array<Record<string, unknown>>);
  }

  async listAllOrders() {
    const orders = await this.orderModel
      .find()
      .populate('items')
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('branch')
      .populate('createdBy')
      .populate('approvedBy')
      .sort({ createdAt: -1 })
      .lean()
      .exec();

    return this.mapOrdersToDto(orders as Array<Record<string, unknown>>);
  }

  private mapOrdersToDto(orders: Array<Record<string, unknown>>) {
    return orders.map((order) => ({
      id: toId(order._id ?? order),
      status: order.status,
      total: Number(order.total ?? 0),
      branch: order.branch
        ? {
            id: toId(
              (order.branch as { _id?: Types.ObjectId }) ?? order.branch,
            ),
            name: (order.branch as { name?: string })?.name ?? '',
          }
        : null,
      createdBy: order.createdBy
        ? {
            id: toId(
              (order.createdBy as { _id?: Types.ObjectId }) ?? order.createdBy,
            ),
            email: (order.createdBy as { email?: string })?.email ?? '',
          }
        : null,
      items: ((order.items ?? []) as Array<Record<string, unknown>>).map(
        (item) => ({
          id: toId((item as { _id?: Types.ObjectId })._id ?? item),
          product: item.product
            ? {
                id: toId(
                  (item.product as { _id?: Types.ObjectId }) ?? item.product,
                ),
                code: (item.product as { code?: string })?.code ?? '',
                name: (item.product as { name?: string })?.name ?? '',
              }
            : null,
          quantity: (item as { quantity?: number }).quantity ?? 0,
          unitPrice: Number((item as { unitPrice?: number }).unitPrice ?? 0),
          lineTotal: Number((item as { lineTotal?: number }).lineTotal ?? 0),
        }),
      ),
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      approvedAt: order.approvedAt,
      approvedBy: order.approvedBy
        ? {
            id: toId(
              (order.approvedBy as { _id?: Types.ObjectId }) ??
                order.approvedBy,
            ),
            email: (order.approvedBy as { email?: string })?.email ?? '',
          }
        : null,
      rejectedAt: order.rejectedAt,
      rejectionReason: order.rejectionReason,
      deliveredAt: order.deliveredAt,
    }));
  }

  private formatOrderResponse(
    order: Record<string, unknown>,
    _userEmail: string,
  ) {
    return {
      id: toId(order._id ?? order),
      status: order.status,
      branch: order.branch
        ? {
            id: toId(
              (order.branch as { _id?: Types.ObjectId }) ?? order.branch,
            ),
            name: (order.branch as { name?: string })?.name ?? '',
          }
        : null,
      createdBy: order.createdBy
        ? {
            id: toId(
              (order.createdBy as { _id?: Types.ObjectId }) ?? order.createdBy,
            ),
            email: (order.createdBy as { email?: string })?.email ?? '',
          }
        : null,
      approvedBy: order.approvedBy
        ? {
            id: toId(
              (order.approvedBy as { _id?: Types.ObjectId }) ??
                order.approvedBy,
            ),
            email: (order.approvedBy as { email?: string })?.email ?? '',
          }
        : null,
      subtotal: Number(order.subtotal ?? 0),
      total: Number(order.total ?? 0),
      items: ((order.items ?? []) as Array<Record<string, unknown>>).map(
        (item) => ({
          id: toId((item as { _id?: Types.ObjectId })._id ?? item),
          product: item.product
            ? {
                id: toId(
                  (item.product as { _id?: Types.ObjectId }) ?? item.product,
                ),
                code: (item.product as { code?: string })?.code ?? '',
                name: (item.product as { name?: string })?.name ?? '',
              }
            : null,
          quantity: (item as { quantity?: number }).quantity ?? 0,
          unitPrice: Number((item as { unitPrice?: number }).unitPrice ?? 0),
          lineTotal: Number((item as { lineTotal?: number }).lineTotal ?? 0),
        }),
      ),
      createdAt: order.createdAt,
      confirmedAt: order.confirmedAt,
      approvedAt: order.approvedAt,
      rejectedAt: order.rejectedAt,
      rejectionReason: order.rejectionReason,
      deliveredAt: order.deliveredAt,
    };
  }

  private resolveOrderRecipients(
    userEmail: string,
    branchEmail?: string | null,
  ) {
    const recipients = new Set<string>();
    if (userEmail) recipients.add(userEmail);
    if (branchEmail) recipients.add(branchEmail);
    return Array.from(recipients);
  }

  async getMonthlyStatistics(year?: number, tenantId?: string) {
    const targetYear = year ? Number(year) : new Date().getFullYear();
    if (isNaN(targetYear) || targetYear < 2000 || targetYear > 2100) {
      throw new BadRequestException('İl düzgün deyil');
    }

    const orders = await this.orderModel
      .find({ status: OrderStatus.DELIVERED })
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate('createdBy')
      .lean()
      .exec();

    const filteredByYear = orders.filter((o) => {
      const d = (o as { createdAt?: Date }).createdAt;
      return d && new Date(d).getFullYear() === targetYear;
    });

    const monthlyStats: Record<
      number,
      { revenue: number; expenses: number; profit: number; orderCount: number }
    > = {};
    for (let m = 0; m < 12; m++)
      monthlyStats[m] = { revenue: 0, expenses: 0, profit: 0, orderCount: 0 };

    for (const order of filteredByYear) {
      const d = (order as { createdAt?: Date }).createdAt;
      if (!d) continue;
      const month = new Date(d).getMonth();
      if (month < 0 || month > 11) continue;
      const stats = monthlyStats[month];
      if (!stats) continue;
      const total = Number((order as { total?: number }).total ?? 0);
      stats.revenue += total;
      stats.orderCount += 1;
      const items =
        (
          order as {
            items?: Array<{
              product?: { purchasePrice?: number };
              quantity?: number;
            }>;
          }
        ).items ?? [];
      for (const item of items) {
        const pp = Number(item.product?.purchasePrice ?? 0);
        const q = Number(item.quantity ?? 0);
        if (!isNaN(pp) && !isNaN(q)) stats.expenses += pp * q;
      }
    }

    for (let m = 0; m < 12; m++) {
      if (monthlyStats[m])
        monthlyStats[m].profit =
          monthlyStats[m].revenue - monthlyStats[m].expenses;
    }

    const months = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'İyun',
      'İyul',
      'Avqust',
      'Sentyabr',
      'Oktyabr',
      'Noyabr',
      'Dekabr',
    ];
    return Array.from({ length: 12 }, (_, month) => {
      const s = monthlyStats[month];
      return {
        month,
        monthName: months[month] ?? `Ay ${month + 1}`,
        year: targetYear,
        revenue: s?.revenue ?? 0,
        expenses: s?.expenses ?? 0,
        profit: s?.profit ?? 0,
        orderCount: s?.orderCount ?? 0,
      };
    });
  }

  async getMonthlyDetails(year: number, month: number, tenantId?: string) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999);

    const orders = await this.orderModel
      .find({ status: OrderStatus.DELIVERED })
      .populate({ path: 'items', populate: { path: 'product' } })
      .populate({ path: 'createdBy', populate: { path: 'tenant' } })
      .lean()
      .exec();

    let filtered = orders.filter((o) => {
      const d = (o as { createdAt?: Date }).createdAt;
      return d && new Date(d) >= startDate && new Date(d) <= endDate;
    });

    if (tenantId) {
      filtered = filtered.filter((o) => {
        const cb = (o as { createdBy?: { tenant?: { _id?: Types.ObjectId } } })
          .createdBy;
        const tid = cb?.tenant
          ? toId((cb.tenant as { _id?: Types.ObjectId })._id ?? cb.tenant)
          : null;
        return tid === tenantId;
      });
    }

    let totalRevenue = 0;
    let totalExpenses = 0;
    const orderDetails: Array<{
      id: string;
      createdAt: Date;
      total: number;
      expenses: number;
      profit: number;
      itemCount: number;
    }> = [];

    for (const order of filtered) {
      const total = Number((order as { total?: number }).total ?? 0);
      totalRevenue += total;
      let orderExpenses = 0;
      const items =
        (
          order as {
            items?: Array<{
              product?: { purchasePrice?: number };
              quantity?: number;
            }>;
          }
        ).items ?? [];
      for (const item of items) {
        const pp = Number(item.product?.purchasePrice ?? 0);
        const q = Number(item.quantity ?? 0);
        if (!isNaN(pp) && !isNaN(q)) orderExpenses += pp * q;
      }
      totalExpenses += orderExpenses;
      orderDetails.push({
        id: toId((order as { _id?: Types.ObjectId })._id) ?? '',
        createdAt: (order as { createdAt?: Date }).createdAt ?? new Date(),
        total,
        expenses: orderExpenses,
        profit: total - orderExpenses,
        itemCount: items.length,
      });
    }

    const monthNames = [
      'Yanvar',
      'Fevral',
      'Mart',
      'Aprel',
      'May',
      'İyun',
      'İyul',
      'Avqust',
      'Sentyabr',
      'Oktyabr',
      'Noyabr',
      'Dekabr',
    ];
    return {
      year,
      month,
      monthName: monthNames[month] ?? `Ay ${month + 1}`,
      totalRevenue,
      totalExpenses,
      totalProfit: totalRevenue - totalExpenses,
      orderCount: filtered.length,
      orders: orderDetails,
    };
  }

  async getTopSellingProducts(limit: number = 100, tenantId?: string) {
    const limitInt = Math.min(
      Math.max(parseInt(String(limit), 10) || 100, 500),
      500,
    );

    const agg = await this.orderItemModel
      .aggregate([
        {
          $lookup: {
            from: 'orders',
            localField: 'order',
            foreignField: '_id',
            as: 'ord',
          },
        },
        { $unwind: '$ord' },
        { $match: { 'ord.status': OrderStatus.DELIVERED } },
        { $group: { _id: '$product', totalSales: { $sum: '$quantity' } } },
        { $sort: { totalSales: -1 } },
        { $limit: limitInt },
        {
          $lookup: {
            from: 'products',
            localField: '_id',
            foreignField: '_id',
            as: 'prod',
          },
        },
        { $unwind: '$prod' },
        {
          $project: {
            productId: '$_id',
            productCode: '$prod.code',
            productName: '$prod.name',
            productCategory: '$prod.category',
            productUnit: '$prod.unit',
            productImageUrl: '$prod.imageUrl',
            totalSales: { $toInt: '$totalSales' },
          },
        },
      ])
      .exec();

    return agg.map((r: Record<string, unknown>) => ({
      productId:
        r.productId &&
        typeof (r.productId as { toString?: () => string }).toString ===
          'function'
          ? (r.productId as { toString: () => string }).toString()
          : String(r.productId ?? ''),
      productCode: r.productCode,
      productName: r.productName,
      productCategory: r.productCategory,
      productUnit: r.productUnit,
      productImageUrl: r.productImageUrl,
      totalSales: Number(r.totalSales ?? 0),
    }));
  }
}
