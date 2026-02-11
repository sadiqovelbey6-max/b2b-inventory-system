import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Branch, BranchDocument } from './schemas/branch.schema';
import { UsersService } from '../users/users.service';

@Injectable()
export class BranchesService {
  constructor(
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
    private readonly usersService: UsersService,
  ) {}

  findAll(tenantId?: string) {
    const filter = tenantId ? { tenant: tenantId } : {};
    return this.branchModel
      .find(filter)
      .populate('tenant')
      .sort({ name: 1 })
      .lean()
      .exec()
      .then((docs) =>
        docs.map((d: Record<string, unknown>) => ({
          ...d,
          id: (d._id as { toString?: () => string })?.toString?.(),
        })),
      );
  }

  findById(id: string): Promise<Record<string, unknown> | null> {
    return this.branchModel
      .findById(id)
      .lean()
      .exec()
      .then((d) =>
        d
          ? {
              ...d,
              id: (d as { _id: { toString: () => string } })._id?.toString?.(),
            }
          : null,
      );
  }

  async ensureBranch(code: string, name: string) {
    let branch = await this.branchModel.findOne({ code }).exec();
    if (!branch) {
      branch = await this.branchModel.create({ code, name });
    }
    return { ...branch.toObject(), id: branch._id.toString() };
  }

  async create(code: string, name: string) {
    const existing = await this.branchModel.findOne({ code }).exec();
    if (existing)
      throw new BadRequestException('Bu kodla filial artıq mövcuddur');
    const branch = await this.branchModel.create({ code, name });
    return { ...branch.toObject(), id: branch._id.toString() };
  }

  async delete(id: string) {
    const branch = await this.branchModel.findById(id).exec();
    if (!branch) throw new NotFoundException('Filial tapılmadı');
    const userCount = await this.usersService.countByBranch(id);
    if (userCount > 0) {
      throw new BadRequestException(
        'Bu filialda istifadəçilər var. Əvvəlcə istifadəçiləri başqa filiala köçürün və ya silin.',
      );
    }
    await this.branchModel.findByIdAndDelete(id).exec();
    return { message: 'Filial uğurla silindi' };
  }
}
