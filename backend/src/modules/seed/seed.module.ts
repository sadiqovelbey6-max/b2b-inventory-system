import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { UsersModule } from '../users/users.module';
import { BranchesModule } from '../branches/branches.module';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    UsersModule,
    BranchesModule,
    ProductsModule,
    InventoryModule,
    TenantsModule,
  ],
  providers: [SeedService],
})
export class SeedModule {}
