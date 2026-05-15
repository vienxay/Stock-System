import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard, Package, Tag, Truck, FileText,
  ShoppingCart, Receipt, ArrowLeftRight, Bell, X, LogOut, User,
  Users, BarChart2, Settings, Building2, Shield, Database,
  ChevronDown, ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { authApi, settingsApi } from '@/api/endpoints';
import type { RoleCode } from '@/types';

// ─── Nav item types ───────────────────────────────────────────
interface NavItem {
  to:    string;
  icon:  React.ElementType;
  label: string;
  roles: RoleCode[];
}
interface NavGroup {
  group:    true;
  icon:     React.ElementType;
  label:    string;
  roles:    RoleCode[];
  children: NavItem[];
}
type NavEntry = NavItem | NavGroup;

// ─── Nav config ───────────────────────────────────────────────
const nav: NavEntry[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard',
    roles: ['admin','user','finance','md','stock','purchasing','ap'] },
  { to: '/products', icon: Package, label: 'ສິນຄ້າ',
    roles: ['admin','stock'] },
  { to: '/categories', icon: Tag, label: 'ໝວດໝູ່',
    roles: ['admin'] },
  { to: '/users', icon: Users, label: 'ຈັດການ Users',
    roles: ['admin'] },
  { to: '/suppliers', icon: Truck, label: 'Supplier',
    roles: ['admin','purchasing','ap'] },
  { to: '/purchase-requests', icon: FileText, label: 'ໃບຂໍຊື້ (PR)',
    roles: ['admin','user','finance','md','purchasing'] },
  { to: '/purchase-orders', icon: ShoppingCart, label: 'ໃບສັ່ງຊື້ (PO)',
    roles: ['admin','stock','purchasing','finance','md'] },
  { to: '/invoices', icon: Receipt, label: 'Invoice',
    roles: ['admin','ap'] },
  { to: '/stock-movements', icon: ArrowLeftRight, label: 'ການເຄື່ອນໄຫວ Stock',
    roles: ['admin','stock'] },
  { to: '/reports', icon: BarChart2, label: 'ລາຍງານ',
    roles: ['admin','finance','md','ap','purchasing','stock'] },
  { to: '/notifications', icon: Bell, label: 'ແຈ້ງເຕືອນ',
    roles: ['admin','user','finance','md','stock','purchasing','ap'] },
  // ─── Dropdown group ──────────────────────────────────────────
  {
    group: true, icon: Settings, label: 'ຕັ້ງຄ່າ & ຈັດການ',
    roles: ['admin'],
    children: [
      { to: '/settings',   icon: Settings,  label: 'ຕັ້ງຄ່າລະບົບ', roles: ['admin'] },
      { to: '/audit-logs', icon: Shield,    label: 'Audit Log',     roles: ['admin'] },
      { to: '/backup',     icon: Database,  label: 'Backup ຂໍ້ມູນ', roles: ['admin'] },
    ],
  },
];

const roleBadge: Record<string, string> = {
  admin: 'bg-red-500', finance: 'bg-emerald-600', md: 'bg-purple-600',
  stock: 'bg-orange-500', purchasing: 'bg-blue-600', ap: 'bg-teal-600', user: 'bg-gray-500',
};

interface Props { open: boolean; onClose: () => void; }

export function Sidebar({ open, onClose }: Props) {
  const { user, logout } = useAuthStore();
  const navigate         = useNavigate();
  const location         = useLocation();
  const role             = user?.role.code as RoleCode | undefined;

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.get(),
    staleTime: 5 * 60_000,
  });
  const settings = (settingsData?.data as { data: { companyName: string; companyNameEn?: string; logoUrl?: string } } | undefined)?.data;

  // ─── Auto-expand group if current path matches child ─────────
  const groupPaths = (g: NavGroup) => g.children.map((c) => c.to);
  const defaultOpen = nav
    .filter((e): e is NavGroup => 'group' in e)
    .filter((g) => groupPaths(g).some((p) => location.pathname.startsWith(p)))
    .map((g) => g.label);
  const [openGroups, setOpenGroups] = useState<string[]>(defaultOpen);

  const toggleGroup = (label: string) =>
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );

  const visible = nav.filter((e) =>
    role && e.roles.includes(role)
  );

  const handleLogout = async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    logout();
    navigate('/login');
  };

  const linkCls = (isActive: boolean) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
    ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`;

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
          {visible.map((entry) => {
            // ─── Group ────────────────────────────────────────
            if ('group' in entry) {
              const isExpanded  = openGroups.includes(entry.label);
              const hasActive   = entry.children.some((c) => location.pathname.startsWith(c.to));
              const Icon        = entry.icon;
              const Chevron     = isExpanded ? ChevronDown : ChevronRight;
              const visibleKids = entry.children.filter((c) => role && c.roles.includes(role));
              if (!visibleKids.length) return null;
              return (
                <div key={entry.label}>
                  <button
                    onClick={() => toggleGroup(entry.label)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                      ${hasActive ? 'text-white bg-gray-800' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1 text-left">{entry.label}</span>
                    <Chevron className="w-3.5 h-3.5 shrink-0 transition-transform" />
                  </button>

                  {/* Sub-items */}
                  {isExpanded && (
                    <div className="ml-3 mt-0.5 pl-3 border-l border-gray-700 space-y-0.5">
                      {visibleKids.map(({ to, icon: CIcon, label }) => (
                        <NavLink key={to} to={to} onClick={onClose}
                          className={({ isActive }) => linkCls(isActive)}>
                          <CIcon className="w-4 h-4 shrink-0" />
                          {label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            // ─── Regular item ─────────────────────────────────
            const Icon = entry.icon;
            return (
              <NavLink key={entry.to} to={entry.to} end={entry.to === '/'} onClick={onClose}
                className={({ isActive }) => linkCls(isActive)}>
                <Icon className="w-4 h-4 shrink-0" />
                {entry.label}
              </NavLink>
            );
          })}
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
            <LogOut className="w-4 h-4" />ອອກຈາກລະບົບ
          </button>
        </div>
      </aside>
    </>
  );
}
