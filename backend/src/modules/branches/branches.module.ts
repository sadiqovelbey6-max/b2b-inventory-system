import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Branch, BranchSchema } from './schemas/branch.schema';
import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Branch.name, schema: BranchSchema }]),
    UsersModule,
  ],
  providers: [BranchesService],
  controllers: [BranchesController],
  exports: [BranchesService, MongooseModule],
})
export class BranchesModule {}
