import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsArray, IsString, IsOptional } from 'class-validator';
import { ManualAdjustmentsService } from './manual-adjustments.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class ManualAdjustmentDto {
  @IsString()
  text: string;

  @IsString()
  @IsOptional()
  branchId?: string; // Artıq optional, çünki məhsullar ümumi bazada
}

// Approve endpoint silindi: manual adjustments üçün təsdiq API çıxarıldı

@ApiTags('manual-adjustments')
@ApiBearerAuth()
@Controller('manual-adjustments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class ManualAdjustmentsController {
  constructor(private readonly adjustmentsService: ManualAdjustmentsService) {}

  @Post('create')
  @ApiOperation({
    summary: 'Manual say yeniləmə (preview)',
    description:
      'Copy-paste formatında manual düzəlişlər yaradır. Format: "PRD001: +5" və ya "PRD001: -2"',
  })
  async create(
    @Body() body: ManualAdjustmentDto,
    @CurrentUser() user?: Record<string, unknown>,
  ) {
    let userId: string | null = null;
    if (user) {
      const id =
        user.id ??
        (user as { _id?: { toString?: () => string } })?._id?.toString?.();
      userId =
        typeof id === 'string'
          ? id
          : id &&
              typeof (id as { toString?: () => string }).toString === 'function'
            ? (id as { toString: () => string }).toString()
            : null;
    }
    if (!userId) {
      throw new Error('İstifadəçi tapılmadı');
    }
    return this.adjustmentsService.createManualAdjustments(
      body.text,
      body.branchId || null,
      userId,
    );
  }

  @Get('pending')
  @ApiOperation({
    summary: 'Pending adjustment-ləri gətir',
    description: 'Təsdiqlənməmiş manual düzəlişləri qaytarır',
  })
  async getPending(@Query('branchId') branchId?: string) {
    return this.adjustmentsService.getPendingAdjustments(branchId);
  }
}
