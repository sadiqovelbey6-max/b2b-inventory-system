import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Tenant, TenantDocument } from './schemas/tenant.schema';
import { User, UserDocument } from '../users/schemas/user.schema';

@Injectable()
export class TenantsService {
  constructor(
    @InjectModel(Tenant.name)
    private readonly tenantModel: Model<TenantDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  private toResponse(
    doc: { _id?: { toString: () => string }; [key: string]: unknown } | null,
  ) {
    if (!doc) return null;
    return { ...doc, id: doc._id?.toString?.() };
  }

  async findAll() {
    const tenants = await this.tenantModel
      .find()
      .sort({ name: 1 })
      .lean()
      .exec();
    const result: Array<Record<string, unknown>> = [];
    for (const tenant of tenants) {
      const users = await this.userModel
        .find({ tenant: (tenant as { _id: { toString: () => string } })._id })
        .populate('branch')
        .lean()
        .exec();
      result.push({
        ...tenant,
        id: (tenant as { _id: { toString: () => string } })._id?.toString?.(),
        users: users.map((u: Record<string, unknown>) => ({
          id: (u._id as { toString?: () => string })?.toString?.(),
          email: u.email,
          branch: u.branch
            ? {
                id: (
                  u.branch as { _id?: { toString?: () => string } }
                )?._id?.toString?.(),
                name: (u.branch as { name?: string })?.name,
              }
            : null,
        })),
      });
    }
    return result;
  }

  async findById(id: string): Promise<Record<string, unknown> | null> {
    const tenant = await this.tenantModel.findById(id).lean().exec();
    if (!tenant) return null;
    const users = await this.userModel
      .find({ tenant: (tenant as { _id: unknown })._id })
      .populate('branch')
      .lean()
      .exec();
    return {
      ...tenant,
      id: (tenant as { _id: { toString: () => string } })._id?.toString?.(),
      users: users.map((u: Record<string, unknown>) => ({
        id: (u._id as { toString?: () => string })?.toString?.(),
        email: u.email,
        branch: u.branch
          ? {
              id: (
                u.branch as { _id?: { toString?: () => string } }
              )?._id?.toString?.(),
              name: (u.branch as { name?: string })?.name,
            }
          : null,
      })),
    };
  }

  async create(data: {
    name: string;
    description?: string;
    contactEmail?: string;
    contactPhone?: string;
  }): Promise<Record<string, unknown>> {
    const tenant = await this.tenantModel.create({ ...data, isActive: true });
    const tenantWithRelations = await this.findById(tenant._id.toString());
    if (!tenantWithRelations)
      throw new NotFoundException('Yaradılmış müştəri tapılmadı');
    return tenantWithRelations;
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description?: string;
      contactEmail?: string;
      contactPhone?: string;
      isActive?: boolean;
    }>,
  ): Promise<Record<string, unknown> | null> {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined && data.name !== null)
      updateData.name = data.name.trim();
    if (data.description !== undefined)
      updateData.description = data.description?.trim() || null;
    if (data.contactEmail !== undefined)
      updateData.contactEmail = data.contactEmail?.trim() || null;
    if (data.contactPhone !== undefined)
      updateData.contactPhone = data.contactPhone?.trim() || null;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    const updated = await this.tenantModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .exec();
    if (!updated) throw new NotFoundException('Müştəri yenilənə bilmədi');
    return this.findById(id);
  }

  async delete(id: string) {
    await this.tenantModel.findByIdAndDelete(id).exec();
  }
}
