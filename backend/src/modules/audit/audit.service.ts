import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
  limit?: number;
  page?: number;
  pageSize?: number;
}

export interface AuditLogChange {
  path: string;
  type: 'added' | 'removed' | 'modified';
  before?: unknown;
  after?: unknown;
}

export interface AuditLogDto {
  id?: string;
  [key: string]: unknown;
  changes: AuditLogChange[];
}

export interface AuditLogListResult {
  data: AuditLogDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

@Injectable()
export class AuditService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditModel: Model<AuditLogDocument>,
  ) {}

  async log(
    action: string,
    actor?: { id?: string; _id?: unknown } | null,
    entity?: string,
    entityId?: string,
    before?: unknown,
    after?: unknown,
  ) {
    const actorId =
      actor?.id ??
      (actor as { _id?: { toString: () => string } })?._id?.toString?.();
    const doc = await this.auditModel.create({
      action,
      actor: actorId ?? null,
      entity,
      entityId,
      before: before as Record<string, unknown>,
      after: after as Record<string, unknown>,
    });
    return { ...doc.toObject(), id: doc._id.toString() };
  }

  async list(filters: AuditLogFilters = {}): Promise<AuditLogListResult> {
    const pageSize = this.resolvePageSize(filters);
    const page = Math.max(filters.page ?? 1, 1);

    const query: Record<string, unknown> = {};
    if (filters.userId) query.actor = filters.userId;
    if (filters.action) query.action = filters.action;
    if (filters.entity) query.entity = filters.entity;
    if (filters.entityId) query.entityId = filters.entityId;
    if (filters.from || filters.to) {
      query.createdAt = {};
      if (filters.from)
        (query.createdAt as Record<string, Date>).$gte = new Date(filters.from);
      if (filters.to)
        (query.createdAt as Record<string, Date>).$lte = new Date(filters.to);
    }
    if (filters.search) {
      query.$or = [
        { entityId: new RegExp(filters.search, 'i') },
        { action: new RegExp(filters.search, 'i') },
      ];
    }

    const [items, total] = await Promise.all([
      this.auditModel
        .find(query)
        .populate('actor')
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean()
        .exec(),
      this.auditModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.max(Math.ceil(total / pageSize), 1);
    const data: AuditLogDto[] = items.map((item: Record<string, unknown>) => ({
      ...item,
      id: (item._id as { toString?: () => string })?.toString?.(),
      changes: this.buildDiff(
        (item.before ?? {}) as Record<string, unknown>,
        (item.after ?? {}) as Record<string, unknown>,
      ),
    }));

    return {
      data,
      meta: { page, pageSize, total, totalPages, hasMore: page < totalPages },
    };
  }

  async listEntities() {
    const rows = await this.auditModel.distinct('entity').exec();
    return rows.filter(Boolean).sort();
  }

  async listActions() {
    const rows = await this.auditModel.distinct('action').exec();
    return rows.filter(Boolean).sort();
  }

  private resolvePageSize(filters: AuditLogFilters) {
    if (filters.pageSize) return Math.max(1, Math.min(filters.pageSize, 200));
    if (filters.limit) return Math.max(1, Math.min(filters.limit, 200));
    return 25;
  }

  private buildDiff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): AuditLogChange[] {
    const changes: AuditLogChange[] = [];
    const keys = new Set([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]);
    keys.forEach((key) => {
      this.collectChanges(
        (before ?? {})[key],
        (after ?? {})[key],
        [key],
        changes,
      );
    });
    return changes;
  }

  private collectChanges(
    beforeValue: unknown,
    afterValue: unknown,
    path: string[],
    changes: AuditLogChange[],
  ) {
    const pathKey = path.join('.');
    if (this.isPlainObject(beforeValue) && this.isPlainObject(afterValue)) {
      const keys = new Set([
        ...Object.keys(beforeValue),
        ...Object.keys(afterValue),
      ]);
      keys.forEach((key) =>
        this.collectChanges(
          beforeValue[key],
          afterValue[key],
          [...path, key],
          changes,
        ),
      );
      return;
    }
    if (Array.isArray(beforeValue) || Array.isArray(afterValue)) {
      const beforeArr = Array.isArray(beforeValue)
        ? beforeValue
        : beforeValue != null
          ? [beforeValue]
          : [];
      const afterArr = Array.isArray(afterValue)
        ? afterValue
        : afterValue != null
          ? [afterValue]
          : [];
      if (!this.areEqual(beforeArr, afterArr)) {
        changes.push({
          path: pathKey,
          type:
            beforeArr.length === 0
              ? 'added'
              : afterArr.length === 0
                ? 'removed'
                : 'modified',
          before: beforeArr,
          after: afterArr,
        });
      }
      return;
    }
    if (beforeValue === undefined && afterValue !== undefined)
      changes.push({ path: pathKey, type: 'added', after: afterValue });
    else if (beforeValue !== undefined && afterValue === undefined)
      changes.push({ path: pathKey, type: 'removed', before: beforeValue });
    else if (!this.areEqual(beforeValue, afterValue))
      changes.push({
        path: pathKey,
        type: 'modified',
        before: beforeValue,
        after: afterValue,
      });
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private areEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a instanceof Date && b instanceof Date)
      return a.toISOString() === b.toISOString();
    if (Array.isArray(a) && Array.isArray(b))
      return a.length === b.length && a.every((v, i) => this.areEqual(v, b[i]));
    if (this.isPlainObject(a) && this.isPlainObject(b)) {
      const keysA = Object.keys(a);
      return (
        keysA.length === Object.keys(b).length &&
        keysA.every((k) => this.areEqual(a[k], b[k]))
      );
    }
    return false;
  }
}
