import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';
import type {
  AuditLogEntry,
  AuditLogChange,
  PaginatedResponse,
} from '../types';

export interface AuditLogFilters {
  userId?: string;
  action?: string;
  entity?: string;
  entityId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export type AuditLogListResponse = PaginatedResponse<AuditLogEntry>;

const fetchAuditLogs = async (filters: AuditLogFilters) => {
  const response = await api.get<AuditLogListResponse>('/admin/audit', {
    params: filters,
  });
  return response.data;
};

export const useAuditLogs = (filters: AuditLogFilters, enabled = true) =>
  useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => fetchAuditLogs(filters),
    enabled,
  });

export const useAuditEntities = () =>
  useQuery({
    queryKey: ['audit-entities'],
    queryFn: async () => {
      const response = await api.get<string[]>('/admin/audit/entities');
      return response.data;
    },
  });

export const useAuditActions = () =>
  useQuery({
    queryKey: ['audit-actions'],
    queryFn: async () => {
      const response = await api.get<string[]>('/admin/audit/actions');
      return response.data;
    },
  });

export interface AuditLogTableRow {
  id: string;
  actor: string;
  action: string;
  entity: string;
  entityId: string;
  timestamp: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes: AuditLogChange[];
}

export const useAuditTableData = (logs: AuditLogEntry[]) =>
  useMemo<AuditLogTableRow[]>(
    () =>
      logs.map((log) => ({
        id: log.id,
        actor: log.actor?.email ?? 'Sistem',
        action: log.action,
        entity: log.entity ?? '—',
        entityId: log.entityId ?? '—',
        timestamp: new Date(log.createdAt).toLocaleString('az-AZ'),
        before: log.before ?? undefined,
        after: log.after ?? undefined,
        changes: log.changes ?? [],
      })),
    [logs],
  );

export default useAuditLogs;
