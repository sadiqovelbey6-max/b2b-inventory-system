import { useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth';
import { USER_ROLES, type UserRole, type User } from '../../types';
import {
  useAuditLogs,
  useAuditEntities,
  useAuditActions,
  type AuditLogFilters,
  useAuditTableData,
} from '../../hooks/useAuditLogs';
import useBranches from '../../hooks/useBranches';

const allowedRoles: UserRole[] = [USER_ROLES.BRANCH_MANAGER, USER_ROLES.SUPER_ADMIN];

const changeTypeMap: Record<string, { label: string; color: string }> = {
  added: { label: 'Əlavə edildi', color: 'bg-green-100 text-green-700' },
  removed: { label: 'Silindi', color: 'bg-red-100 text-red-700' },
  modified: { label: 'Dəyişdirildi', color: 'bg-amber-100 text-amber-700' },
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};

export const AuditPage = () => {
  const { user } = useAuth();
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    pageSize: 20,
  });

  const entitiesQuery = useAuditEntities();
  const actionsQuery = useAuditActions();
  const branchesQuery = useBranches();
  const logsQuery = useAuditLogs(filters, Boolean(user && allowedRoles.includes(user.role)));

  const tableData = useAuditTableData(logsQuery.data?.data ?? []);
  const meta = logsQuery.data?.meta;

  const handleFilterChange = (key: keyof AuditLogFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      page: 1,
      [key]: value ? value : undefined,
    }));
  };

  const handlePageChange = (page: number) => {
    setFilters((prev) => ({
      ...prev,
      page,
    }));
  };

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value) || 20;
    setFilters((prev) => ({
      ...prev,
      page: 1,
      pageSize: nextSize,
    }));
  };

  const branchUsers = useMemo(
    () =>
      (branchesQuery.data ?? []).flatMap((branch) =>
        ((branch as unknown as { users?: User[] }).users ?? []).map((branchUser) => ({
          ...branchUser,
          branchName: branch.name,
        })),
      ),
    [branchesQuery.data],
  );

  if (!user || !allowedRoles.includes(user.role)) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Audit logları</h2>
        <p className="text-sm text-slate-500">
          Sistem üzərində edilən dəyişikliklər, icra edən istifadəçi və əvvəl/sonra fərqləri.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">Filtrlər</h3>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">İstifadəçi</label>
            <select
              value={filters.userId ?? ''}
              onChange={(event) => handleFilterChange('userId', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Hamısı</option>
              {branchUsers.map((branchUser) => (
                <option key={branchUser.id} value={branchUser.id}>
                  {branchUser.email} ({branchUser.branchName})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Entity</label>
            <select
              value={filters.entity ?? ''}
              onChange={(event) => handleFilterChange('entity', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Hamısı</option>
              {(entitiesQuery.data ?? []).map((entity) => (
                <option key={entity} value={entity}>
                  {entity}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Entity ID</label>
            <input
              value={filters.entityId ?? ''}
              onChange={(event) => handleFilterChange('entityId', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Entity identifikatoru"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Əməliyyat</label>
            <select
              value={filters.action ?? ''}
              onChange={(event) => handleFilterChange('action', event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Hamısı</option>
              {(actionsQuery.data ?? []).map((action) => (
                <option key={action} value={action}>
                  {action}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 uppercase">Axtarış</label>
            <input
              value={filters.search ?? ''}
              onChange={(event) => handleFilterChange('search', event.target.value)}
              placeholder="Entity ID, istifadəçi və ya əməliyyat"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Başlanğıc tarixi</label>
              <input
                type="date"
                value={filters.from ?? ''}
                onChange={(event) => handleFilterChange('from', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 uppercase">Bitiş tarixi</label>
              <input
                type="date"
                value={filters.to ?? ''}
                onChange={(event) => handleFilterChange('to', event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Log siyahısı</h3>
            {meta ? (
              <p className="text-xs text-slate-500">
                Cəmi {meta.total} qeyd · Səhifə {meta.page}/{meta.totalPages}
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs uppercase text-slate-500">Səhifə ölçüsü</label>
            <select
              value={filters.pageSize ?? 20}
              onChange={(event) => handlePageSizeChange(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
            >
              {[10, 20, 30, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            {logsQuery.isFetching ? <span className="text-xs text-slate-400">Yüklənir...</span> : null}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">İstifadəçi</th>
                <th className="px-4 py-3 text-left">Əməliyyat</th>
                <th className="px-4 py-3 text-left">Entity</th>
                <th className="px-4 py-3 text-left">Entity ID</th>
                <th className="px-4 py-3 text-left">Tarix</th>
                <th className="px-4 py-3 text-left">Detallar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tableData.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-500">
                    Log tapılmadı.
                  </td>
                </tr>
              ) : (
                tableData.map((log) => (
                  <tr key={log.id}>
                    <td className="px-4 py-3">{log.actor}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{log.action}</td>
                    <td className="px-4 py-3">{log.entity}</td>
                    <td className="px-4 py-3">{log.entityId}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{log.timestamp}</td>
                    <td className="px-4 py-3">
                      <details className="group">
                        <summary className="cursor-pointer text-xs font-medium text-primary-600">
                          Baxış
                        </summary>
                        <div className="mt-3 space-y-3 text-xs text-slate-600">
                          {log.changes.length > 0 ? (
                            log.changes.map((change) => {
                              const badge = changeTypeMap[change.type];
                              return (
                                <div key={`${log.id}-${change.path}-${change.type}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-semibold text-slate-800">{change.path}</span>
                                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${badge?.color ?? 'bg-slate-100 text-slate-600'}`}>
                                      {badge?.label ?? change.type}
                                    </span>
                                  </div>
                                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                                    <div>
                                      <div className="text-[10px] uppercase text-slate-400">Əvvəl</div>
                                      <pre className="whitespace-pre-wrap rounded-lg bg-white p-2 shadow-inner">
                                        {formatValue(change.before)}
                                      </pre>
                                    </div>
                                    <div>
                                      <div className="text-[10px] uppercase text-slate-400">Sonra</div>
                                      <pre className="whitespace-pre-wrap rounded-lg bg-white p-2 shadow-inner">
                                        {formatValue(change.after)}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            <div className="rounded-lg bg-slate-100 p-2 text-slate-500">
                              Dəyişiklik diff məlumatı yoxdur.
                            </div>
                          )}
                          {log.changes.length === 0 && (log.before || log.after) ? (
                            <div className="space-y-2">
                              {log.before ? (
                                <pre className="rounded-lg bg-slate-100 p-2 shadow-inner">
                                  {JSON.stringify(log.before, null, 2)}
                                </pre>
                              ) : null}
                              {log.after ? (
                                <pre className="rounded-lg bg-slate-100 p-2 shadow-inner">
                                  {JSON.stringify(log.after, null, 2)}
                                </pre>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </details>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-col items-center gap-3 border-t border-slate-200 pt-4 md:flex-row md:justify-between">
          <div className="text-xs text-slate-500">
            {meta ? `Səhifə ${meta.page} / ${meta.totalPages}` : 'Səhifələmə məlumatı yoxdur'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handlePageChange(Math.max((meta?.page ?? 1) - 1, 1))}
              disabled={!meta || meta.page <= 1}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Əvvəlki
            </button>
            <button
              type="button"
              onClick={() =>
                handlePageChange(
                  meta ? Math.min(meta.page + 1, meta.totalPages) : 1,
                )
              }
              disabled={!meta || meta.page >= meta.totalPages}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Növbəti
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AuditPage;
