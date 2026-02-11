import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  HttpException,
  HttpStatus,
  Get,
  Param,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { ImportExportService } from './import-export.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/constants/roles.enum';

@ApiTags('import-export')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Post('import/products')
  @ApiOperation({ summary: 'Məhsul CSV importu' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(@UploadedFile() file?: { buffer?: Buffer }) {
    if (!file) {
      throw new HttpException('Fayl tələb olunur', HttpStatus.BAD_REQUEST);
    }
    return this.importExportService.importProducts(file);
  }

  @Post('import/inventory')
  @ApiOperation({ summary: 'Inventar CSV importu' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importInventory(@UploadedFile() file?: { buffer?: Buffer }) {
    if (!file) {
      throw new HttpException('Fayl tələb olunur', HttpStatus.BAD_REQUEST);
    }
    return this.importExportService.importInventory(file);
  }

  @Get('export/:resource.:format')
  @ApiOperation({ summary: 'Məlumat ixracı (CSV/PDF)' })
  @ApiParam({ name: 'resource', enum: ['orders', 'invoices', 'payments'] })
  @ApiParam({ name: 'format', enum: ['csv', 'pdf'] })
  async export(
    @Param('resource') resource: string,
    @Param('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (!['orders', 'invoices', 'payments'].includes(resource)) {
      throw new HttpException('Düzgün resurs seçin', HttpStatus.BAD_REQUEST);
    }

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resource}.csv"`,
      );
      return this.importExportService.exportCsv(
        resource as 'orders' | 'invoices' | 'payments',
      );
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${resource}.pdf"`,
      );
      return this.importExportService.exportPdf(
        resource as 'orders' | 'invoices' | 'payments',
      );
    }

    throw new HttpException('Düzgün format seçin', HttpStatus.BAD_REQUEST);
  }
}
