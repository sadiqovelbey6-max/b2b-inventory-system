import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';

class CreateTenantDto {
  name: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
}

class UpdateTenantDto {
  name?: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
  isActive?: boolean;
}

@Controller('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  async findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
  ): Promise<Record<string, unknown> | null> {
    return this.tenantsService.findById(id);
  }

  @Post()
  async create(@Body() dto: CreateTenantDto): Promise<Record<string, unknown>> {
    return this.tenantsService.create(dto);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ): Promise<Record<string, unknown> | null> {
    return this.tenantsService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.tenantsService.delete(id);
    return { message: 'Müştəri silindi' };
  }
}
