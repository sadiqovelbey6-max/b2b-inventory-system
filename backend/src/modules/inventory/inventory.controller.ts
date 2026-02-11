import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InventoryService, BulkSalesResult } from './inventory.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/schemas/user.schema';

function getTenantId(user?: User): string | undefined {
  if (!user?.tenant) return undefined;
  const t = user.tenant as unknown;
  if (
    typeof t === 'object' &&
    t !== null &&
    'id' in t &&
    typeof (t as { id?: string }).id === 'string'
  ) {
    return (t as { id: string }).id;
  }
  if (typeof (t as { toString?: () => string })?.toString === 'function') {
    return (t as { toString: () => string }).toString();
  }
  return undefined;
}

class UpdateInventoryDto {
  @IsString()
  branchId: string;

  @IsString()
  productId: string;

  @IsInt()
  @Min(0)
  availableQty: number;

  @IsInt()
  @Min(0)
  inTransitQty: number;

  @IsInt()
  @Min(0)
  reservedQty: number;
}

class BulkSalesDto {
  @IsString()
  text: string;

  @IsString()
  branchId: string;
}

@ApiTags('inventory')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  list() {
    return this.inventoryService.listAll();
  }

  @Patch()
  @Roles(UserRole.SUPER_ADMIN)
  update(@Body() body: UpdateInventoryDto) {
    return this.inventoryService.updateInventory(body);
  }

  @Post('bulk-sales')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Toplu satış (məhsul sayını azaltma)',
    description:
      'Metn formatında fiziki satışları qeyd edir və məhsul sayını azaldır. Format: KOD SAYI (hər sətir bir məhsul)',
  })
  bulkSales(
    @Body() body: BulkSalesDto,
    @CurrentUser() user?: User,
  ): Promise<BulkSalesResult> {
    const tenantId = getTenantId(user);
    return this.inventoryService.bulkSales(body.text, body.branchId, tenantId);
  }
}
