import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ManualAdjustment,
  ManualAdjustmentDocument,
} from './schemas/manual-adjustment.schema';
import { ManualAdjustmentStatus } from '../../common/constants/manual-adjustment-status.enum';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';
import { TransactionType } from '../../common/constants/transaction-type.enum';
import { TransactionStatus } from '../../common/constants/transaction-status.enum';
import { StockCalculationService } from './stock-calculation.service';

interface ParsedAdjustment {
  productCode: string;
  quantityChange: number;
}

@Injectable()
export class ManualAdjustmentsService {
  constructor(
    @InjectModel(ManualAdjustment.name)
    private readonly adjustmentModel: Model<ManualAdjustmentDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    private readonly stockCalculationService: StockCalculationService,
  ) {}

  parseAdjustmentText(text: string): ParsedAdjustment[] {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const adjustments: ParsedAdjustment[] = [];
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      let productCode: string;
      let quantityStr: string;
      if (colonIndex > 0) {
        productCode = line.substring(0, colonIndex).trim().toUpperCase();
        quantityStr = line.substring(colonIndex + 1).trim();
      } else {
        const match = line.match(/^([A-Z0-9_-]+)\s*([+-]?\d+)$/i);
        if (!match)
          throw new BadRequestException(
            `Sətir "${line}" düzgün formatda deyil. Format: "KOD +5" və ya "KOD -2"`,
          );
        productCode = match[1].toUpperCase();
        quantityStr = match[2];
      }
      const qty = this.parseQuantity(quantityStr);
      if (qty !== null && productCode)
        adjustments.push({ productCode, quantityChange: qty });
      else
        throw new BadRequestException(
          `Sətir "${line}" düzgün formatda deyil. Format: "KOD +5" və ya "KOD -2"`,
        );
    }
    return adjustments;
  }

  private parseQuantity(str: string): number | null {
    const m = str.trim().match(/^([+-]?)(\d+)$/);
    if (!m) return null;
    return (m[1] === '-' ? -1 : 1) * parseInt(m[2], 10);
  }

  async createManualAdjustments(
    text: string,
    branchId: string | null,
    userId: string,
  ): Promise<{ created: number; adjustments: unknown[]; errors: string[] }> {
    const adjustments = this.parseAdjustmentText(text);
    let branch: { _id: unknown } | null = null;
    if (branchId) {
      const found = await this.branchModel.findById(branchId).exec();
      if (!found) throw new BadRequestException('Filial tapılmadı');
      branch = found;
    }

    await this.stockCalculationService.calculateStockForAllProducts();

    const createdAdjustments: unknown[] = [];
    const errors: string[] = [];

    for (const adj of adjustments) {
      try {
        const product = await this.productModel
          .findOne({ code: adj.productCode })
          .exec();
        if (!product) {
          errors.push(`Məhsul "${adj.productCode}": Tapılmadı`);
          continue;
        }

        const invFilter = branchId
          ? { branch: branchId, product: product._id }
          : { branch: null, product: product._id };
        let inventory = await this.inventoryModel.findOne(invFilter).exec();
        if (!inventory) {
          inventory = await this.inventoryModel.create({
            branch: branchId ?? null,
            product: product._id,
            availableQty: 0,
            calculatedQty: 0,
            inTransitQty: 0,
            reservedQty: 0,
          });
        }

        const currentStock =
          (inventory as { calculatedQty?: number }).calculatedQty ??
          (inventory as { availableQty?: number }).availableQty ??
          0;
        const stockBefore = currentStock;
        const stockAfter = stockBefore + adj.quantityChange;

        if (stockAfter < 0) {
          errors.push(
            `Məhsul "${adj.productCode}": Stok mənfi ola bilməz (cari: ${stockBefore}, dəyişiklik: ${adj.quantityChange})`,
          );
          continue;
        }

        const saved = await this.adjustmentModel.create({
          product: product._id,
          branch: branchId ?? null,
          createdBy: userId,
          quantityChange: adj.quantityChange,
          stockBefore,
          stockAfter,
          status: ManualAdjustmentStatus.PENDING,
        });
        createdAdjustments.push({
          ...saved.toObject(),
          id: saved._id.toString(),
        });

        await this.transactionModel.create({
          product: product._id,
          branch: branchId ?? null,
          type: TransactionType.MANUAL_ADJUSTMENT,
          quantity: adj.quantityChange,
          status: TransactionStatus.PENDING,
          notes: `Manual adjustment #${saved._id}`,
        });
      } catch (e) {
        errors.push(`Məhsul "${adj.productCode}": ${(e as Error).message}`);
      }
    }

    if (createdAdjustments.length > 0) {
      await this.stockCalculationService.calculateStockForAllProducts();
    }

    return {
      created: createdAdjustments.length,
      adjustments: createdAdjustments,
      errors,
    };
  }

  async getPendingAdjustments(branchId?: string) {
    const filter: Record<string, unknown> = {
      status: ManualAdjustmentStatus.PENDING,
    };
    if (branchId) filter.branch = branchId;
    else filter.branch = null;

    const docs = await this.adjustmentModel
      .find(filter)
      .populate('product')
      .populate('branch')
      .populate('createdBy')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((d: Record<string, unknown>) => ({
      ...d,
      id: (d._id as { toString?: () => string })?.toString?.(),
    }));
  }
}
