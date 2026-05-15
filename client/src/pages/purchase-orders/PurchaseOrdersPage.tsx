import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { poApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { PoStatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { PurchaseOrder, PaginationMeta } from '@/types';

export default function PurchaseOrdersPage() {
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['po', page, status],
    queryFn:  () => poApi.list({ page, limit: 20, status: status || undefined }),
  });

  const rows: PurchaseOrder[] = (data?.data as { data: PurchaseOrder[] } | undefined)?.data ?? [];
  const meta: PaginationMeta | undefined = (data?.data as { pagination?: PaginationMeta } | undefined)?.pagination;

  const columns: Column<PurchaseOrder>[] = [
    { key: 'poNumber',    label: 'ເລກ PO',     className: 'font-mono font-semibold text-primary-700' },
    { key: 'supplier',    label: 'Supplier',   render: (r) => r.supplier?.name ?? '-' },
    { key: 'totalAmount', label: 'ຈຳນວນ (₭)',  render: (r) => Number(r.totalAmount).toLocaleString() },
    { key: 'status',      label: 'ສະຖານະ',     render: (r) => <PoStatusBadge status={r.status} /> },
    { key: 'creator',     label: 'ສ້າງໂດຍ',    render: (r) => r.creator?.fullName ?? '-' },
    { key: 'createdAt',   label: 'ວັນທີ',       render: (r) => new Date(r.createdAt).toLocaleDateString('lo-LA') },
    { key: 'actions',     label: '',           render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase-orders/${r.id}`); }}
        className="p-1.5 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4 text-gray-500" /></button>
    )},
  ];

  return (
    <div className="space-y-4">
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input w-48">
        {['', 'open', 'sent', 'partial_received', 'received', 'cancelled'].map((s) => (
          <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'ທຸກສະຖານະ'}</option>
        ))}
      </select>
      <Table<PurchaseOrder> columns={columns} data={rows} loading={isLoading} keyField="id" />
      {meta && <Pagination meta={meta} onChange={setPage} />}
    </div>
  );
}
