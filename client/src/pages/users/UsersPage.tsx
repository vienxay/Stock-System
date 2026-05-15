import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Pencil, KeyRound, Search, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { userApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { UserFormModal } from './UserFormModal';
import type { AppUser, RoleCode } from '@/types';

// ─── Role badge ───────────────────────────────────────────────
const roleVariant: Record<RoleCode, 'red' | 'green' | 'blue' | 'yellow' | 'purple' | 'orange' | 'gray'> = {
  admin:      'red',
  finance:    'green',
  md:         'purple',
  stock:      'orange',
  purchasing: 'blue',
  ap:         'green',
  user:       'gray',
};
const roleLabel: Record<RoleCode, string> = {
  admin: 'Admin', finance: 'Finance', md: 'MD',
  stock: 'Stock', purchasing: 'Purchasing', ap: 'AP', user: 'User',
};

export default function UsersPage() {
  const [search, setSearch]       = useState('');
  const [filterRole, setRole]     = useState('');
  const [formOpen, setFormOpen]   = useState(false);
  const [editing, setEditing]     = useState<AppUser | null>(null);
  const [resetUser, setResetUser] = useState<AppUser | null>(null);
  const [newPass, setNewPass]     = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['users', search, filterRole],
    queryFn:  () => userApi.list({ search: search || undefined, role: filterRole || undefined }),
  });

  const users: AppUser[] = (data?.data as { data: AppUser[] } | undefined)?.data ?? [];

  const resetMut = useMutation({
    mutationFn: () => userApi.resetPassword(resetUser!.id, newPass),
    onSuccess: () => {
      toast.success('Reset password ສຳເລັດ');
      setResetUser(null);
      setNewPass('');
    },
    onError: (e: { response?: { data?: { message?: string; errors?: { msg: string }[] } } }) =>
      toast.error(e?.response?.data?.errors?.[0]?.msg ?? e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const openAdd  = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (u: AppUser) => { setEditing(u); setFormOpen(true); };

  const columns: Column<AppUser>[] = [
    {
      key: 'username', label: 'Username',
      render: (r) => (
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white
            ${r.role.code === 'admin' ? 'bg-red-500' : r.role.code === 'md' ? 'bg-purple-600' : r.role.code === 'finance' ? 'bg-emerald-600' : r.role.code === 'stock' ? 'bg-orange-500' : r.role.code === 'purchasing' ? 'bg-blue-600' : r.role.code === 'ap' ? 'bg-teal-600' : 'bg-gray-500'}`}>
            {r.fullName.charAt(0).toUpperCase()}
          </div>
          <span className="font-mono text-sm font-medium">{r.username}</span>
        </div>
      ),
    },
    { key: 'fullName',   label: 'ຊື່ເຕັມ' },
    {
      key: 'role', label: 'ສິດທິ',
      render: (r) => (
        <Badge variant={roleVariant[r.role.code as RoleCode] ?? 'gray'}>
          <ShieldCheck className="w-3 h-3 mr-1 inline" />
          {roleLabel[r.role.code as RoleCode] ?? r.role.code}
        </Badge>
      ),
    },
    { key: 'department', label: 'ພະແນກ',    render: (r) => r.department ?? '-' },
    { key: 'email',      label: 'Email',     render: (r) => r.email ?? '-' },
    { key: 'phone',      label: 'ເບີໂທ',     render: (r) => r.phone ?? '-' },
    {
      key: 'isActive', label: 'ສະຖານະ',
      render: (r) => <Badge variant={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'ໃຊ້ງານ' : 'ປິດ'}</Badge>,
    },
    {
      key: 'actions', label: '',
      render: (r) => (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-primary-600 transition-colors" title="ແກ້ໄຂ">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setResetUser(r); setNewPass(''); }}
            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-orange-600 transition-colors" title="Reset Password">
            <KeyRound className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const roleOptions: { value: string; label: string }[] = [
    { value: '', label: 'ທຸກ Role' },
    { value: 'admin',      label: 'Admin' },
    { value: 'user',       label: 'User ທົ່ວໄປ' },
    { value: 'finance',    label: 'Finance' },
    { value: 'md',         label: 'MD' },
    { value: 'purchasing', label: 'Purchasing' },
    { value: 'stock',      label: 'Stock' },
    { value: 'ap',         label: 'AP' },
  ];

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'ທຸກ User', count: users.length, color: 'bg-gray-600' },
          { label: 'ໃຊ້ງານ', count: users.filter((u) => u.isActive).length, color: 'bg-green-600' },
          { label: 'ປິດ', count: users.filter((u) => !u.isActive).length, color: 'bg-red-500' },
          { label: 'Admin', count: users.filter((u) => u.role.code === 'admin').length, color: 'bg-purple-600' },
        ].map((s) => (
          <div key={s.label} className="card py-3 px-4 flex items-center gap-3">
            <div className={`w-8 h-8 ${s.color} rounded-lg flex items-center justify-center shrink-0`}>
              <span className="text-white text-sm font-bold">{s.count}</span>
            </div>
            <p className="text-sm text-gray-600">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 w-full sm:w-56" placeholder="ຄົ້ນຫາ username / ຊື່..." />
          </div>
          <select value={filterRole} onChange={(e) => setRole(e.target.value)} className="input w-40">
            {roleOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />ເພີ່ມ User ໃໝ່
        </Button>
      </div>

      <Table<AppUser> columns={columns} data={users} loading={isLoading} keyField="id" onRowClick={openEdit} />

      {/* Add / Edit modal */}
      <UserFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        user={editing}
      />

      {/* Reset Password modal */}
      <Modal open={!!resetUser} onClose={() => setResetUser(null)} title={`Reset Password: ${resetUser?.username}`} size="sm">
        <div className="space-y-4">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
            Password ໃໝ່ຈະຖືກ hash ແລ້ວບັນທຶກ — User ຕ້ອງ login ດ້ວຍ password ໃໝ່
          </div>
          <div>
            <label className="label">Password ໃໝ່ <span className="text-red-500">*</span></label>
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              className="input"
              placeholder="ຢ່າງໜ້ອຍ 8 ຕົວ"
            />
            {newPass.length > 0 && newPass.length < 8 && (
              <p className="text-red-500 text-xs mt-1">ຕ້ອງ 8 ຕົວຂຶ້ນໄປ</p>
            )}
          </div>
          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setResetUser(null)}>ຍົກເລີກ</Button>
            <Button
              variant="danger"
              disabled={newPass.length < 8}
              loading={resetMut.isPending}
              onClick={() => resetMut.mutate()}
            >
              <KeyRound className="w-4 h-4" />Reset Password
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
