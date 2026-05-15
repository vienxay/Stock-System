import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

const titles: Record<string, string> = {
  '/':                  'Dashboard',
  '/products':          'ສິນຄ້າ',
  '/categories':        'ໝວດໝູ່ສິນຄ້າ',
  '/suppliers':         'Supplier',
  '/purchase-requests': 'ໃບຂໍຊື້ (PR)',
  '/purchase-orders':   'ໃບສັ່ງຊື້ (PO)',
  '/invoices':          'Invoice',
  '/stock-movements':   'ການເຄື່ອນໄຫວ Stock',
  '/notifications':     'ການແຈ້ງເຕືອນ',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { pathname } = useLocation();

  const title = Object.entries(titles).find(([k]) => pathname === k || (k !== '/' && pathname.startsWith(k)))?.[1] ?? 'ລະບົບສາງ';

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} title={title} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
