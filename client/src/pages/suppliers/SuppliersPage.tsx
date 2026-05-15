import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { supplierApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { SupplierFormModal } from './SupplierFormModal';
import { useAuthStore } from '@/stores/authStore';
import type { Supplier } from '@/types';

export default function SuppliersPage() {
  const qc      = useQueryClient();
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role.code === 'admin';

  const [search,       setSearch]       = useState('');
  const [formOpen,     setForm]         = useState(false);
  const [editing,      setEditing]      = useState<Supplier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn:  () => supplierApi.list({ search: search || undefined }),
  });

  const rows: Supplier[] = (data?.data as { data: Supplier[] } | undefined)?.data ?? [];

  const openAdd  = () => { setEditing(null); setForm(true); };
  const openEdit = (s: Supplier) => { setEditing(s); setForm(true); };

  const deleteMut = useMutation({
    mutationFn: () => supplierApi.remove(deleteTarget!.id),
    onSuccess: (res) => {
      const msg = (res?.data as { message?: string } | undefined)?.message ?? 'ສຳເລັດ';
      toast.success(msg);
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setDeleteTarget(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ');
      setDeleteTarget(null);
    },
  });

  const columns: Column<Supplier>[] = [
    { key: 'code',        label: 'ລະຫັດ',        className: 'font-mono text-xs w-24' },
    { key: 'name',        label: 'ຊື່ Supplier' },
    { key: 'contactName', label: 'ຜູ້ຕິດຕໍ່',     render: (r) => r.contactName ?? '-' },
    { key: 'phone',       label: 'ເບີໂທ',         render: (r) => r.phone  ?? '-' },
    { key: 'email',       label: 'Email',          render: (r) => r.email  ?? '-' },
    { key: 'paymentTerm', label: 'ເງື່ອນໄຂຊຳລະ',  render: (r) => `${r.paymentTerm} ວັນ` },
    { key: 'isActive',   label: 'ສະຖານະ',         render: (r) => <Badge variant={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'ໃຊ້ງານ' : 'ປິດ'}</Badge> },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => openEdit(r)}
            className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors text-gray-400 hover:text-blue-600"
            title="ແກ້ໄຂ"
          >
            <Pencil className="w-4 h-4" />
          </button>
          {isAdmin && (
            <button
              onClick={() => setDeleteTarget(r)}
              className="p-1.5 hover:bg-red-50 rounded-lg transition-colors text-gray-400 hover:text-red-600"
              title="ລົບ"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="input pl-9" placeholder="ຄົ້ນຫາ supplier..." />
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />ເພີ່ມ Supplier
        </Button>
      </div>

      <Table<Supplier>
        columns={columns}
        data={rows}
        loading={isLoading}
        keyField="id"
        onRowClick={openEdit}
      />

      {/* ─── Form Modal ─── */}
      <SupplierFormModal
        open={formOpen}
        onClose={() => { setForm(false); setEditing(null); }}
        supplier={editing}
      />

      {/* ─── Delete Confirm Modal ─── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="ຢືນຢັນການລົບ / ປິດ Supplier"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                ລົບ "{deleteTarget?.name}"?
              </p>
              <p className="text-xs text-red-600 mt-1">
                ຖ້າ Supplier ນີ້ມີ PO ຜູກຢູ່ — ລະບົບຈະ<strong>ປິດ</strong>ການໃຊ້ງານແທນການລົບ
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>ຍົກເລີກ</Button>
            <Button
              loading={deleteMut.isPending}
              onClick={() => deleteMut.mutate()}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Trash2 className="w-4 h-4" />ຢືນຢັນ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
