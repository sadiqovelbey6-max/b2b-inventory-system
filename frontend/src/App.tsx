import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './app/ProtectedRoute';
import AppLayout from './app/AppLayout';
import LoginPage from './features/auth/LoginPage';
import ProductsPage from './features/products/ProductsPage';
import OrdersPage from './features/orders/OrdersPage';
import AdminPage from './features/admin/AdminPage';
import StockManagementPage from './features/admin/StockManagementPage';
import { ProductSubstitutesPage } from './features/admin/ProductSubstitutesPage';
import PurchaseSalesPage from './features/admin/PurchaseSalesPage';
import MagazinCartPage from './features/cart/MagazinCartPage';
import DashboardPage from './features/dashboard/DashboardPage';
import InvoicesPage from './features/invoices/InvoicesPage';
import PaymentsPage from './features/payments/PaymentsPage';
import useAuth from './hooks/useAuth';
import { USER_ROLES } from './types';

function App() {
  const { isAuthenticated, user } = useAuth();
  
  // Default route: Magazin paneli üçün /orders, digərləri üçün /products
  const defaultRoute = user?.role === USER_ROLES.USER ? '/orders' : '/products';

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to={defaultRoute} replace /> : <LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to={defaultRoute} replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/cart" element={<MagazinCartPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/stock-management" element={<StockManagementPage />} />
          <Route path="/admin/product-substitutes" element={<ProductSubstitutesPage />} />
          <Route path="/admin/purchase-sales" element={<PurchaseSalesPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? defaultRoute : '/login'} replace />} />
    </Routes>
  );
}

export default App;
