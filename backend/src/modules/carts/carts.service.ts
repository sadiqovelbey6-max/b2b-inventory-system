import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BranchCart, BranchCartDocument } from './schemas/branch-cart.schema';
import { CartItem, CartItemDocument } from './schemas/cart-item.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';

function toId(d: { _id?: Types.ObjectId } | null | undefined): string | null {
  return d?._id?.toString() ?? null;
}

function toRefId(
  d: Types.ObjectId | { _id?: Types.ObjectId } | null | undefined,
): string | null {
  if (!d) return null;
  if (
    typeof (d as Types.ObjectId).toString === 'function' &&
    !('_id' in (d as object))
  )
    return (d as Types.ObjectId).toString();
  return (d as { _id?: Types.ObjectId })?._id?.toString() ?? null;
}

@Injectable()
export class CartsService {
  private readonly logger = new Logger(CartsService.name);

  constructor(
    @InjectModel(BranchCart.name)
    private readonly cartModel: Model<BranchCartDocument>,
    @InjectModel(CartItem.name)
    private readonly cartItemModel: Model<CartItemDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
  ) {}

  async getOrCreateCart(branchId: string) {
    this.logger.debug(`getOrCreateCart - BranchId: ${branchId}`);

    let cart: Record<string, unknown> | null = (await this.cartModel
      .findOne({ branch: new Types.ObjectId(branchId) })
      .lean()
      .exec()) as Record<string, unknown> | null;

    if (!cart) {
      this.logger.debug(
        'getOrCreateCart - Cart tapılmadı, yeni cart yaradılır',
      );
      const branch = await this.branchModel.findById(branchId).lean().exec();

      if (!branch) {
        this.logger.warn(`getOrCreateCart - Filial tapılmadı: ${branchId}`);
        throw new NotFoundException('Filial tapılmadı');
      }

      const created = await this.cartModel.create({
        branch: new Types.ObjectId(branchId),
        totalAmount: 0,
      });
      cart = (created.toObject
        ? created.toObject()
        : created) as unknown as Record<string, unknown>;
      this.logger.debug(
        `getOrCreateCart - Yeni cart yaradıldı: ${toId(cart as { _id?: Types.ObjectId })}`,
      );
    }

    return this.enrichCart(cart, branchId);
  }

  async getCartForBranch(branchId: string) {
    const cart = await this.getOrCreateCart(branchId);
    return this.normalizeCart(cart);
  }

  async getOrCreateGeneralCart() {
    let cart: Record<string, unknown> | null = (await this.cartModel
      .findOne({ branch: null })
      .lean()
      .exec()) as Record<string, unknown> | null;

    if (!cart) {
      const created = await this.cartModel.create({
        branch: null,
        totalAmount: 0,
      });
      cart = (created.toObject
        ? created.toObject()
        : created) as unknown as Record<string, unknown>;
    }

    return this.enrichCart(cart, null);
  }

  async getGeneralCart() {
    const cart = await this.getOrCreateGeneralCart();
    return this.normalizeGeneralCart(cart);
  }

  private async enrichCart(
    cart: Record<string, unknown>,
    branchId: string | null,
  ) {
    const cartId = toId(cart as { _id?: Types.ObjectId });
    if (!cartId) return { cart, items: [] };

    const items = await this.cartItemModel
      .find({ cart: new Types.ObjectId(cartId) })
      .populate('product')
      .lean()
      .exec();

    const branch = branchId
      ? await this.branchModel.findById(branchId).lean().exec()
      : null;

    // OrdersService (TypeORM) cartItem.product.id gözləyir — Mongoose-də _id var, id əlavə edirik
    const itemsWithId = (items as Array<Record<string, unknown>>).map((i) => {
      const p = i.product as Record<string, unknown> | undefined;
      if (p) p.id = toRefId(p as Types.ObjectId | { _id?: Types.ObjectId });
      return i;
    });
    return {
      ...cart,
      branch,
      items: itemsWithId,
    };
  }

