import { Controller, Post, UseGuards, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';

@ApiTags('transactions')
@ApiBearerAuth()
@Controller('transactions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post('publish-stock')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Sayları yenilə (Publish)',
    description:
      'Bütün pending transaction-ları published edir və stok dəyərlərini yeniləyir. Yalnız main admin edə bilər.',
  })
  async publishStockUpdate() {
    return this.transactionsService.publishStockUpdate();
  }

  @Get('calculated-stock')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Hesablanmış stok məlumatları (yalnız main admin)',
    description: 'Yalnız main admin üçün hesablanmış stok dəyərlərini qaytarır',
  })
  async getCalculatedStock(@Query('branchId') branchId?: string) {
    return this.transactionsService.getCalculatedStock(branchId);
  }

  @Get('published-stock')
  @Roles(UserRole.BRANCH_MANAGER, UserRole.USER)
  @ApiOperation({
    summary: 'Published stok məlumatları',
    description:
      'Təsdiqlənmiş stok dəyərlərini qaytarır (ikinci admin və client üçün)',
  })
  async getPublishedStock(@Query('branchId') branchId?: string) {
    return this.transactionsService.getPublishedStock(branchId);
  }
}
