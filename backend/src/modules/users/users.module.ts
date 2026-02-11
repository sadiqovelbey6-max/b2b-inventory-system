import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import {
  RegistrationConfig,
  RegistrationConfigSchema,
} from './schemas/registration-config.schema';
import { Branch, BranchSchema } from '../branches/schemas/branch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RegistrationConfig.name, schema: RegistrationConfigSchema },
      { name: Branch.name, schema: BranchSchema },
    ]),
  ],
  providers: [UsersService],
  controllers: [UsersController],
  exports: [UsersService, MongooseModule],
})
export class UsersModule {}