  async updateItemQuantityForGeneralCart(productId: string, quantity: number) {
    const cartData = await this.getOrCreateGeneralCart();
    const cart = cartData as {
      _id?: Types.ObjectId;
      branch?: null;
      items?: Array<Record<string, unknown>>;
      totalAmount?: number;
    };

    const product = await this.productModel.findById(productId).lean().exec();
    if (!product) {
      throw new NotFoundException('Məhsul tapılmadı');
    }

    const cartId = toId(cart as { _id?: Types.ObjectId });
    if (!cartId) throw new NotFoundException('Cart tapılmadı');

    const items = cart.items ?? [];
    let item = items.find(
      (ci) =>
        toRefId(ci.product as Types.ObjectId | { _id?: Types.ObjectId }) ===
        productId,
    );

    if (!item && quantity > 0) {
      const [created] = await this.cartItemModel.create([
        {
          cart: new Types.ObjectId(cartId),
          product: new Types.ObjectId(productId),
          quantity: 0,
          unitPrice: Number((product as { price?: number }).price ?? 0),
          lineTotal: 0,
        },
      ]);
      item = (created.toObject
        ? created.toObject()
        : created) as unknown as Record<string, unknown>;
      items.push(item);
    }

    if (!item) {
      return this.getGeneralCart();
    }

    const itemId = toId(item as { _id?: Types.ObjectId });
    const price = Number((product as { price?: number }).price ?? 0);

    if (quantity <= 0) {
      if (itemId) await this.cartItemModel.deleteOne({ _id: itemId }).exec();
      const remaining = items.filter(
        (ci) => toId(ci as { _id?: Types.ObjectId }) !== itemId,
      );
      const totalAmount = remaining.reduce(
        (s, ci) => s + Number((ci as { lineTotal?: number }).lineTotal ?? 0),
        0,
      );
      await this.cartModel
        .updateOne({ _id: cartId }, { $set: { totalAmount } })
        .exec();
    } else {
      const lineTotal = price * quantity;
      await this.cartItemModel
        .updateOne(
          { _id: itemId },
          { $set: { quantity, unitPrice: price, lineTotal } },
        )
        .exec();
      const updatedItems = items.map((ci) =>
        toId(ci as { _id?: Types.ObjectId }) === itemId
          ? { ...ci, quantity, unitPrice: price, lineTotal }
          : ci,
      );
      const totalAmount = updatedItems.reduce(
        (s, ci) => s + Number((ci as { lineTotal?: number }).lineTotal ?? 0),
        0,
      );
      await this.cartModel
        .updateOne({ _id: cartId }, { $set: { totalAmount } })
        .exec();
    }

    return this.getGeneralCart();
  }

  normalizeGeneralCart(cartData: Record<string, unknown>) {
    const items = (cartData.items ?? []) as Array<Record<string, unknown>>;
    return {
      id: toId(cartData as { _id?: Types.ObjectId }),
      branch: null,
      totalAmount: Number(cartData.totalAmount ?? 0),
      items: items.map((item) => {
        const prod = item.product as Record<string, unknown>;
        return {
          id: toId(item as { _id?: Types.ObjectId }),
          product: {
            id: toRefId(prod as Types.ObjectId | { _id?: Types.ObjectId }),
            code: prod?.code,
            name: prod?.name,
            price: Number(prod?.price ?? 0),
            imageUrl: prod?.imageUrl,
          },
          quantity: (item as { quantity?: number }).quantity ?? 0,
          unitPrice: Number((item as { unitPrice?: number }).unitPrice ?? 0),
          lineTotal: Number((item as { lineTotal?: number }).lineTotal ?? 0),
        };
      }),
    };
  }

