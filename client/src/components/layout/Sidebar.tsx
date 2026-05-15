import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Tag, Truck, FileText,
  ShoppingCart, Receipt, ArrowLeftRight, Bell, X, LogOut, User, Users, BarChart2, Settings, Building2, Shield,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authApi, settingsApi } from '@/api/endpoints';
import type { RoleCode } from '@/types';

// ─── ກຳນົດ menu + ສິດທິທີ່ເຫັນ ──────────────────────────────
const nav: { to: string; icon: React.ElementType; label: string; roles: RoleCode[] }[] = [
  {
    to: '/', icon: LayoutDashboard, label: 'Dashboard',
    roles: ['admin', 'user', 'finance', 'md', 'stock', 'purchasing', 'ap'],
  },
  {
    to: '/products', icon: Package, label: 'ສິນຄ້າ',
    roles: ['admin', 'stock'],
  },
  {
    to: '/categories', icon: Tag, label: 'ໝວດໝູ່',
    roles: ['admin'],
  },
  {
    to: '/users', icon: Users, label: 'ຈັດການ Users',
    roles: ['admin'],
  },
  {
    to: '/suppliers', icon: Truck, label: 'Supplier',
    roles: ['admin', 'purchasing', 'ap'],
  },
  {
    to: '/purchase-requests', icon: FileText, label: 'ໃບຂໍຊື້ (PR)',
    roles: ['admin', 'user', 'finance', 'md', 'purchasing'],
  },
  {
    to: '/purchase-orders', icon: ShoppingCart, label: 'ໃບສັ່ງຊື້ (PO)',
    roles: ['admin', 'stock', 'purchasing', 'finance', 'md'],
  },
  {
    to: '/invoices', icon: Receipt, label: 'Invoice',
    roles: ['admin', 'ap'],
  },
  {
    to: '/stock-movements', icon: ArrowLeftRight, label: 'ການເຄື່ອນໄຫວ Stock',
    roles: ['admin', 'stock'],
  },
  {
    to: '/reports', icon: BarChart2, label: 'ລາຍງານ',
    roles: ['admin', 'finance', 'md', 'ap', 'purchasing', 'stock'],
  },
  {
    to: '/audit-logs', icon: Shield, label: 'Audit Log',
    roles: ['admin'],
  },
  {
    to: '/notifications', icon: Bell, label: 'ແຈ້ງເຕືອນ',
    roles: ['admin', 'user', 'finance', 'md', 'stock', 'purchasing', 'ap'],
  },
  {
    to: '/settings', icon: Settings, label: 'ຕັ້ງຄ່າລະບົບ',
    roles: ['admin'],
  },
];

// ─── Role badge colour ────────────────────────────────────────
const roleBadge: Record<string, string> = {
  admin:      'bg-red-500',
  finance:    'bg-emerald-600',
  md:         'bg-purple-600',
  stock:      'bg-orange-500',
  purchasing: 'bg-blue-600',
  ap:         'bg-teal-600',
  user:       'bg-gray-500',
};

interface Props { open: boolean; onClose: () => void; }

export function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();
  const role             = user?.role.code as RoleCode | undefined;

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.get(),
    staleTime: 5 * 60_000,
  });
  const settings = (settingsData?.data as { data: { companyName: string; companyNameEn?: string; logoUrl?: string } } | undefined)?.data;

  const visibleNav = role ? nav.filter((item) => item.roles.includes(role)) : [];

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-30 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${open ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo + Company */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3 min-w-0">
            {settings?.logoUrl
              ? <img src={settings.logoUrl} alt="logo"
                  className="w-10 h-10 rounded-xl object-contain bg-white/10 p-0.5 shrink-0" />
              : <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-white" />
                </div>
            }
            <div className="min-w-0">
              <p className="font-bold text-white text-sm truncate leading-tight">
                {settings?.companyName ?? 'ລະບົບສາງ'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {settings?.companyNameEn ?? 'PR-PO Management'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-gray-700 shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {visibleNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${roleBadge[role ?? ''] ?? 'bg-gray-600'}`}>
              <User className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName}</p>
              <p className="text-xs text-gray-400 truncate">{user?.role.nameLo}</p>
            </div>
          </div>
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
            <LogOut className="w-4 h-4" />
            ອອກຈາກລະບົບ
          </button>
        </div>
      </aside>
    </>
  );
}
