import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { prApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { PrStatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import type { PurchaseRequest, PaginationMeta } from '@/types';

const priorities: Record<string, string> = { low: 'ນ້ອຍ', normal: 'ປົກກະຕິ', high: 'ສູງ', urgent: 'ດ່ວນ' };

export default function PurchaseRequestsPage() {
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('');
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['pr', page, status],
    queryFn:  () => prApi.list({ page, limit: 20, status: status || undefined }),
  });

  const rows: PurchaseRequest[] = (data?.data as { data: PurchaseRequest[] } | undefined)?.data ?? [];
  const meta: PaginationMeta | undefined = (data?.data as { pagination?: PaginationMeta } | undefined)?.pagination;

  const columns: Column<PurchaseRequest>[] = [
    { key: 'prNumber',    label: 'ເລກ PR',       className: 'font-mono font-semibold text-primary-700' },
    { key: 'requester',   label: 'ຜູ້ຂໍ',         render: (r) => r.requester?.fullName ?? '-' },
    { key: 'department',  label: 'ພະແນກ',        render: (r) => r.department ?? '-' },
    { key: 'priority',    label: 'ຄວາມຮີບດ່ວນ',  render: (r) => priorities[r.priority] ?? r.priority },
    { key: 'totalAmount', label: 'ຈຳນວນ (₭)',    render: (r) => Number(r.totalAmount).toLocaleString() },
    { key: 'status',      label: 'ສະຖານະ',       render: (r) => <PrStatusBadge status={r.status} /> },
    { key: 'createdAt',   label: 'ວັນທີ',         render: (r) => new Date(r.createdAt).toLocaleDateString('lo-LA') },
    { key: 'actions',     label: '',             render: (r) => (
      <button onClick={(e) => { e.stopPropagation(); navigate(`/purchase-requests/${r.id}`); }}
        className="p-1.5 hover:bg-gray-100 rounded-lg"><Eye className="w-4 h-4 text-gray-500" /></button>
    )},
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input w-48">
          {['', 'draft', 'finance_review', 'md_review', 'po_created', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s ? s.replace(/_/g, ' ') : 'ທຸກສະຖານະ'}</option>
          ))}
        </select>
        <Button onClick={() => navigate('/purchase-requests/new')}><Plus className="w-4 h-4" />ສ້າງ PR ໃໝ່</Button>
      </div>
      <Table<PurchaseRequest> columns={columns} data={rows} loading={isLoading} keyField="id" />
      {meta && <Pagination meta={meta} onChange={setPage} />}
    </div>
  );
}
