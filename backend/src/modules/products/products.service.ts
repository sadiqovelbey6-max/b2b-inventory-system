import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import {
  ProductSubstitute,
  ProductSubstituteDocument,
} from './schemas/product-substitute.schema';
import {
  Inventory,
  InventoryDocument,
} from '../inventory/schemas/inventory.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { CartItem, CartItemDocument } from '../carts/schemas/cart-item.schema';
import {
  OrderItem,
  OrderItemDocument,
} from '../orders/schemas/order-item.schema';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';
import {
  ManualAdjustment,
  ManualAdjustmentDocument,
} from '../transactions/schemas/manual-adjustment.schema';
import { StockCalculationService } from '../transactions/stock-calculation.service';

interface BulkProductInput {
  code: string;
  name: string;
  price?: number;
  category?: string;
  unit?: string;
}

export interface BulkImportResult {
  processed: number;
  created: number;
  errors: string[];
}

function toId(d: { _id?: { toString: () => string } } | null) {
  return d?._id?.toString?.();
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(ProductSubstitute.name)
    private readonly substituteModel: Model<ProductSubstituteDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    @InjectModel(CartItem.name)
    private readonly cartItemModel: Model<CartItemDocument>,
    @InjectModel(OrderItem.name)
    private readonly orderItemModel: Model<OrderItemDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(ManualAdjustment.name)
    private readonly adjustmentModel: Model<ManualAdjustmentDocument>,
    @Inject(forwardRef(() => StockCalculationService))
    private readonly stockCalculationService: StockCalculationService,
  ) {}

  async getCategories(): Promise<string[]> {
    return [
      'Yağ və mayelər',
      'Filterlər',
      'Asqı sistemi',
      'Kuzov malları',
      'Elektron malları',
      'Mühərrik+Qutu',
    ];
  }

  async listProducts(branchId?: string, tenantId?: string) {
    await this.stockCalculationService.calculateStockForAllProducts();
    const filter = tenantId ? { tenant: tenantId } : {};
    const products = await this.productModel
      .find(filter)
      .populate('branch')
      .populate('tenant')
      .sort({ code: 1 })
      .lean()
      .exec();

    const inventories = await this.inventoryModel
      .find()
      .populate('branch')
      .populate('product')
      .lean()
      .exec();

    return products.map((p: Record<string, unknown>) => {
      const productId = (p._id as { toString: () => string })?.toString?.();
      const pidMatch = (p: unknown) =>
        (
          p as { toString?: () => string; _id?: { toString: () => string } }
        )?.toString?.() === productId ||
        (p as { _id?: { toString: () => string } })?._id?.toString?.() ===
          productId;
      const invs = inventories.filter((i: Record<string, unknown>) =>
        pidMatch(i.product),
      );
      const inventoryByBranch: Record<string, Record<string, unknown>> = {};
      let generalInventory: Record<string, unknown> | null = null;
      for (const inv of invs) {
        const br = inv.branch as {
          _id?: { toString: () => string };
          name?: string;
        } | null;
        if (br?._id)
          inventoryByBranch[(br._id as { toString: () => string }).toString()] =
            inv as Record<string, unknown>;
        else generalInventory = inv as Record<string, unknown>;
      }
      const branchInv = branchId ? inventoryByBranch[branchId] : null;
      const displayInv = branchInv || generalInventory;
      return {
        id: productId,
        code: p.code,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        category: p.category,
        barcode: p.barcode,
        unit: p.unit,
        price: Number(p.price ?? 0),
        purchasePrice: Number(
          (p as { purchasePrice?: number }).purchasePrice ?? 0,
        ),
        branch: (p.branch as { _id?: unknown; name?: string; code?: string })
          ? {
              id: toId(p.branch as { _id?: { toString: () => string } }),
              name: (p.branch as { name?: string })?.name,
              code: (p.branch as { code?: string })?.code,
            }
          : null,
        inventory: {
          byBranch: Object.entries(inventoryByBranch).map(([bk, inv]) => ({
            branchId: bk,
            branchName: (inv.branch as { name?: string })?.name || 'Ümumi',
            availableQty: inv.availableQty ?? 0,
            calculatedQty: inv.calculatedQty ?? inv.availableQty ?? 0,
            inTransitQty: inv.inTransitQty ?? 0,
            reservedQty: inv.reservedQty ?? 0,
          })),
          currentBranch: displayInv
            ? {
                branchId: displayInv.branch
                  ? toId(
                      displayInv.branch as { _id?: { toString: () => string } },
                    )
                  : null,
                branchName:
                  (displayInv.branch as { name?: string })?.name || 'Ümumi',
                availableQty: displayInv.availableQty ?? 0,
                calculatedQty:
                  displayInv.calculatedQty ?? displayInv.availableQty ?? 0,
                inTransitQty: displayInv.inTransitQty ?? 0,
                reservedQty: displayInv.reservedQty ?? 0,
              }
            : null,
        },
      };
    });
  }

  async lookupCode(code: string, branchId?: string, tenantId?: string) {
    const normalizedCode = code.trim().toUpperCase();
    const filter: Record<string, unknown> = { code: normalizedCode };
    if (tenantId) filter.tenant = tenantId;
    const products = await this.productModel
      .find(filter)
      .populate('tenant')
      .lean()
      .exec();
    if (products.length === 0) return [];

    const inventories = await this.inventoryModel
      .find()
      .populate('branch')
      .lean()
      .exec();

    const result = products.map((p: Record<string, unknown>) => {
      const productId = (p._id as { toString: () => string })?.toString?.();
      const invs = inventories.filter(
        (i: Record<string, unknown>) =>
          (
            i.product as { _id?: { toString: () => string } }
          )?._id?.toString?.() === productId,
      );
      let displayInv: Record<string, unknown> | null = null;
      if (branchId)
        displayInv =
          (invs.find(
            (i: Record<string, unknown>) =>
              (
                i.branch as { _id?: { toString: () => string } }
              )?._id?.toString?.() === branchId,
          ) as Record<string, unknown>) ?? null;
      if (!displayInv)
        displayInv =
          (invs.find((i: Record<string, unknown>) => !i.branch) as Record<
            string,
            unknown
          >) ?? null;
      return {
        id: productId,
        code: p.code,
        name: p.name,
        description: p.description,
        imageUrl: p.imageUrl,
        category: p.category,
        barcode: p.barcode,
        unit: p.unit,
        price: Number(p.price ?? 0),
        purchasePrice: Number(
          (p as { purchasePrice?: number }).purchasePrice ?? 0,
        ),
        inventory: {
          availableQty: displayInv?.availableQty ?? 0,
          inTransitQty: displayInv?.inTransitQty ?? 0,
          reservedQty: displayInv?.reservedQty ?? 0,
        },
      };
    });

    const withSubs: Array<Record<string, unknown>> = [];
    for (const prod of result) {
      const subs = await this.getSubstitutes(prod.id, branchId, tenantId);
      const availQty = Number(
        (prod.inventory as { currentBranch?: { availableQty?: number } })
          ?.currentBranch?.availableQty ?? 0,
      );
      const filteredSubs = subs.filter(
        (s): s is NonNullable<typeof s> => s != null,
      );
      if (availQty === 0) {
        withSubs.push(...filteredSubs);
        withSubs.push(prod);
      } else {
        withSubs.push(prod);
        withSubs.push(...filteredSubs);
      }
    }
    return withSubs;
  }

  async getSubstitutes(
    productId: string,
    branchId?: string,
    tenantId?: string,
  ) {
    const subs = await this.substituteModel
      .find({ product: productId })
      .populate({ path: 'substitute', populate: [{ path: 'tenant' }] })
      .lean()
      .exec();

    const allInvs = await this.inventoryModel
      .find()
      .populate('branch')
      .lean()
      .exec();

    return subs
      .map((sub: Record<string, unknown>) => {
        const sp = sub.substitute as Record<string, unknown>;
        if (tenantId && sp?.tenant) {
          const tid = (
            sp.tenant as { _id?: { toString: () => string } }
          )?._id?.toString?.();
          if (tid !== tenantId) return null;
        }
        const productIdStr = (
          sp._id as { toString?: () => string }
        )?.toString?.();
        const pidMatch = (p: unknown) =>
          (p as { toString?: () => string })?.toString?.() === productIdStr;
        let displayInv: Record<string, unknown> | null = null;
        if (branchId) {
          displayInv =
            (allInvs.find(
              (i: Record<string, unknown>) =>
                pidMatch(i.product) &&
                (
                  i.branch as { _id?: { toString: () => string } }
                )?._id?.toString?.() === branchId,
            ) as Record<string, unknown>) ?? null;
        }
        if (!displayInv) {
          displayInv =
            (allInvs.find(
              (i: Record<string, unknown>) => pidMatch(i.product) && !i.branch,
            ) as Record<string, unknown>) ?? null;
        }
        return {
          id: productIdStr,
          code: sp.code,
          name: sp.name,
          description: sp.description,
          imageUrl: sp.imageUrl,
          category: sp.category,
          barcode: sp.barcode,
          unit: sp.unit,
          price: Number(sp.price ?? 0),
          purchasePrice: Number(
            (sp as { purchasePrice?: number }).purchasePrice ?? 0,
          ),
          inventory: {
            availableQty: displayInv?.availableQty ?? 0,
            inTransitQty: displayInv?.inTransitQty ?? 0,
            reservedQty: displayInv?.reservedQty ?? 0,
          },
          isSubstitute: true,
        };
      })
      .filter(Boolean);
  }

  async addSubstitute(
    productId: string,
    substituteId: string,
    tenantId?: string,
  ) {
    if (productId === substituteId)
      throw new BadRequestException('Məhsul özünü əvəz edə bilməz');
    const [product, substitute] = await Promise.all([
      this.productModel.findById(productId).populate('tenant').exec(),
      this.productModel.findById(substituteId).populate('tenant').exec(),
    ]);
    if (!product || !substitute)
      throw new NotFoundException('Məhsul tapılmadı');
    if (tenantId) {
      const pt = (
        product as { tenant?: { _id?: { toString: () => string } } }
      ).tenant?._id?.toString?.();
      const st = (
        substitute as { tenant?: { _id?: { toString: () => string } } }
      ).tenant?._id?.toString?.();
      if (pt !== tenantId || st !== tenantId)
        throw new BadRequestException('Məhsul bu tenant-a aid deyil');
    }
    const exists = await this.substituteModel
      .findOne({
        $or: [
          { product: productId, substitute: substituteId },
          { product: substituteId, substitute: productId },
        ],
      })
      .exec();
    if (exists)
      throw new BadRequestException('Bu əvəz edici artıq əlavə edilib');
    await this.substituteModel.create([
      { product: productId, substitute: substituteId },
      { product: substituteId, substitute: productId },
    ]);
    return { success: true };
  }

  async removeSubstitute(productId: string, substituteId: string) {
    const deleted = await this.substituteModel
      .deleteMany({
        $or: [
          { product: productId, substitute: substituteId },
          { product: substituteId, substitute: productId },
        ],
      })
      .exec();
    if (deleted.deletedCount === 0)
      throw new NotFoundException('Əvəz edici tapılmadı');
    return { success: true };
  }

  async bulkAddSubstitutes(codes: string[], tenantId?: string) {
    if (!codes || codes.length < 2)
      throw new BadRequestException('Ən azı 2 kod tələb olunur');
    const normalized = [
      ...new Set(codes.map((c) => c.trim().toUpperCase()).filter(Boolean)),
    ];
    const products = await this.productModel
      .find(
        tenantId
          ? { code: { $in: normalized }, tenant: tenantId }
          : { code: { $in: normalized } },
      )
      .exec();
    if (products.length === 0)
      throw new NotFoundException('Heç bir məhsul tapılmadı');
    const foundCodes = new Set(products.map((p) => p.code.toUpperCase()));
    const missing = normalized.filter((c) => !foundCodes.has(c));
    if (missing.length > 0)
      throw new NotFoundException(
        `Aşağıdakı kodlar tapılmadı: ${missing.join(', ')}`,
      );

    let added = 0;
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const [p1, p2] = [products[i], products[j]];
        const exists = await this.substituteModel
          .findOne({ product: p1._id, substitute: p2._id })
          .exec();
        if (!exists) {
          await this.substituteModel.create([
            { product: p1._id, substitute: p2._id },
            { product: p2._id, substitute: p1._id },
          ]);
          added += 2;
        }
      }
    }
    return {
      success: true,
      processed: normalized.length,
      added,
      transitive: 0,
    };
  }

  async updateProduct(
    productId: string,
    data: {
      price?: number;
      purchasePrice?: number;
      category?: string;
      branchId?: string | null;
      branchName?: string | null;
    },
    tenantId?: string,
  ): Promise<Record<string, unknown> | null> {
    const product = await this.productModel
      .findById(productId)
      .populate('tenant')
      .populate('branch')
      .exec();
    if (!product) throw new NotFoundException('Məhsul tapılmadı');
    if (
      tenantId &&
      (
        product as { tenant?: { _id?: { toString: () => string } } }
      ).tenant?._id?.toString?.() !== tenantId
    ) {
      throw new BadRequestException('Məhsul bu tenant-a aid deyil');
    }
    const update: Record<string, unknown> = {};
    if (data.price !== undefined) update.price = data.price;
    if (data.purchasePrice !== undefined)
      update.purchasePrice = data.purchasePrice;
    if (data.category !== undefined) update.category = data.category;
    if (data.branchId !== undefined) update.branch = data.branchId;
    if (data.branchName !== undefined) {
      if (!data.branchName?.trim()) update.branch = null;
      else {
        const branch = await this.branchModel
          .findOne({
            $or: [{ name: new RegExp(`^${data.branchName.trim()}$`, 'i') }],
            ...(tenantId ? { tenant: tenantId } : {}),
          })
          .exec();
        if (branch) update.branch = branch._id;
        else {
          const newBranch = await this.branchModel.create({
            code: data.branchName
              .trim()
              .substring(0, 3)
              .toUpperCase()
              .padEnd(3, 'X'),
            name: data.branchName.trim(),
            ...(tenantId ? { tenant: tenantId } : {}),
          });
          update.branch = newBranch._id;
        }
      }
    }
    await this.productModel
      .findByIdAndUpdate(productId, { $set: update })
      .exec();
    return this.productModel
      .findById(productId)
      .populate('branch')
      .populate('tenant')
      .lean()
      .exec()
      .then((d) =>
        d
          ? {
              ...d,
              id: (d as { _id: { toString: () => string } })._id.toString(),
            }
          : null,
      );
  }

  async updateProductsCategory(
    productIds: string[],
    category: string,
    tenantId?: string,
  ) {
    const filter = tenantId
      ? { _id: { $in: productIds }, tenant: tenantId }
      : { _id: { $in: productIds } };
    const result = await this.productModel
      .updateMany(filter, { $set: { category } })
      .exec();
    if (result.matchedCount === 0)
      throw new BadRequestException('Məhsullar bu tenant-a aid deyil');
    return this.productModel.find(filter).lean().exec();
  }

  async getSubstitutesForProduct(productId: string, tenantId?: string) {
    const product = await this.productModel
      .findById(productId)
      .populate('tenant')
      .exec();
    if (!product) throw new NotFoundException('Məhsul tapılmadı');
    if (
      tenantId &&
      (
        product as { tenant?: { _id?: { toString: () => string } } }
      ).tenant?._id?.toString?.() !== tenantId
    ) {
      throw new BadRequestException('Məhsul bu tenant-a aid deyil');
    }
    const subs = await this.substituteModel
      .find({ product: productId })
      .populate('substitute')
      .lean()
      .exec();
    const result: Array<Record<string, unknown>> = [];
    for (const s of subs) {
      const sp = (s.substitute ?? s) as unknown as Record<string, unknown>;
      const subId = (sp._id as { toString?: () => string })?.toString?.();
      const inv = await this.inventoryModel
        .findOne({ product: subId, branch: null })
        .lean()
        .exec();
      result.push({
        id: subId,
        code: sp.code,
        name: sp.name,
        price: Number(sp.price ?? 0),
        purchasePrice: Number(
          (sp as { purchasePrice?: number }).purchasePrice ?? 0,
        ),
        inventory: {
          availableQty: inv?.availableQty ?? 0,
          inTransitQty: inv?.inTransitQty ?? 0,
          reservedQty: inv?.reservedQty ?? 0,
        },
        createdAt: (s as { createdAt?: Date }).createdAt,
      });
    }
    return result;
  }

  async ensureProductSeed(data: Partial<Product>, tenantId?: string) {
    const code = (data.code ?? '').trim().toUpperCase();
    let product = await this.productModel.findOne({ code }).exec();
    if (!product) {
      product = await this.productModel.create({
        ...data,
        code,
        tenant: tenantId ?? null,
      });
    } else {
      if (data.name !== undefined) product.name = data.name;
      if (data.category !== undefined) product.category = data.category;
      await product.save();
    }
    return { ...product.toObject(), id: product._id.toString() };
  }

  async bulkImportProducts(
    text: string,
    tenantId?: string,
  ): Promise<BulkImportResult> {
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const result: BulkImportResult = {
      processed: lines.length,
      created: 0,
      errors: [],
    };

    const validCategories = [
      'Yağ və mayelər',
      'Filterlər',
      'Asqı sistemi',
      'Kuzov malları',
      'Elektron malları',
      'Mühərrik+Qutu',
    ];

    for (let i = 0; i < lines.length; i++) {
      const parsed = this.parseProductLine(lines[i]);
      if (parsed.error) {
        result.errors.push(`Sətir ${i + 2}: ${parsed.error}`);
        continue;
      }
      if (!parsed.product) continue;
      try {
        const code = parsed.product.code.trim().toUpperCase();
        const existing = await this.productModel.findOne({ code }).exec();
        if (existing) {
          if (parsed.product.category) {
            existing.category = parsed.product.category;
            await existing.save();
          }
          result.created++;
        } else {
          const prod = await this.productModel.create({
            code,
            name: parsed.product.name,
            price: parsed.product.price ?? 0,
            category: parsed.product.category,
            unit: parsed.product.unit,
            tenant: tenantId ?? null,
          });
          await this.inventoryModel.create({
            branch: null,
            product: prod._id,
            availableQty: 0,
            calculatedQty: 0,
            inTransitQty: 0,
            reservedQty: 0,
          });
          result.created++;
        }
      } catch (e) {
        result.errors.push(
          `Məhsul "${parsed.product?.code}": ${(e as Error).message}`,
        );
      }
    }
    return result;
  }

  private parseProductLine(line: string): {
    product?: BulkProductInput;
    error?: string;
  } {
    const t = line.trim();
    if (!t) return { error: 'Boş sətir' };
    const parts = t.split(/\s+/);
    if (parts.length < 2)
      return { error: 'Format: KOD AD [QIYMƏT] [KATEQORİYA] [VAHİD]' };
    const code = parts[0].trim().toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code)) return { error: 'Kod etibarsızdır' };
    let price: number | undefined;
    let priceIdx = -1;
    for (let i = 1; i < parts.length; i++) {
      const n = parseFloat(parts[i].replace(',', '.'));
      if (!isNaN(n) && n >= 0) {
        price = n;
        priceIdx = i;
        break;
      }
    }
    const validCategories = [
      'Yağ və mayelər',
      'Filterlər',
      'Asqı sistemi',
      'Kuzov malları',
      'Elektron malları',
      'Mühərrik+Qutu',
    ];
    let name = '';
    let category: string | undefined;
    let unit: string | undefined;
    if (priceIdx > 0) {
      name = parts.slice(1, priceIdx).join(' ');
      const after = parts.slice(priceIdx + 1);
      for (const vc of validCategories) {
        if (after.join(' ').includes(vc)) {
          category = vc;
          break;
        }
      }
      if (!category && after.length > 0) category = after[0];
      if (after.length > 1) unit = after[after.length - 1];
    } else {
      name = parts.slice(1).join(' ');
    }
    if (!name) return { error: 'Məhsul adı tələb olunur' };
    return { product: { code, name, price, category, unit } };
  }

  async deleteProduct(productId: string, tenantId?: string) {
    const product = await this.productModel
      .findById(productId)
      .populate('tenant')
      .exec();
    if (!product) throw new NotFoundException('Məhsul tapılmadı');
    const pt = (
      product as { tenant?: { _id?: { toString: () => string } } }
    ).tenant?._id?.toString?.();
    if (pt && tenantId && pt !== tenantId)
      throw new BadRequestException('Bu məhsul bu tenant-a aid deyil');

    await Promise.all([
      this.cartItemModel.deleteMany({ product: productId }).exec(),
      this.orderItemModel.deleteMany({ product: productId }).exec(),
      this.inventoryModel.deleteMany({ product: productId }).exec(),
      this.substituteModel
        .deleteMany({
          $or: [{ product: productId }, { substitute: productId }],
        })
        .exec(),
      this.transactionModel.deleteMany({ product: productId }).exec(),
      this.adjustmentModel.deleteMany({ product: productId }).exec(),
    ]);
    await this.productModel.findByIdAndDelete(productId).exec();
    return { success: true, message: 'Məhsul uğurla silindi' };
  }

  async deleteProducts(productIds: string[], tenantId?: string) {
    if (!productIds?.length)
      throw new BadRequestException('Heç bir məhsul seçilməyib');
    const success: string[] = [];
    const failed: { id: string; error: string }[] = [];
    for (const id of productIds) {
      try {
        await this.deleteProduct(id, tenantId);
        success.push(id);
      } catch (e) {
        failed.push({ id, error: (e as Error).message });
      }
    }
    return {
      success: true,
      message: `${success.length} məhsul silindi${failed.length ? `, ${failed.length} uğursuz` : ''}`,
      deletedCount: success.length,
      failedCount: failed.length,
      results: { success, failed },
    };
  }
}
