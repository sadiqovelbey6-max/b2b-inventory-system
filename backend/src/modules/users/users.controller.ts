import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsString,
  IsEmail,
  Min,
  IsOptional,
} from 'class-validator';
import { UsersService } from './users.service';
import { UserRole } from '../../common/constants/roles.enum';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import type { User } from './schemas/user.schema';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsEnum(UserRole)
  role: UserRole;
}

class UpdateRegistrationLimitDto {
  @IsInt()
  @Min(1)
  maxUsers: number;
}

class ChangeUserRoleDto {
  @IsEnum(UserRole)
  role: UserRole;
}

class UpdateUserDto {
  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

@ApiBearerAuth()
@ApiTags('users')
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({
    summary: 'Yeni istifadəçi yarat (yalnız main admin)',
    description:
      'Yalnız main admin istifadəçi yarada bilər. SUPER_ADMIN rolu yalnız mövcud SUPER_ADMIN tərəfindən yaradıla bilər.',
  })
  create(@Body() body: CreateUserDto, @CurrentUser() currentUser: User) {
    // SUPER_ADMIN rolu yalnız mövcud SUPER_ADMIN tərəfindən yaradıla bilər
    if (
      body.role === UserRole.SUPER_ADMIN &&
      currentUser.role !== UserRole.SUPER_ADMIN
    ) {
      throw new Error(
        'SUPER_ADMIN rolu yalnız mövcud SUPER_ADMIN tərəfindən yaradıla bilər',
      );
    }
    return this.usersService.createUser({
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
      phone: body.phone,
      branchId: body.branchId,
      role: body.role,
    });
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({
    summary: 'İstifadəçi siyahısı',
    description: 'Bütün istifadəçiləri (sensitive sahələrsiz) qaytarır.',
  })
  findAll() {
    return this.usersService.listUsers().then((users) =>
      users.map((user) => {
        const sanitized = { ...user } as Partial<User>;
        delete sanitized.passwordHash;
        delete sanitized.twoFactorSecret;
        return sanitized;
      }),
    );
  }

  @Get('config')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Qeydiyyat limitini görüntülə' })
  getConfig() {
    return this.usersService.getRegistrationConfig();
  }

  @Patch('config')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'Qeydiyyat limitini yenilə' })
  updateConfig(@Body() body: UpdateRegistrationLimitDto) {
    return this.usersService.updateRegistrationLimit(body.maxUsers);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'İstifadəçi məlumatlarını görüntülə' })
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN, UserRole.BRANCH_MANAGER)
  @ApiOperation({ summary: 'İstifadəçi rolunu dəyiş' })
  changeRole(@Param('id') id: string, @Body() body: ChangeUserRoleDto) {
    return this.usersService.changeUserRole(id, body.role);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'İstifadəçi məlumatlarını yenilə' })
  updateUser(@Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.usersService.updateUser(id, body);
  }
}
