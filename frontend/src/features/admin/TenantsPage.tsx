import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTenants, useCreateTenant, useUpdateTenant, useDeleteTenant, type Tenant } from '../../hooks/useTenants';
import useAuth from '../../hooks/useAuth';
import { USER_ROLES } from '../../types';
import type { UserRole } from '../../types';

export const TenantsPage = () => {
  const { user } = useAuth();
  const adminRoles: UserRole[] = [USER_ROLES.BRANCH_MANAGER, USER_ROLES.SUPER_ADMIN];
  const isAdmin = user ? adminRoles.includes(user.role) : false;
  const isSuperAdmin = user?.role === USER_ROLES.SUPER_ADMIN;

  const { data: tenants, isLoading, refetch: refetchTenants } = useTenants(isAdmin);
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const deleteTenant = useDeleteTenant();

  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contactEmail: '',
    contactPhone: '',
  });

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createTenant.mutateAsync(formData);
      setIsCreating(false);
      setFormData({ name: '', description: '', contactEmail: '', contactPhone: '' });
      // Əlavə refetch
      setTimeout(async () => {
        await refetchTenants();
      }, 300);
    } catch {
      // Error handled by mutation
    }
  };

  const handleEdit = (tenant: Tenant) => {
    setEditingId(tenant.id);
    setFormData({
      name: tenant.name,
      description: tenant.description ?? '',
      contactEmail: tenant.contactEmail ?? '',
      contactPhone: tenant.contactPhone ?? '',
    });
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    
    const updateData = {
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      contactEmail: formData.contactEmail.trim() || undefined,
      contactPhone: formData.contactPhone.trim() || undefined,
    };
    
    console.log('Frontend update başladı:', { id: editingId, data: updateData });
    
    try {
      const result = await updateTenant.mutateAsync({
        id: editingId,
        data: updateData,
      });
      
      console.log('Frontend update nəticəsi:', result);
      
      // Formu bağla
      setEditingId(null);
      setFormData({ name: '', description: '', contactEmail: '', contactPhone: '' });
      
      // Cache-i mütləq yenilə - mutation onSuccess-də də yenilənir, amma əlavə təhlükəsizlik üçün
      setTimeout(async () => {
        await refetchTenants();
      }, 200);
    } catch (error) {
      console.error('Frontend update xətası:', error);
      // Error handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Bu müştərini silmək istədiyinizə əminsiniz?')) {
      await deleteTenant.mutateAsync(id);
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    setFormData({ name: '', description: '', contactEmail: '', contactPhone: '' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Müştəri idarəetməsi</h2>
          <p className="text-sm text-slate-500">Müştəriləri yaradın, redaktə edin və silin.</p>
        </div>
        {!isCreating && !editingId && isSuperAdmin && (
          <button
            onClick={() => setIsCreating(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
          >
            + Yeni müştəri
          </button>
        )}
      </div>

      {(isCreating || editingId) && isSuperAdmin && (
        <form
          onSubmit={editingId ? handleUpdate : handleCreate}
          className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4"
        >
          <h3 className="text-lg font-semibold text-slate-900">
            {editingId ? 'Müştərini redaktə et' : 'Yeni müştəri'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Ad *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Müştəri adı"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Login Email *</label>
              <input
                type="text"
                required
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="login@example.com və ya login_text"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="+994 XX XXX XX XX"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-600 mb-1">Təsvir</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="Müştəri haqqında məlumat"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={createTenant.isPending || updateTenant.isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
            >
              {createTenant.isPending || updateTenant.isPending
                ? 'Yüklənir...'
                : editingId
                  ? 'Yenilə'
                  : 'Yarat'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Ləğv et
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Müştərilər</h3>
        </div>
        {isLoading ? (
          <div className="p-6 text-sm text-slate-500">Yüklənir...</div>
        ) : tenants && tenants.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {tenants.map((tenant: Tenant) => (
              <div key={tenant.id} className="px-6 py-4 hover:bg-slate-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-semibold text-slate-900">{tenant.name}</div>
                      {tenant.isActive ? (
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700">Aktiv</span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Qeyri-aktiv</span>
                      )}
                    </div>
                    {tenant.description && (
                      <div className="text-sm text-slate-500 mt-1">{tenant.description}</div>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                      {tenant.contactEmail && <span>📧 Login: {tenant.contactEmail}</span>}
                      {tenant.contactPhone && <span>📞 {tenant.contactPhone}</span>}
                    </div>
                    {tenant.users && tenant.users.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <div className="text-xs font-semibold text-slate-700">İstifadəçilər:</div>
                        {tenant.users.map((user) => (
                          <div key={user.id} className="text-xs text-slate-600">
                            {user.email}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleEdit(tenant)}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Redaktə et
                      </button>
                      <button
                        onClick={() => handleDelete(tenant.id)}
                        disabled={deleteTenant.isPending}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Sil
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-sm text-slate-500">Müştəri tapılmadı.</div>
        )}
      </div>
    </div>
  );
};

export default TenantsPage;

