import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { CartsService } from './carts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { User } from '../users/schemas/user.schema';
import { UserRole } from '../../common/constants/roles.enum';

class UpdateCartItemDto {
  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  productId: string;

  @IsNumber()
  @Min(0)
  quantity: number;
}

@ApiTags('cart')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard)
export class CartsController {
  constructor(private readonly cartsService: CartsService) {}

  @Get('cart')
  getCart(@CurrentUser() user: User) {
    // Magazin paneli üçün ümumi cart (branch: null)
    return this.cartsService.getGeneralCart();
  }

  @Post('cart/items')
  updateItem(@Body() body: UpdateCartItemDto, @CurrentUser() user: User) {
    // Magazin paneli üçün ümumi cart (branch: null)
    // Transform quantity to number if it's a string
    const quantity =
      typeof body.quantity === 'string'
        ? parseInt(body.quantity, 10)
        : body.quantity;

    if (isNaN(quantity) || quantity < 0) {
      throw new BadRequestException('Miqdar düzgün deyil');
    }

    return this.cartsService.updateItemQuantityForGeneralCart(
      body.productId,
      quantity,
    );
  }

  @Delete('branches/:branchId/cart')
  clearCart(@Param('branchId') branchId: string, @CurrentUser() user: User) {
    this.ensureBranchAccess(branchId, user);
    return this.cartsService.clearCart(branchId);
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
    ) {
      return;
    }
    const branch = (
      user as { branch?: { id?: string; _id?: { toString: () => string } } }
    )?.branch;
    const userBranchId = branch?.id ?? branch?._id?.toString?.();
    if (userBranchId !== branchId) {
      throw new ForbiddenException('Filial üçün icazə yoxdur');
    }
  }
}
