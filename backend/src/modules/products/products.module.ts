import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { Product, ProductSchema } from './schemas/product.schema';
import {
  ProductSubstitute,
  ProductSubstituteSchema,
} from './schemas/product-substitute.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { CartItem, CartItemSchema } from '../carts/schemas/cart-item.schema';
import {
  OrderItem,
  OrderItemSchema,
} from '../orders/schemas/order-item.schema';
import {
  Transaction,
  TransactionSchema,
} from '../transactions/schemas/transaction.schema';
import {
  ManualAdjustment,
  ManualAdjustmentSchema,
} from '../transactions/schemas/manual-adjustment.schema';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: ProductSubstitute.name, schema: ProductSubstituteSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Branch.name, schema: BranchSchema },
      { name: CartItem.name, schema: CartItemSchema },
      { name: OrderItem.name, schema: OrderItemSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: ManualAdjustment.name, schema: ManualAdjustmentSchema },
    ]),
    forwardRef(() => TransactionsModule),
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService, MongooseModule],
})
export class ProductsModule {}
