import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';
import { ProductsService } from './products.service';
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

class CodeLookupDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  branchId?: string;
}

class BulkImportDto {
  @IsString()
  text: string;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

class UpdateProductPricesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  purchasePrice?: number;

  @IsOptional()
  @ValidateIf((o) => o.branchId !== null)
  @IsString()
  branchId?: string | null;

  @IsOptional()
  @IsString()
  branchName?: string | null;
}

class UpdateProductsCategoryDto {
  @IsString({ each: true })
  productIds: string[];

  @IsString()
  category: string;
}

class BulkAddSubstitutesDto {
  @IsString({ each: true })
  codes: string[];
}

class BulkDeleteProductsDto {
  @IsArray()
  @IsNotEmpty()
  @IsString({ each: true })
  productIds: string[];
}

@ApiTags('products')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Məhsul siyahısı',
    description: 'Filial filtrinə görə məhsulları və inventarı qaytarır.',
  })
  list(@Query('branch') branch?: string, @CurrentUser() user?: User) {
    const tenantId = getTenantId(user);
    return this.productsService.listProducts(branch, tenantId);
  }

  @Get('products/categories')
  @ApiOperation({
    summary: 'Kateqoriyalar siyahısı',
    description: 'Bütün mövcud kateqoriyaları qaytarır.',
  })
  getCategories() {
    return this.productsService.getCategories();
  }

  @Post('code-lookup')
  @ApiOperation({
    summary: 'Kod axtarışı',
    description: 'Məhsul koduna görə bağlı məhsulları qaytarır.',
  })
  lookup(@Body() body: CodeLookupDto, @CurrentUser() user?: User) {
    const tenantId = getTenantId(user);
    return this.productsService.lookupCode(body.code, body.branchId, tenantId);
  }

  @Post('products/bulk-import')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Toplu məhsul əlavə etmə (admin)',
    description:
      'Metn formatında məhsulları toplu şəkildə əlavə edir. Format: KOD AD [QIYMƏT] [KATEQORİYA] [VAHİD]',
  })
  bulkImport(@Body() body: BulkImportDto, @CurrentUser() user?: User) {
    const tenantId = getTenantId(user);
    return this.productsService.bulkImportProducts(body.text, tenantId);
  }

  @Put('products/:productId/prices')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Məhsulun qiymətlərini yenilə',
    description: 'Məhsulun alış və satış qiymətlərini yeniləyir.',
  })
  async updateProductPrices(
    @Param('productId') productId: string,
    @Body() body: UpdateProductPricesDto,
    @CurrentUser() user?: User,
  ): Promise<Record<string, unknown> | null> {
    const tenantId = getTenantId(user);
    return this.productsService.updateProduct(productId, body, tenantId);
  }

  @Post('products/:productId/substitutes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Məhsula əvəz edici əlavə etmə',
    description: 'Məhsula əvəz edici məhsul əlavə edir.',
  })
  addSubstitute(
    @Param('productId') productId: string,
    @Body('substituteId') substituteId: string,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    return this.productsService.addSubstitute(
      productId,
      substituteId,
      tenantId,
    );
  }

  @Delete('products/:productId/substitutes/:substituteId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Məhsuldan əvəz edici silmə',
    description: 'Məhsuldan əvəz edici məhsulu silir.',
  })
  removeSubstitute(
    @Param('productId') productId: string,
    @Param('substituteId') substituteId: string,
  ) {
    return this.productsService.removeSubstitute(productId, substituteId);
  }

  @Get('products/:productId/substitutes')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Məhsulun əvəz edicilərini göstərmə',
    description: 'Məhsulun bütün əvəz edici məhsullarını qaytarır.',
  })
  getSubstitutes(
    @Param('productId') productId: string,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    return this.productsService.getSubstitutesForProduct(productId, tenantId);
  }

  @Post('products/substitutes/bulk')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Toplu əvəz edici əlavə etmə',
    description:
      'Verilmiş kodların hamısını bir-birinin əvəz edicisi kimi əlavə edir. Hər bir kod digər bütün kodların əvəz edicisi olacaq.',
  })
  bulkAddSubstitutes(
    @Body() body: BulkAddSubstitutesDto,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    return this.productsService.bulkAddSubstitutes(body.codes, tenantId);
  }

  @Put('products/category')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Məhsulların kateqoriyasını yenilə',
    description: 'Seçilmiş məhsulların kateqoriyasını yeniləyir.',
  })
  updateProductsCategory(
    @Body() body: UpdateProductsCategoryDto,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    return this.productsService.updateProductsCategory(
      body.productIds,
      body.category,
      tenantId,
    );
  }

  @Delete('products/:productId')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Məhsulu sil',
    description: 'Məhsulu və əlaqəli inventarları silir. Yalnız admin üçün.',
  })
  async deleteProduct(
    @Param('productId') productId: string,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    return this.productsService.deleteProduct(productId, tenantId);
  }

  @Post('products/bulk-delete')
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'Birdən çox məhsulu sil',
    description: 'Seçilmiş məhsulları silir. Yalnız admin üçün.',
  })
  async deleteProducts(
    @Body() body: BulkDeleteProductsDto,
    @CurrentUser() user?: User,
  ) {
    const tenantId = getTenantId(user);
    return this.productsService.deleteProducts(body.productIds, tenantId);
  }
}
