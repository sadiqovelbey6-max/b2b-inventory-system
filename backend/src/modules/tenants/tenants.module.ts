import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { Tenant, TenantSchema } from './schemas/tenant.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { TenantInterceptor } from './interceptors/tenant.interceptor';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tenant.name, schema: TenantSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [TenantsController],
  providers: [TenantsService, TenantInterceptor, TenantGuard],
  exports: [TenantsService, TenantInterceptor, TenantGuard],
})
export class TenantsModule {}