  async updateItemQuantity(
    branchId: string,
    productId: string,
    quantity: number,
  ) {
    this.logger.debug(
      `updateItemQuantity - branchId=${branchId}, productId=${productId}, quantity=${quantity}`,
    );

    const cartData = await this.getOrCreateCart(branchId);
    const cart = cartData as {
      _id?: Types.ObjectId;
      items?: Array<Record<string, unknown>>;
    };

    const product = await this.productModel.findById(productId).lean().exec();
    if (!product) {
      this.logger.warn(`updateItemQuantity - Məhsul tapılmadı: ${productId}`);
      throw new NotFoundException('Məhsul tapılmadı');
    }

    let inventory = await this.inventoryModel
      .findOne({
        branch: new Types.ObjectId(branchId),
        product: new Types.ObjectId(productId),
      })
      .lean()
      .exec();

    if (!inventory) {
      inventory = await this.inventoryModel
        .findOne({ branch: null, product: new Types.ObjectId(productId) })
        .lean()
        .exec();
    }

    const availableQty =
      (inventory as { availableQty?: number })?.availableQty ?? 0;

    if (quantity > availableQty) {
      this.logger.warn(
        `updateItemQuantity - Miqdar limiti aşıldı: available=${availableQty}, requested=${quantity}`,
      );
      throw new BadRequestException('Seçilən miqdar mövcud ehtiyatı aşır');
    }

    const cartId = toId(cart as { _id?: Types.ObjectId });
    if (!cartId) throw new NotFoundException('Cart tapılmadı');

    const items = cart.items ?? [];
    let item = items.find(
      (ci) =>
        toRefId(ci.product as Types.ObjectId | { _id?: Types.ObjectId }) ===
        productId,
    );

    if (!item && quantity > 0) {
      const price = Number((product as { price?: number }).price ?? 0);
      const [created] = await this.cartItemModel.create([
        {
          cart: new Types.ObjectId(cartId),
          product: new Types.ObjectId(productId),
          quantity: 0,
          unitPrice: price,
          lineTotal: 0,
        },
      ]);
      item = (created.toObject
        ? created.toObject()
        : created) as unknown as Record<string, unknown>;
      items.push(item);
    }

    if (!item) {
      return this.getCartForBranch(branchId);
    }

    const itemId = toId(item as { _id?: Types.ObjectId });
    const price = Number((product as { price?: number }).price ?? 0);

    if (quantity <= 0) {
      if (itemId) await this.cartItemModel.deleteOne({ _id: itemId }).exec();
      const remaining = items.filter(
        (ci) => toId(ci as { _id?: Types.ObjectId }) !== itemId,
      );
      const totalAmount = remaining.reduce(
        (s, ci) => s + Number((ci as { lineTotal?: number }).lineTotal ?? 0),
        0,
      );
      await this.cartModel
        .updateOne({ _id: cartId }, { $set: { totalAmount } })
        .exec();
    } else {
      const lineTotal = price * quantity;
      await this.cartItemModel
        .updateOne(
          { _id: itemId },
          { $set: { quantity, unitPrice: price, lineTotal } },
        )
        .exec();
      const updatedItems = items.map((ci) =>
        toId(ci as { _id?: Types.ObjectId }) === itemId
          ? { ...ci, quantity, unitPrice: price, lineTotal }
          : ci,
      );
      const totalAmount = updatedItems.reduce(
        (s, ci) => s + Number((ci as { lineTotal?: number }).lineTotal ?? 0),
        0,
      );
      await this.cartModel
        .updateOne({ _id: cartId }, { $set: { totalAmount } })
        .exec();
    }

    return this.getCartForBranch(branchId);
  }

  async clearCart(branchId: string) {
    const cartData = await this.getOrCreateCart(branchId);
    const cart = cartData as { _id?: Types.ObjectId };
    const cartId = toId(cart);
    if (cartId) {
      await this.cartItemModel
        .deleteMany({ cart: new Types.ObjectId(cartId) })
        .exec();
      await this.cartModel
        .updateOne({ _id: cartId }, { $set: { totalAmount: 0 } })
        .exec();
    }
    return this.normalizeCart({ ...cartData, items: [] });
  }

  async clearGeneralCart() {
    const cartData = await this.getOrCreateGeneralCart();
    const cart = cartData as { _id?: Types.ObjectId };
    const cartId = toId(cart);
    if (cartId) {
      await this.cartItemModel
        .deleteMany({ cart: new Types.ObjectId(cartId) })
        .exec();
      await this.cartModel
        .updateOne({ _id: cartId }, { $set: { totalAmount: 0 } })
        .exec();
    }
    return this.normalizeGeneralCart({ ...cartData, items: [] });
  }

  normalizeCart(cartData: Record<string, unknown>) {
    const cart = cartData as {
      _id?: Types.ObjectId;
      branch?: Record<string, unknown> | null;
      totalAmount?: number;
    };
    const items = (cartData.items ?? []) as Array<Record<string, unknown>>;
    return {
      id: toId(cart),
      branch: cart.branch
        ? {
            id: toId(cart.branch as { _id?: Types.ObjectId }),
            name: (cart.branch as { name?: string })?.name,
          }
        : null,
      totalAmount: Number(cart.totalAmount ?? 0),
      items: items.map((item) => {
        const prod = item.product as Record<string, unknown>;
        return {
          id: toId(item as { _id?: Types.ObjectId }),
          product: {
            id: toRefId(prod as Types.ObjectId | { _id?: Types.ObjectId }),
            code: prod?.code,
            name: prod?.name,
            price: Number(prod?.price ?? 0),
            imageUrl: prod?.imageUrl,
          },
          quantity: (item as { quantity?: number }).quantity ?? 0,
          unitPrice: Number((item as { unitPrice?: number }).unitPrice ?? 0),
          lineTotal: Number((item as { lineTotal?: number }).lineTotal ?? 0),
        };
      }),
    };
  }
}
