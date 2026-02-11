import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { hash } from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import {
  RegistrationConfig,
  RegistrationConfigDocument,
} from './schemas/registration-config.schema';
import { Branch, BranchDocument } from '../branches/schemas/branch.schema';
import { UserRole } from '../../common/constants/roles.enum';
import { Types } from 'mongoose';

interface CreateUserInput {
  email: string;
  password?: string;
  passwordHash?: string;
  role: UserRole;
  branchId?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

function toUserResponse(doc: Record<string, unknown> | null) {
  if (!doc) return null;
  return { ...doc, id: (doc._id as { toString?: () => string })?.toString?.() };
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(RegistrationConfig.name)
    private readonly configModel: Model<RegistrationConfigDocument>,
    @InjectModel(Branch.name)
    private readonly branchModel: Model<BranchDocument>,
  ) {}

  async findByEmail(email: string) {
    const doc = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .populate('branch')
      .populate('tenant')
      .lean()
      .exec();
    return toUserResponse(doc as Record<string, unknown>);
  }

  async findById(id: string) {
    const doc = await this.userModel
      .findById(id)
      .populate('branch')
      .populate('tenant')
      .lean()
      .exec();
    return toUserResponse(doc as Record<string, unknown>);
  }

  async listUsers() {
    const docs = await this.userModel
      .find()
      .populate('branch')
      .populate('tenant')
      .sort({ createdAt: -1 })
      .lean()
      .exec();
    return docs.map((d) => toUserResponse(d as Record<string, unknown>));
  }

  async countUsers() {
    return this.userModel.countDocuments().exec();
  }

  async countByBranch(branchId: string) {
    return this.userModel.countDocuments({ branch: branchId }).exec();
  }

  async getRegistrationConfig() {
    let config = await this.configModel.findOne().sort({ maxUsers: -1 }).exec();
    if (!config) {
      config = await this.configModel.create({
        maxUsers: 50,
        allowOpenRegistration: true,
      });
    }
    return toUserResponse(
      config.toObject() as unknown as Record<string, unknown>,
    );
  }

  async updateRegistrationLimit(maxUsers: number) {
    const config = await this.configModel
      .findOne()
      .sort({ maxUsers: -1 })
      .exec();
    if (!config) return;
    await this.configModel
      .findByIdAndUpdate(config._id, { $set: { maxUsers } })
      .exec();
  }

  async createUser(data: CreateUserInput) {
    await this.ensureRegistrationLimit();

    let branchId: Types.ObjectId | null = null;
    if (data.branchId) {
      const branch = await this.branchModel.findById(data.branchId).exec();
      if (!branch) throw new BadRequestException('Seçilmiş filial tapılmadı');
      branchId = branch._id;
    }

    const existing = await this.findByEmail(data.email.toLowerCase());
    if (existing)
      throw new BadRequestException('Bu e-poçt artıq istifadə olunur');

    let passwordHash: string;
    if (data.passwordHash) passwordHash = data.passwordHash;
    else if (data.password) passwordHash = await hash(data.password, 10);
    else throw new BadRequestException('Şifrə tələb olunur');

    const user = await this.userModel.create({
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      branch: branchId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
    });
    return this.findById(user._id.toString());
  }

  async ensureRegistrationLimit() {
    const [config, count] = await Promise.all([
      this.getRegistrationConfig(),
      this.countUsers(),
    ]);
    const max = (config as { maxUsers?: number })?.maxUsers ?? 50;
    if (count >= max) {
      throw new BadRequestException(
        'Qeydiyyat limiti dolmuşdur. Adminlə əlaqə saxlayın.',
      );
    }
  }

  async changeUserRole(userId: string, role: UserRole) {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $set: { role } }, { new: true })
      .exec();
    if (!user) throw new NotFoundException('İstifadəçi tapılmadı');
    return this.findById(userId);
  }

  async updateUser(
    userId: string,
    data: {
      email?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      role?: UserRole;
    },
  ) {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundException('İstifadəçi tapılmadı');

    const update: Record<string, unknown> = {};
    if (data.email && data.email !== (user as Record<string, unknown>).email) {
      const existing = await this.findByEmail(data.email.toLowerCase());
      if (existing)
        throw new BadRequestException('Bu e-poçt artıq istifadə olunur');
      update.email = data.email.toLowerCase();
    }
    if (data.firstName !== undefined)
      update.firstName = data.firstName?.trim() || null;
    if (data.lastName !== undefined)
      update.lastName = data.lastName?.trim() || null;
    if (data.phone !== undefined) update.phone = data.phone?.trim() || null;
    if (data.role !== undefined) update.role = data.role;

    await this.userModel.findByIdAndUpdate(userId, { $set: update }).exec();
    return this.findById(userId);
  }

  async updateTwoFactorSecret(userId: string, secret: string) {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: { twoFactorSecret: secret, twoFactorEnabled: false },
      })
      .exec();
    return this.findById(userId);
  }

  async setTwoFactorEnabled(userId: string, enabled: boolean) {
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { twoFactorEnabled: enabled } })
      .exec();
    return this.findById(userId);
  }

  async clearTwoFactor(userId: string) {
    await this.userModel
      .findByIdAndUpdate(userId, {
        $set: { twoFactorEnabled: false, twoFactorSecret: null },
      })
      .exec();
  }

  async updateLastLogin(userId: string) {
    await this.userModel
      .findByIdAndUpdate(userId, { $set: { lastLoginAt: new Date() } })
      .exec();
  }
}
