import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Tag } from 'lucide-react';
import toast from 'react-hot-toast';
import { categoryApi } from '@/api/endpoints';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import type { Category } from '@/types';

interface FormState {
  code:     string;
  nameLo:   string;
  nameEn:   string;
  parentId: string;
  isActive: boolean;
}

const defaultForm: FormState = { code: '', nameLo: '', nameEn: '', parentId: '', isActive: true };

export default function CategoriesPage() {
  const qc      = useQueryClient();
  const user    = useAuthStore((s) => s.user);
  const isAdmin = user?.role.code === 'admin';

  const [modalOpen,   setModalOpen]   = useState(false);
  const [editTarget,  setEditTarget]  = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [form,        setForm]        = useState<FormState>(defaultForm);

  const { data, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn:  () => categoryApi.list(),
  });

  const rows: Category[] = (data?.data as { data: Category[] } | undefined)?.data ?? [];

  // ─── parent name lookup ────────────────────────────────────
  const parentMap = new Map(rows.map((c) => [c.id, c.nameLo]));
  const parentOptions = rows.filter((c) => !c.parentId); // ສະເພາະ root

  // ─── Open create modal ─────────────────────────────────────
  const openCreate = () => {
    setEditTarget(null);
    setForm(defaultForm);
    setModalOpen(true);
  };

  // ─── Open edit modal ───────────────────────────────────────
  const openEdit = (cat: Category) => {
    setEditTarget(cat);
    setForm({
      code:     cat.code,
      nameLo:   cat.nameLo,
      nameEn:   cat.nameEn ?? '',
      parentId: cat.parentId ? String(cat.parentId) : '',
      isActive: cat.isActive,
    });
    setModalOpen(true);
  };

  // ─── Mutations ─────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: () => categoryApi.create({
      code:     form.code,
      nameLo:   form.nameLo,
      nameEn:   form.nameEn || undefined,
      parentId: form.parentId ? Number(form.parentId) : undefined,
    }),
    onSuccess: () => {
      toast.success('ເພີ່ມໝວດໝູ່ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setModalOpen(false);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const updateMut = useMutation({
    mutationFn: () => categoryApi.update(editTarget!.id, {
      nameLo:   form.nameLo,
      nameEn:   form.nameEn || undefined,
      parentId: form.parentId ? Number(form.parentId) : null,
      isActive: form.isActive,
    }),
    onSuccess: () => {
      toast.success('ແກ້ໄຂໝວດໝູ່ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setModalOpen(false);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const deleteMut = useMutation({
    mutationFn: () => categoryApi.remove(deleteTarget!.id),
    onSuccess: () => {
      toast.success('ລົບໝວດໝູ່ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['categories'] });
      setDeleteTarget(null);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ');
      setDeleteTarget(null);
    },
  });

  const f = (k: keyof FormState, v: string | boolean) =>
    setForm((p) => ({ ...p, [k]: v }));

  const isBusy = createMut.isPending || updateMut.isPending;

  // ─── Group: root categories + children ────────────────────
  const roots    = rows.filter((c) => !c.parentId);
  const childMap = new Map<number, Category[]>();
  rows.filter((c) => c.parentId).forEach((c) => {
    const arr = childMap.get(c.parentId!) ?? [];
    arr.push(c);
    childMap.set(c.parentId!, arr);
  });

  return (
    <div className="space-y-4">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">ໝວດໝູ່ສິນຄ້າ</h2>
          <p className="text-sm text-gray-500">ທັງໝົດ {rows.length} ໝວດໝູ່</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4" />ເພີ່ມໝວດໝູ່
          </Button>
        )}
      </div>

      {/* ─── Category Tree ─── */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : roots.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>ຍັງບໍ່ມີໝວດໝູ່</p>
        </div>
      ) : (
        <div className="space-y-3">
          {roots.map((root) => (
            <div key={root.id} className="card p-0 overflow-hidden">
              {/* Root row */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary-100 flex items-center justify-center">
                    <Tag className="w-4 h-4 text-primary-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{root.nameLo}</span>
                      {root.nameEn && <span className="text-xs text-gray-400">({root.nameEn})</span>}
                      <Badge variant={root.isActive ? 'green' : 'gray'}>
                        {root.isActive ? 'ໃຊ້ງານ' : 'ປິດ'}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400 font-mono">{root.code}</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEdit(root)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="ແກ້ໄຂ"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(root)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="ລົບ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Children rows */}
              {(childMap.get(root.id) ?? []).map((child) => (
                <div key={child.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-5 ml-3 border-l-2 border-b-2 border-gray-200 h-4 rounded-bl" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-800">{child.nameLo}</span>
                        {child.nameEn && <span className="text-xs text-gray-400">({child.nameEn})</span>}
                        <Badge variant={child.isActive ? 'green' : 'gray'}>
                          {child.isActive ? 'ໃຊ້ງານ' : 'ປິດ'}
                        </Badge>
                      </div>
                      <p className="text-xs text-gray-400 font-mono">{child.code}</p>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        onClick={() => openEdit(child)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                        title="ແກ້ໄຂ"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(child)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="ລົບ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}

          {/* Orphan categories (parentId set but parent not found / inactive) */}
          {rows.filter((c) => c.parentId && !parentMap.has(c.parentId)).map((orphan) => (
            <div key={orphan.id} className="card flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                  <Tag className="w-4 h-4 text-gray-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-800">{orphan.nameLo}</span>
                    <Badge variant="gray">ບໍ່ມີໝວດຫຼັກ</Badge>
                  </div>
                  <p className="text-xs text-gray-400 font-mono">{orphan.code}</p>
                </div>
              </div>
              {isAdmin && (
                <div className="flex gap-1">
                  <button onClick={() => openEdit(orphan)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteTarget(orphan)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ─── Create / Edit Modal ─── */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editTarget ? `ແກ້ໄຂ: ${editTarget.nameLo}` : 'ເພີ່ມໝວດໝູ່ໃໝ່'}
        size="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Code — readonly when editing */}
            <div>
              <label className="label">ລະຫັດ *</label>
              <input
                className="input font-mono"
                placeholder="e.g. ELEC"
                value={form.code}
                disabled={!!editTarget}
                onChange={(e) => f('code', e.target.value.toUpperCase())}
              />
              {editTarget && <p className="text-xs text-gray-400 mt-1">ລະຫັດບໍ່ສາມາດປ່ຽນໄດ້</p>}
            </div>

            {/* Parent */}
            <div>
              <label className="label">ໝວດຫຼັກ</label>
              <select
                className="input"
                value={form.parentId}
                onChange={(e) => f('parentId', e.target.value)}
                disabled={!!editTarget && !form.parentId && (childMap.get(editTarget.id) ?? []).length > 0}
              >
                <option value="">— ໝວດຫຼັກ (ບໍ່ມີ parent) —</option>
                {parentOptions
                  .filter((p) => p.id !== editTarget?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.nameLo}</option>
                  ))}
              </select>
            </div>

            {/* Name LO */}
            <div>
              <label className="label">ຊື່ (ລາວ) *</label>
              <input
                className="input"
                placeholder="ຊື່ໝວດໝູ່..."
                value={form.nameLo}
                onChange={(e) => f('nameLo', e.target.value)}
              />
            </div>

            {/* Name EN */}
            <div>
              <label className="label">ຊື່ (ອັງກິດ)</label>
              <input
                className="input"
                placeholder="Category name..."
                value={form.nameEn}
                onChange={(e) => f('nameEn', e.target.value)}
              />
            </div>

            {/* isActive — edit only */}
            {editTarget && (
              <div className="col-span-2">
                <label className="label">ສະຖານະ</label>
                <select className="input" value={form.isActive ? '1' : '0'} onChange={(e) => f('isActive', e.target.value === '1')}>
                  <option value="1">ໃຊ້ງານ</option>
                  <option value="0">ປິດ</option>
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>ຍົກເລີກ</Button>
            <Button
              loading={isBusy}
              disabled={!form.code || !form.nameLo}
              onClick={() => editTarget ? updateMut.mutate() : createMut.mutate()}
            >
              {editTarget ? 'ບັນທຶກການແກ້ໄຂ' : 'ເພີ່ມໝວດໝູ່'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Delete Confirm Modal ─── */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="ຢືນຢັນການລົບ"
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
            <Trash2 className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                ລົບ "{deleteTarget?.nameLo}"?
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                ຖ້າໝວດໝູ່ນີ້ມີສິນຄ້າ ຫຼື ໝວດຍ່ອຍ — ລະບົບຈະບໍ່ອະນຸຍາດໃຫ້ລົບ
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
              <Trash2 className="w-4 h-4" />ລົບ
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
