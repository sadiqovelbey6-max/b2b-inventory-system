import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { getMongoConfig } from './config/mongodb.config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { CartsModule } from './modules/carts/carts.module';
import { OrdersModule } from './modules/orders/orders.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SeedModule } from './modules/seed/seed.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { StorageModule } from './modules/storage/storage.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TransactionsModule } from './modules/transactions/transactions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
    }),
    EventEmitterModule.forRoot(),
    MongooseModule.forRootAsync({
      useFactory: () => getMongoConfig(),
    }),
    UsersModule,
    AuthModule,
    BranchesModule,
    ProductsModule,
    InventoryModule,
    CartsModule,
    OrdersModule,
    InvoicesModule,
    PaymentsModule,
    AuditModule,
    NotificationsModule,
    SeedModule,
    ImportExportModule,
    StorageModule,
    HealthModule,
    MetricsModule,
    TenantsModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
