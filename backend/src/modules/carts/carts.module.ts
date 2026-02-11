import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartsService } from './carts.service';
import { CartsController } from './carts.controller';
import { BranchCart, BranchCartSchema } from './schemas/branch-cart.schema';
import { CartItem, CartItemSchema } from './schemas/cart-item.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';
import { Product, ProductSchema } from '../products/schemas/product.schema';
import {
  Inventory,
  InventorySchema,
} from '../inventory/schemas/inventory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BranchCart.name, schema: BranchCartSchema },
      { name: CartItem.name, schema: CartItemSchema },
      { name: Branch.name, schema: BranchSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Inventory.name, schema: InventorySchema },
    ]),
  ],
  providers: [CartsService],
  controllers: [CartsController],
  exports: [CartsService],
})
export class CartsModule {}
