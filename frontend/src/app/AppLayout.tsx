import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import useAuth from '../hooks/useAuth';
import { USER_ROLES, type UserRole } from '../types';
import NotificationBell from '../components/notifications/NotificationBell';

const navItems: Array<{
  to: string;
  label: string;
  icon: string;
  roles: UserRole[] | null;
}> = [
  { to: '/products', label: 'Məhsullar', icon: '📦', roles: null },
  { to: '/cart', label: 'Səbət', icon: '🛒', roles: [USER_ROLES.USER] }, // Yalnız magazin paneli üçün
  { to: '/orders', label: 'Sifarişlər', icon: '🧾', roles: null }, // Hamı üçün
  {
    to: '/admin/stock-management',
    label: 'Stok idarəetməsi',
    icon: '📊',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.BRANCH_MANAGER], // Admin paneli üçün
  },
  {
    to: '/admin/product-substitutes',
    label: 'Məhsul əvəz ediciləri',
    icon: '🔄',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.BRANCH_MANAGER], // Admin paneli üçün
  },
  {
    to: '/admin/purchase-sales',
    label: 'Alqı-satqı',
    icon: '💰',
    roles: [USER_ROLES.SUPER_ADMIN, USER_ROLES.BRANCH_MANAGER], // Admin paneli üçün
  },
  { to: '/admin', label: 'Admin', icon: '⚙️', roles: [USER_ROLES.BRANCH_MANAGER, USER_ROLES.SUPER_ADMIN] },
];

export const AppLayout = () => {
  const { user, clearSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const filteredNav = useMemo(() => {
    return navItems.filter((item) => {
      if (!item.roles) return true;
      if (!user) return false;
      return item.roles.includes(user.role);
    });
  }, [user]);

  return (
    <div className="min-h-screen bg-slate-100 flex">
      <aside className="hidden md:flex md:w-64 bg-white border-r border-slate-200 flex-col">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <span className="text-lg font-semibold text-slate-900">Emil 1223</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          {filteredNav.map((item) => {
            // "Alqı-satqı" üçün exact match tələb edək
            const needsExactMatch = item.to === '/admin/purchase-sales';
            
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={needsExactMatch}
                className={({ isActive }: { isActive: boolean }) => {
                  // Əgər exact match lazımdırsa, pathname tam uyğun olmalıdır
                  let actuallyActive = isActive;
                  if (needsExactMatch) {
                    actuallyActive = location.pathname === item.to;
                  }
                  return [
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                    actuallyActive ? 'bg-primary-100 text-primary-700' : 'text-slate-600 hover:bg-primary-50 hover:text-primary-600',
                  ].join(' ');
                }}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-6 py-4 border-t border-slate-200">
          <div className="text-sm text-slate-600">Filial: {user?.branch?.name ?? 'Hamısı'}</div>
          <button
            onClick={clearSession}
            className="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Çıxış
          </button>
        </div>
      </aside>
      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 md:px-8">
          <div>
            <div className="text-sm text-slate-500">Xoş gəldiniz</div>
            <div className="text-base font-semibold text-slate-900">{user?.email}</div>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              onClick={clearSession}
              className="md:hidden rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
            >
              Çıxış
            </button>
          </div>
        </header>
        <div className="md:hidden px-4 pt-3">
          <select
            value={location.pathname}
            onChange={(event) => navigate(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {filteredNav.map((item) => (
              <option key={item.to} value={item.to}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

