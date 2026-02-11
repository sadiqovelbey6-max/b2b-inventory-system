import { useEffect, useState, useMemo } from 'react';
import type { FormEvent } from 'react';
import { useAdminUsers, useRegistrationConfig, useUpdateRegistrationLimit, useCreateUser, useUpdateUser } from '../../hooks/useAdminUsers';
import useAuth from '../../hooks/useAuth';
import { USER_ROLES } from '../../types';
import type { User, UserRole } from '../../types';

export const AdminPage = () => {
  const { user } = useAuth();
  const adminRoles: UserRole[] = [USER_ROLES.BRANCH_MANAGER, USER_ROLES.SUPER_ADMIN];
  const isAdmin = user ? adminRoles.includes(user.role) : false;
  const { data: users, isLoading: isUsersLoading } = useAdminUsers(isAdmin);
  const { data: config, isLoading: isConfigLoading } = useRegistrationConfig(isAdmin);
  const updateLimit = useUpdateRegistrationLimit();
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();
  const [maxUsers, setMaxUsers] = useState<number>(config?.maxUsers ?? 50);
  const [showCreateUserForm, setShowCreateUserForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: USER_ROLES.USER as UserRole,
  });
  const [editUser, setEditUser] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: USER_ROLES.USER as UserRole,
  });

  useEffect(() => {
    if (config?.maxUsers) {
      setMaxUsers(config.maxUsers);
    }
  }, [config?.maxUsers]);

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchQuery.trim()) return users;
    const query = searchQuery.toLowerCase();
    return users.filter((u: User) => 
      u.email.toLowerCase().includes(query) ||
      u.firstName?.toLowerCase().includes(query) ||
      u.lastName?.toLowerCase().includes(query) ||
      `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase().includes(query)
    );
  }, [users, searchQuery]);

  const selectedUser = useMemo(() => {
    if (!selectedUserId || !users) return null;
    return users.find((u: User) => u.id === selectedUserId) || null;
  }, [selectedUserId, users]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    updateLimit.mutate(maxUsers);
  };

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createUserMutation.mutate(newUser, {
      onSuccess: () => {
        setNewUser({ email: '', password: '', firstName: '', lastName: '', phone: '', role: USER_ROLES.USER });
        setShowCreateUserForm(false);
      },
    });
  };

  const handleEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditUser({
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      role: user.role,
    });
  };

  const handleUpdateUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingUserId) return;
    
    try {
      await updateUserMutation.mutateAsync({
        id: editingUserId,
        data: editUser,
      });
      setEditingUserId(null);
      setSelectedUserId(null);
    } catch (error) {
      console.error('Update error:', error);
    }
  };

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-500">
        Bu bölməyə yalnız admin istifadəçilər daxil ola bilər.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Admin idarəetməsi</h2>
        <p className="text-sm text-slate-500">Qeydiyyat limitlərini və istifadəçi siyahısını idarə edin.</p>
      </div>

      <div className={`grid gap-6 ${isAdmin ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
        {isAdmin && (
          <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Qeydiyyat limiti</h3>
              <p className="text-sm text-slate-500">
                Sistemə maksimum neçə istifadəçi qeydiyyatdan keçə bilər.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-600">Maksimum istifadəçi sayı</label>
              <input
                type="number"
                min={1}
                value={maxUsers}
                onChange={(event) => setMaxUsers(Number(event.target.value))}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              disabled={updateLimit.isPending}
            >
              {updateLimit.isPending ? 'Yenilənir...' : 'Limiti yenilə'}
            </button>
            {isConfigLoading ? (
              <div className="text-xs text-slate-500">Hazırkı limit yüklənir...</div>
            ) : config ? (
              <div className="text-xs text-slate-500">
                Cari limit: <span className="font-semibold text-slate-900">{config.maxUsers}</span> istifadəçi
              </div>
            ) : null}
            {updateLimit.isSuccess ? <div className="text-xs text-success">Limit uğurla yeniləndi.</div> : null}
          </form>
        )}

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">İstifadəçilər</h3>
              <p className="text-sm text-slate-500">Sistemdə aktiv olan istifadəçilərin siyahısı.</p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowCreateUserForm(!showCreateUserForm)}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                {showCreateUserForm ? 'Ləğv et' : '+ Yeni istifadəçi'}
              </button>
            )}
          </div>

          {/* Axtarış */}
          <div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="İstifadəçi adı və ya email ilə axtar..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {isAdmin && showCreateUserForm ? (
            <form onSubmit={handleCreateUser} className="border-t border-slate-200 pt-4 space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Email</label>
                <input
                  type="email"
                  required
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Şifrə</label>
                <input
                  type="password"
                  required
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-600">Ad</label>
                  <input
                    type="text"
                    value={newUser.firstName}
                    onChange={(e) => setNewUser({ ...newUser, firstName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600">Soyad</label>
                  <input
                    type="text"
                    value={newUser.lastName}
                    onChange={(e) => setNewUser({ ...newUser, lastName: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Telefon</label>
                <input
                  type="tel"
                  value={newUser.phone}
                  onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="+994 XX XXX XX XX"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Rol</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={USER_ROLES.USER}>Mağazin</option>
                  <option value={USER_ROLES.BRANCH_MANAGER}>İkinci Admin</option>
                  {user?.role === USER_ROLES.SUPER_ADMIN ? (
                    <option value={USER_ROLES.SUPER_ADMIN}>Super Admin</option>
                  ) : null}
                </select>
              </div>
              <button
                type="submit"
                disabled={createUserMutation.isPending}
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {createUserMutation.isPending ? 'Yaradılır...' : 'Yarat'}
              </button>
            </form>
          ) : null}

          {/* İstifadəçi siyahısı */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {isUsersLoading ? (
              <div className="text-sm text-slate-500">Yüklənir...</div>
            ) : filteredUsers && filteredUsers.length > 0 ? (
              filteredUsers.map((userItem: User) => (
                <div 
                  key={userItem.id} 
                  className={`py-3 cursor-pointer hover:bg-slate-50 ${selectedUserId === userItem.id ? 'bg-primary-50' : ''}`}
                  onClick={() => setSelectedUserId(userItem.id === selectedUserId ? null : userItem.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-slate-900">
                        {userItem.firstName || userItem.lastName 
                          ? `${userItem.firstName || ''} ${userItem.lastName || ''}`.trim()
                          : userItem.email}
                      </div>
                      <div className="text-xs text-slate-500">
                        {userItem.email} · Rol: {userItem.role}
                        {userItem.phone && ` · Tel: ${userItem.phone}`}
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditUser(userItem);
                        }}
                        className="ml-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Redaktə
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">İstifadəçi tapılmadı.</div>
            )}
          </div>
        </div>
      </div>

      {/* İstifadəçi detalları */}
      {selectedUser && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">İstifadəçi məlumatları</h3>
            <button
              onClick={() => setSelectedUserId(null)}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-600">Email</label>
              <div className="text-sm text-slate-900">{selectedUser.email}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Ad</label>
                <div className="text-sm text-slate-900">{selectedUser.firstName || '-'}</div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Soyad</label>
                <div className="text-sm text-slate-900">{selectedUser.lastName || '-'}</div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Telefon</label>
              <div className="text-sm text-slate-900">{selectedUser.phone || '-'}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600">Rol</label>
              <div className="text-sm text-slate-900">{selectedUser.role}</div>
            </div>
            {isAdmin && (
              <button
                onClick={() => handleEditUser(selectedUser)}
                className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Redaktə et
              </button>
            )}
          </div>
        </div>
      )}

      {/* Redaktə formu */}
      {editingUserId && selectedUser && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">İstifadəçini redaktə et</h3>
            <button
              onClick={() => {
                setEditingUserId(null);
                setEditUser({ email: '', firstName: '', lastName: '', phone: '', role: USER_ROLES.USER });
              }}
              className="text-slate-500 hover:text-slate-700"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleUpdateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Email *</label>
              <input
                type="email"
                required
                value={editUser.email}
                onChange={(e) => setEditUser({ ...editUser, email: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Ad</label>
                <input
                  type="text"
                  value={editUser.firstName}
                  onChange={(e) => setEditUser({ ...editUser, firstName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Soyad</label>
                <input
                  type="text"
                  value={editUser.lastName}
                  onChange={(e) => setEditUser({ ...editUser, lastName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Telefon</label>
              <input
                type="tel"
                value={editUser.phone}
                onChange={(e) => setEditUser({ ...editUser, phone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="+994 XX XXX XX XX"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Rol</label>
              <select
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value as UserRole })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={USER_ROLES.USER}>Mağazin</option>
                <option value={USER_ROLES.BRANCH_MANAGER}>İkinci Admin</option>
                {user?.role === USER_ROLES.SUPER_ADMIN ? (
                  <option value={USER_ROLES.SUPER_ADMIN}>Super Admin</option>
                ) : null}
              </select>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updateUserMutation.isPending}
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-60"
              >
                {updateUserMutation.isPending ? 'Yenilənir...' : 'Yenilə'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingUserId(null);
                  setEditUser({ email: '', firstName: '', lastName: '', phone: '', role: USER_ROLES.USER });
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Ləğv et
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
