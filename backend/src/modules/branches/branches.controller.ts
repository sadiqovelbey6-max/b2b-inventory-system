import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/schemas/user.schema';
import { UserRole } from '../../common/constants/roles.enum';

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

class CreateBranchDto {
  @IsString()
  code: string;

  @IsString()
  name: string;
}

@ApiTags('branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(JwtAuthGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @ApiOperation({ summary: 'Filiallar siyahısı' })
  findAll(@CurrentUser() user?: User) {
    const tenantId = getTenantId(user);
    return this.branchesService.findAll(tenantId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Yeni filial yarat (yalnız Super Admin)' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto.code, dto.name);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Filial sil (yalnız Super Admin)' })
  delete(@Param('id') id: string) {
    return this.branchesService.delete(id);
  }
}
