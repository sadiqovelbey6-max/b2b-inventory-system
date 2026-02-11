import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/schemas/user.schema';
import { UserRole } from '../../common/constants/roles.enum';

class CreateOrderDto {
  @IsString()
  @IsOptional()
  branchId?: string;
}

class RejectOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

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

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Səbətdən sifariş yarat' })
  async create(@Body() body: CreateOrderDto, @CurrentUser() user: User) {
    try {
      this.logger.debug(
        `create çağırıldı: userRole=${user.role}, branchId=${body.branchId}`,
      );

      // Magazin paneli üçün ümumi cart-dan (branch: null) order yarat
      if (user.role === UserRole.USER) {
        const order = await this.ordersService.createOrderFromGeneralCart(user);
        this.logger.log(`Order yaradıldı: ${order.id}`);
        return order;
      }

      // Admin paneli üçün branch-id tələb olunur (SUPER_ADMIN və BRANCH_MANAGER)
      if (!body.branchId) {
        throw new BadRequestException('Filial seçimi tələb olunur');
      }

      this.ensureBranchAccess(body.branchId, user);
      const order = await this.ordersService.createOrderFromCart(
        body.branchId,
        user,
      );
      this.logger.log(`Order yaradıldı: ${order.id}`);
      return order;
    } catch (error) {
      this.logger.error(
        `create xətası: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Əgər error artıq NestJS exception-dırsa, onu yenidən throw et
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }

      // Digər xətalar üçün BadRequestException throw et
      throw new BadRequestException(
        `Sifariş yaradıla bilmədi: ${error instanceof Error ? error.message : 'Naməlum xəta'}`,
      );
    }
  }

  @Get('pending-approval')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Təsdiq gözləyən sifarişlər (admin və magazin panelləri üçün)',
  })
  getPendingApproval(
    @Query('branchId') branchId?: string,
    @CurrentUser() user?: User,
  ) {
    // Magazin paneli (USER) üçün branch: null order-ləri də göstər
    if (user?.role === UserRole.USER) {
      return this.ordersService.getPendingApprovalOrders();
    }

    // Admin paneli (SUPER_ADMIN və BRANCH_MANAGER) üçün user-in branch-id-ni istifadə et
    // SUPER_ADMIN üçün branchId yoxdursa, bütün sifarişləri göstər
    const resolvedBranchId = branchId || this.getUserBranchId(user);
    if (!resolvedBranchId && user?.role === UserRole.SUPER_ADMIN) {
      return this.ordersService.getPendingApprovalOrders();
    }
    return this.ordersService.getPendingApprovalOrders(resolvedBranchId);
  }

  @Post(':id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Sifarişi təsdiqlə (admin və magazin panelləri)' })
  async approve(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.ordersService.getOrderById(id);
    const userBranchId = this.getUserBranchId(user);
    if (
      user.role === UserRole.USER &&
      order.branch &&
      order.branch.id !== userBranchId
    ) {
      throw new ForbiddenException(
        'Bu sifarişi təsdiqləmək üçün icazəniz yoxdur',
      );
    }
    // SUPER_ADMIN və BRANCH_MANAGER bütün sifarişləri təsdiqləyə bilər
    return this.ordersService.approveOrder(id, user);
  }

  @Post(':id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.USER)
  @ApiOperation({ summary: 'Sifarişi rədd et (admin və magazin panelləri)' })
  async reject(
    @Param('id') id: string,
    @Body() body: RejectOrderDto,
    @CurrentUser() user: User,
  ) {
    const order = await this.ordersService.getOrderById(id);
    const userBranchId = this.getUserBranchId(user);
    if (
      user.role === UserRole.USER &&
      order.branch &&
      order.branch.id !== userBranchId
    ) {
      throw new ForbiddenException(
        'Bu sifarişi rədd etmək üçün icazəniz yoxdur',
      );
    }
    // SUPER_ADMIN və BRANCH_MANAGER bütün sifarişləri rədd edə bilər
    return this.ordersService.rejectOrder(id, user, body.reason);
  }

  @Post(':id/ship')
  @ApiOperation({
    summary: 'Sifarişi çatdırıldı kimi işarələ (mağazin paneli)',
  })
  async ship(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ordersService.markAsShipped(id, user);
  }

  @Post(':id/deliver')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER, UserRole.USER)
  @ApiOperation({
    summary:
      'Sifarişi çatdırıldı kimi işarələ və qaimə yarat (admin və magazin panelləri)',
  })
  async deliver(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.ordersService.getOrderById(id);
    const userBranchId = this.getUserBranchId(user);
    if (
      user.role === UserRole.USER &&
      order.branch &&
      order.branch.id !== userBranchId
    ) {
      throw new ForbiddenException(
        'Bu sifarişi çatdırmaq üçün icazəniz yoxdur',
      );
    }
    // SUPER_ADMIN və BRANCH_MANAGER bütün sifarişləri çatdıra bilər
    return this.ordersService.markAsDelivered(id, user);
  }

  @Get('monthly-statistics')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Aylıq statistikalar',
    description:
      'İl üçün aylıq gəlir, xərc və xalis qazanc statistikalarını qaytarır.',
  })
  async getMonthlyStatistics(
    @Query('year') year?: number,
    @CurrentUser() user?: User,
  ) {
    try {
      const tenantId = getTenantId(user);
      const targetYear = year ? parseInt(year.toString(), 10) : undefined;
      const result = await this.ordersService.getMonthlyStatistics(
        targetYear,
        tenantId,
      );
      this.logger.debug(`getMonthlyStatistics: ${result?.length || 0} items`);
      return result;
    } catch (error) {
      this.logger.error(
        `getMonthlyStatistics xətası: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  @Get('monthly-details')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Aylıq detallar',
    description:
      'Müəyyən ay üçün detallı gəlir, xərc və xalis qazanc məlumatlarını qaytarır.',
  })
  async getMonthlyDetails(
    @Query('year') year: number,
    @Query('month') month: number,
    @CurrentUser() user?: User,
  ) {
    if (!year || month === undefined || month < 0 || month > 11) {
      throw new BadRequestException('İl və ay düzgün təyin olunmalıdır');
    }
    const tenantId = getTenantId(user);
    return this.ordersService.getMonthlyDetails(year, month, tenantId);
  }

  @Get('top-selling')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Ən çox satılan məhsullar' })
  async getTopSellingProducts(
    @Query('limit') limit?: number,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    const limitValue = limit && limit > 0 && limit <= 1000 ? limit : 100;
    return this.ordersService.getTopSellingProducts(limitValue, tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Sifariş detalları' })
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    const order = await this.ordersService.getOrderById(id);
    // Əgər order-in branch-i null-dursa (magazin paneli), icazə ver
    const branchId = order.branch?.id ?? '';
    if (
      branchId &&
      user.role !== UserRole.SUPER_ADMIN &&
      user.role !== UserRole.BRANCH_MANAGER
    ) {
      this.ensureBranchAccess(branchId, user);
    }
    return order;
  }

  @Get()
  @ApiOperation({ summary: 'Sifarişlər' })
  async findByBranch(
    @Query('branchId') branchId?: string,
    @CurrentUser() user?: User,
  ) {
    try {
      if (!user) {
        this.logger.warn('findByBranch: User yoxdur - authentication problemi');
        throw new ForbiddenException('İstifadəçi autentifikasiya olunmayıb');
      }

      if (user.role === UserRole.USER) {
        return this.ordersService.listAllOrders();
      }

      const resolvedBranchId = branchId || this.getUserBranchId(user);

      if (
        !resolvedBranchId &&
        (user.role === UserRole.SUPER_ADMIN ||
          user.role === UserRole.BRANCH_MANAGER)
      ) {
        return this.ordersService.listAllOrders();
      }

      const safeBranchId =
        resolvedBranchId == null || typeof resolvedBranchId !== 'string'
          ? ''
          : resolvedBranchId;
      if (!safeBranchId) {
        return [];
      }

      this.ensureBranchAccess(safeBranchId, user);
      return this.ordersService.listOrdersForBranch(safeBranchId);
    } catch (error) {
      this.logger.error(
        `findByBranch xətası: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );

      // Əgər error artıq NestJS exception-dırsa, onu yenidən throw et
      if (
        error instanceof ForbiddenException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      // Digər xətalar üçün BadRequestException throw et
      throw new BadRequestException(
        `Sifarişləri yükləmək mümkün olmadı: ${error instanceof Error ? error.message : 'Naməlum xəta'}`,
      );
    }
  }

  private getUserBranchId(
    user?: User | Record<string, unknown>,
  ): string | undefined {
    if (!user) return undefined;
    const branch = (
      user as { branch?: { id?: string; _id?: { toString: () => string } } }
    )?.branch;
    return branch?.id ?? branch?._id?.toString?.();
  }

  private ensureBranchAccess(
    branchId: string,
    user: User | Record<string, unknown>,
  ) {
    if (!user) return;
    if (
      [UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER].includes(
        (user as User).role,
      )
    )
      return;
    const userBranchId = this.getUserBranchId(user);
    if (userBranchId !== branchId)
      throw new ForbiddenException('Filial üçün icazə yoxdur');
  }
}
