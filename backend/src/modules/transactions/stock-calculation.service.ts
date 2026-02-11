import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { TransactionStatus } from '../../common/constants/transaction-status.enum';

@Injectable()
export class StockCalculationService {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async calculateStockForAllProducts(): Promise<void> {
    const session = await this.connection.startSession();
    try {
      await session.withTransaction(async () => {
        const pendingTransactions = await this.transactionModel
          .find({ status: TransactionStatus.PENDING })
          .populate('product')
          .populate('branch')
          .sort({ createdAt: 1 })
          .session(session)
          .exec();

        const allInventories = await this.inventoryModel
          .find()
          .populate('branch')
          .populate('product')
          .session(session)
          .exec();

        const inventoryMap = new Map<
          string,
          {
            doc: InventoryDocument | null;
            inventory: {
              product: { _id: { toString: () => string } };
              branch?: { _id: { toString: () => string } };
            };
          }
        >();
        for (const inv of allInventories) {
          const branchId =
            (
              inv as { branch?: { _id?: { toString: () => string } } }
            ).branch?._id?.toString?.() || 'null';
          const productId = (
            inv as { product: { _id: { toString: () => string } } }
          ).product?._id?.toString?.();
          if (productId)
            inventoryMap.set(`${branchId}-${productId}`, {
              doc: inv,
              inventory: inv as {
                product: { _id: { toString: () => string } };
                branch?: { _id: { toString: () => string } };
              },
            });
        }

        for (const tx of pendingTransactions) {
          const txBranchId =
            (
              tx as { branch?: { _id?: { toString: () => string } } }
            ).branch?._id?.toString?.() || 'null';
          const txProductId = (
            tx as { product: { _id: { toString: () => string } } }
          ).product?._id?.toString?.();
          if (!txProductId) continue;
          const key = `${txBranchId}-${txProductId}`;
          if (!inventoryMap.has(key)) {
            let inv = await this.inventoryModel
              .findOne(
                txBranchId === 'null'
                  ? { branch: null, product: txProductId }
                  : { branch: txBranchId, product: txProductId },
              )
              .session(session)
              .exec();
            if (!inv) {
              const [created] = await this.inventoryModel.create(
                [
                  {
                    branch: txBranchId === 'null' ? null : txBranchId,
                    product: txProductId,
                    availableQty: 0,
                    calculatedQty: 0,
                    inTransitQty: 0,
                    reservedQty: 0,
                  },
                ],
                { session },
              );
              inv = created;
            }
            inventoryMap.set(key, {
              doc: inv,
              inventory: inv as {
                product: { _id: { toString: () => string } };
                branch?: { _id: { toString: () => string } };
              },
            });
          }
        }

        for (const [key, { doc: inventory }] of inventoryMap.entries()) {
          let calculatedQty =
            (inventory as { availableQty?: number }).availableQty ?? 0;
          for (const tx of pendingTransactions) {
            const txBranchId =
              (
                tx as { branch?: { _id?: { toString: () => string } } }
              ).branch?._id?.toString?.() || 'null';
            const txProductId = (
              tx as { product: { _id: { toString: () => string } } }
            ).product?._id?.toString?.();
            if (`${txBranchId}-${txProductId}` === key)
              calculatedQty += (tx as { quantity: number }).quantity;
          }
          calculatedQty = Math.max(0, calculatedQty);
          await this.inventoryModel
            .updateOne(
              { _id: (inventory as { _id: unknown })._id },
              { $set: { calculatedQty } },
              { session },
            )
            .exec();
        }
      });
    } finally {
      await session.endSession();
    }
  }

  async createTransactionFromOrder(order: {
    _id: { toString: () => string };
    items?: Array<{ product: { _id: unknown }; quantity: number }>;
  }): Promise<void> {
    if (!order.items || order.items.length === 0) return;
    const transactions = order.items.map((item) => ({
      product: (item.product as { _id: unknown })._id,
      branch: null,
      order: order._id,
      type: 'order' as const,
      quantity: -item.quantity,
      status: TransactionStatus.PENDING,
      notes: `Sifariş #${order._id.toString()}`,
    }));
    await this.transactionModel.insertMany(transactions);
    await this.calculateStockForAllProducts();
  }

  async publishStockUpdate(): Promise<{ published: number; updated: number }> {
    const session = await this.connection.startSession();
    try {
      return await session.withTransaction(async () => {
        const pending = await this.transactionModel
          .find({ status: TransactionStatus.PENDING })
          .populate('product')
          .populate('branch')
          .session(session)
          .exec();
        if (pending.length === 0) return { published: 0, updated: 0 };
        await this.transactionModel
          .updateMany(
            { status: TransactionStatus.PENDING },
            { $set: { status: TransactionStatus.PUBLISHED } },
          )
          .session(session)
          .exec();
        const invMap = new Map<
          string,
          { availableQty: number; calculatedQty: number }
        >();
        for (const tx of pending) {
          const branchId =
            (
              tx as { branch?: { _id?: { toString: () => string } } }
            ).branch?._id?.toString?.() || 'null';
          const productId = (
            tx as { product: { _id: { toString: () => string } } }
          ).product?._id?.toString?.();
          if (!productId) continue;
          const key = `${branchId}-${productId}`;
          if (!invMap.has(key)) {
            const inv = await this.inventoryModel
              .findOne(
                branchId === 'null'
                  ? { branch: null, product: productId }
                  : { branch: branchId, product: productId },
              )
              .session(session)
              .exec();
            invMap.set(key, {
              availableQty:
                (inv as { availableQty?: number })?.availableQty ?? 0,
              calculatedQty:
                (inv as { calculatedQty?: number })?.calculatedQty ?? 0,
            });
          }
          const v = invMap.get(key)!;
          v.availableQty = Math.max(
            0,
            v.availableQty + (tx as { quantity: number }).quantity,
          );
          v.calculatedQty = Math.max(
            0,
            v.calculatedQty + (tx as { quantity: number }).quantity,
          );
        }
        let updated = 0;
        for (const [key, v] of invMap.entries()) {
          const [branchId, productId] = key.split('-');
          const filter =
            branchId === 'null'
              ? { branch: null, product: productId }
              : { branch: branchId, product: productId };
          await this.inventoryModel
            .updateOne(filter, {
              $set: {
                availableQty: v.availableQty,
                calculatedQty: v.calculatedQty,
                lastPublishedAt: new Date(),
              },
            })
            .session(session)
            .exec();
          updated++;
        }
        return { published: pending.length, updated };
      });
    } finally {
      await session.endSession();
    }
  }

  async getCalculatedStock(branchId?: string) {
    await this.calculateStockForAllProducts();
    const filter = branchId ? { branch: branchId } : { branch: null };
    return this.inventoryModel
      .find(filter)
      .populate('product')
      .populate('branch')
      .lean()
      .exec();
  }

  async getPublishedStock(branchId?: string) {
    const filter = branchId ? { branch: branchId } : { branch: null };
    return this.inventoryModel
      .find(filter)
      .populate('product')
      .populate('branch')
      .lean()
      .exec();
  }
}
