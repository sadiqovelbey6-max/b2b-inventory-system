import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';

interface UpdateInventoryInput {
  branchId: string;
  productId: string;
  availableQty: number;
  inTransitQty: number;
  reservedQty: number;
}

interface BulkSalesInput {
  code: string;
  quantity: number;
}

export interface BulkSalesResult {
  processed: number;
  updated: number;
  errors: string[];
}

function toResp(
  doc: {
    _id: { toString: () => string };
    toObject?: () => Record<string, unknown>;
  } | null,
) {
  if (!doc) return null;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return { ...o, id: doc._id.toString() };
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async ensureInventory(
    branchId: string,
    productId: string,
    quantities?: Partial<Inventory>,
  ) {
    const [branch, product] = await Promise.all([
      this.branchModel.findById(branchId).exec(),
      this.productModel.findById(productId).exec(),
    ]);
    if (!branch || !product)
      throw new BadRequestException('Filial və ya məhsul mövcud deyil');

    let inventory = await this.inventoryModel
      .findOne({ branch: branchId, product: productId })
      .populate('branch')
      .populate('product')
      .exec();

    if (!inventory) {
      inventory = await this.inventoryModel.create({
        branch: branchId,
        product: productId,
        availableQty: quantities?.availableQty ?? 0,
        inTransitQty: quantities?.inTransitQty ?? 0,
        reservedQty: quantities?.reservedQty ?? 0,
      });
    } else if (quantities) {
      if (quantities.availableQty !== undefined)
        inventory.availableQty = quantities.availableQty;
      if (quantities.inTransitQty !== undefined)
        inventory.inTransitQty = quantities.inTransitQty;
      if (quantities.reservedQty !== undefined)
        inventory.reservedQty = quantities.reservedQty;
      await inventory.save();
    }
    return toResp(inventory);
  }

  async updateInventory(payload: UpdateInventoryInput) {
    const inventory = await this.inventoryModel
      .findOne({ branch: payload.branchId, product: payload.productId })
      .exec();
    if (!inventory) throw new BadRequestException('Inventar tapılmadı');
    inventory.availableQty = payload.availableQty;
    inventory.inTransitQty = payload.inTransitQty;
    inventory.reservedQty = payload.reservedQty;
    await inventory.save();
    return toResp(inventory);
  }

  listAll() {
    return this.inventoryModel
      .find()
      .populate('branch')
      .populate('product')
      .lean()
      .exec()
      .then((docs) =>
        docs.map((d: Record<string, unknown>) => ({
          ...d,
          id: (d._id as { toString?: () => string })?.toString?.(),
        })),
      );
  }

  async bulkSales(
    text: string,
    branchId: string,
    tenantId?: string,
  ): Promise<BulkSalesResult> {
    const branch = await this.branchModel
      .findById(branchId)
      .populate('tenant')
      .exec();
    if (!branch) throw new BadRequestException('Filial tapılmadı');

    if (
      tenantId &&
      (branch as { tenant?: { _id?: { toString: () => string } } }).tenant
    ) {
      const tid = (
        branch as { tenant: { _id: { toString: () => string } } }
      ).tenant?._id?.toString?.();
      if (tid !== tenantId)
        throw new BadRequestException('Filial bu müştəriyə aid deyil');
    }

    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const result = {
      processed: lines.length,
      updated: 0,
      errors: [] as string[],
    };
    const sales: BulkSalesInput[] = [];

    for (let i = 0; i < lines.length; i++) {
      const parsed = this.parseSalesLine(lines[i]);
      if (parsed.error) result.errors.push(`Sətir ${i + 2}: ${parsed.error}`);
      else if (parsed.sale) sales.push(parsed.sale);
    }

    for (const sale of sales) {
      try {
        const code = sale.code.trim().toUpperCase();
        const product = await this.productModel
          .findOne(tenantId ? { code, tenant: tenantId } : { code })
          .exec();
        if (!product) {
          result.errors.push(`Məhsul "${sale.code}": Tapılmadı`);
          continue;
        }
        const inventory = await this.inventoryModel
          .findOne({ branch: branchId, product: product._id })
          .exec();
        if (!inventory) {
          result.errors.push(
            `Məhsul "${sale.code}": Bu filialda inventar yoxdur`,
          );
          continue;
        }
        const newQty = inventory.availableQty - sale.quantity;
        if (newQty < 0) {
          result.errors.push(
            `Məhsul "${sale.code}": Mövcud say (${inventory.availableQty}) satılan saydan (${sale.quantity}) azdır`,
          );
          continue;
        }
        inventory.availableQty = newQty;
        await inventory.save();
        result.updated++;
      } catch (e) {
        result.errors.push(`Məhsul "${sale.code}": ${(e as Error).message}`);
      }
    }
    return result;
  }

  private parseSalesLine(line: string): {
    sale?: BulkSalesInput;
    error?: string;
  } {
    const t = line.trim();
    if (!t) return { error: 'Boş sətir' };
    const parts = t.split(/\s+/);
    if (parts.length < 2) return { error: 'Format: KOD SAYI' };
    const code = parts[0].trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code)) return { error: 'Kod etibarsızdır' };
    const qty = parseInt(parts[1], 10);
    if (isNaN(qty) || qty <= 0)
      return { error: 'Say müsbət tam ədəd olmalıdır' };
    return { sale: { code, quantity: qty } };
  }
}
