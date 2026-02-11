import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';
import {
  ManualAdjustment,
  ManualAdjustmentSchema,
} from './schemas/manual-adjustment.schema';
import { StockCalculationService } from './stock-calculation.service';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { ManualAdjustmentsController } from './manual-adjustments.controller';
import { ManualAdjustmentsService } from './manual-adjustments.service';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: ManualAdjustment.name, schema: ManualAdjustmentSchema },
      { name: Inventory.name, schema: InventorySchema },
      { name: Product.name, schema: ProductSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
    InventoryModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [TransactionsController, ManualAdjustmentsController],
  providers: [
    StockCalculationService,
    TransactionsService,
    ManualAdjustmentsService,
  ],
  exports: [
    StockCalculationService,
    TransactionsService,
    ManualAdjustmentsService,
  ],
})
export class TransactionsModule {}
