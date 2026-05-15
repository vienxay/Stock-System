import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AppLayout } from '@/components/layout/AppLayout';
import { Loader2 } from 'lucide-react';
import type { RoleCode } from '@/types';

const LoginPage            = lazy(() => import('@/pages/auth/LoginPage'));
const DashboardPage        = lazy(() => import('@/pages/dashboard/DashboardPage'));
const ProductsPage         = lazy(() => import('@/pages/products/ProductsPage'));
const CategoriesPage       = lazy(() => import('@/pages/categories/CategoriesPage'));
const SuppliersPage        = lazy(() => import('@/pages/suppliers/SuppliersPage'));
const PurchaseRequestsPage = lazy(() => import('@/pages/purchase-requests/PurchaseRequestsPage'));
const CreatePRPage         = lazy(() => import('@/pages/purchase-requests/CreatePRPage'));
const PRDetailPage         = lazy(() => import('@/pages/purchase-requests/PRDetailPage'));
const PurchaseOrdersPage   = lazy(() => import('@/pages/purchase-orders/PurchaseOrdersPage'));
const PODetailPage         = lazy(() => import('@/pages/purchase-orders/PODetailPage'));
const InvoicesPage         = lazy(() => import('@/pages/invoices/InvoicesPage'));
const StockMovementsPage   = lazy(() => import('@/pages/stock-movements/StockMovementsPage'));
const NotificationsPage    = lazy(() => import('@/pages/notifications/NotificationsPage'));
const UsersPage            = lazy(() => import('@/pages/users/UsersPage'));
const ReportsPage          = lazy(() => import('@/pages/reports/ReportsPage'));
const AuditLogsPage        = lazy(() => import('@/pages/audit/AuditLogsPage'));
const BackupPage           = lazy(() => import('@/pages/backup/BackupPage'));
const SettingsPage         = lazy(() => import('@/pages/settings/SettingsPage'));

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

// ─── ໜ້າທຳອິດຕາມ role ──────────────────────────────────────
const roleHome: Record<string, string> = {
  admin:      '/',
  user:       '/',
  finance:    '/',
  md:         '/',
  purchasing: '/',
  stock:      '/',
  ap:         '/',
};

// ─── Route permissions ──────────────────────────────────────
const routeRoles: Record<string, RoleCode[]> = {
  '/products':          ['admin', 'stock'],
  '/categories':        ['admin'],
  '/suppliers':         ['admin', 'purchasing', 'ap'],
  '/purchase-requests': ['admin', 'user', 'finance', 'md', 'purchasing'],
  '/purchase-orders':   ['admin', 'stock', 'purchasing', 'finance', 'md'],
  '/invoices':          ['admin', 'ap'],
  '/stock-movements':   ['admin', 'stock'],
};

function Spinner() {
  return (
    <div className="flex-1 flex items-center justify-center h-full">
      <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
    </div>
  );
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken);
  return token ? <>{children}</> : <Navigate to="/login" replace />;
}

// ─── Guard ຕາມ role ─────────────────────────────────────────
function RoleGuard({ roles, children }: { roles: RoleCode[]; children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role.code as RoleCode)) {
    // redirect ໄປໜ້າທຳອິດຂອງ role ນັ້ນ
    const home = roleHome[user.role.code] ?? '/';
    return <Navigate to={home} replace />;
  }
  return <>{children}</>;
}

// ─── Guard ສຳລັບ root "/" — ທຸກ role ເຫັນ dashboard ──────────
function HomeRedirect() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Suspense fallback={<div className="min-h-screen flex"><Spinner /></div>}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
              {/* Dashboard — admin/finance/md ເຫັນ, ຄົນອື່ນ redirect */}
              <Route index element={<HomeRedirect />} />

              {/* ສິນຄ້າ — admin, stock */}
              <Route path="products" element={
                <RoleGuard roles={routeRoles['/products']}><ProductsPage /></RoleGuard>
              } />

              {/* ໝວດໝູ່ — admin only */}
              <Route path="categories" element={
                <RoleGuard roles={routeRoles['/categories']}><CategoriesPage /></RoleGuard>
              } />

              {/* ຈັດການ User — admin only */}
              <Route path="users" element={
                <RoleGuard roles={['admin']}><UsersPage /></RoleGuard>
              } />

              {/* Supplier — admin, purchasing, ap */}
              <Route path="suppliers" element={
                <RoleGuard roles={routeRoles['/suppliers']}><SuppliersPage /></RoleGuard>
              } />

              {/* PR — admin, user, finance, md, purchasing */}
              <Route path="purchase-requests" element={
                <RoleGuard roles={routeRoles['/purchase-requests']}><PurchaseRequestsPage /></RoleGuard>
              } />
              <Route path="purchase-requests/new" element={
                <RoleGuard roles={['admin', 'user', 'purchasing']}><CreatePRPage /></RoleGuard>
              } />
              <Route path="purchase-requests/:id" element={
                <RoleGuard roles={routeRoles['/purchase-requests']}><PRDetailPage /></RoleGuard>
              } />

              {/* PO — admin, stock, purchasing */}
              <Route path="purchase-orders" element={
                <RoleGuard roles={routeRoles['/purchase-orders']}><PurchaseOrdersPage /></RoleGuard>
              } />
              <Route path="purchase-orders/:id" element={
                <RoleGuard roles={routeRoles['/purchase-orders']}><PODetailPage /></RoleGuard>
              } />

              {/* Invoice — admin, ap */}
              <Route path="invoices" element={
                <RoleGuard roles={routeRoles['/invoices']}><InvoicesPage /></RoleGuard>
              } />

              {/* Stock Movement — admin, stock */}
              <Route path="stock-movements" element={
                <RoleGuard roles={routeRoles['/stock-movements']}><StockMovementsPage /></RoleGuard>
              } />

              {/* ຕັ້ງຄ່າລະບົບ — admin only */}
              <Route path="settings" element={
                <RoleGuard roles={['admin']}><SettingsPage /></RoleGuard>
              } />

              {/* ລາຍງານ — admin, finance, md, ap, purchasing */}
              <Route path="reports" element={
                <RoleGuard roles={['admin', 'finance', 'md', 'ap', 'purchasing', 'stock']}>
                  <ReportsPage />
                </RoleGuard>
              } />

              {/* Audit Log — admin only */}
              <Route path="audit-logs" element={
                <RoleGuard roles={['admin']}><AuditLogsPage /></RoleGuard>
              } />

              {/* Backup — admin only */}
              <Route path="backup" element={
                <RoleGuard roles={['admin']}><BackupPage /></RoleGuard>
              } />

              {/* ແຈ້ງເຕືອນ — ທຸກ role */}
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
    </QueryClientProvider>
  );
}
