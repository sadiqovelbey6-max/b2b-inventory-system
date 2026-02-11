import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { AuditLogFilters } from './audit.service';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';

@ApiTags('audit')
@ApiBearerAuth()
@Controller('admin/audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: 'Audit logları',
    description: 'Filtr parametrlərinə əsasən fəaliyyət qeydlərini qaytarır.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 100 })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, example: 25 })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entity', required: false, type: String })
  @ApiQuery({ name: 'entityId', required: false, type: String })
  @ApiQuery({
    name: 'from',
    required: false,
    type: String,
    description: 'ISO tarix başlanğıcı',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    type: String,
    description: 'ISO tarix sonu',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: 'Action, entityId və ya istifadəçi üzrə axtarış',
  })
  list(@Query() query: AuditLogFilters) {
    const parsed = {
      ...query,
      limit: query.limit ? Number(query.limit) : undefined,
      page: query.page ? Number(query.page) : undefined,
      pageSize: query.pageSize ? Number(query.pageSize) : undefined,
    };
    return this.auditService.list(parsed);
  }

  @Get('entities')
  @ApiOperation({ summary: 'Audit entity siyahısı' })
  listEntities() {
    return this.auditService.listEntities();
  }

  @Get('actions')
  @ApiOperation({ summary: 'Audit action siyahısı' })
  listActions() {
    return this.auditService.listActions();
  }
}
