import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Send, XCircle, CheckCircle, XOctagon, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { prApi, supplierApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import { PrStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import type { Supplier } from '@/types';

interface PRDetail {
  id: number; prNumber: string; status: string; priority: string;
  department?: string; purpose?: string; note?: string;
  requiredDate?: string; totalAmount: number; createdAt: string;
  requester: { fullName: string; department?: string };
  items: {
    id: number; quantity: number; unitPrice: number; note?: string;
    product: { code: string; nameLo: string; unit: { nameLo: string } };
    supplier?: { name: string };
  }[];
  approvals: {
    id: number; level: number; decision: string; comment?: string; actedAt?: string;
    approver: { fullName: string };
  }[];
  purchaseOrder?: { id: number; poNumber: string; status: string };
}

const priorities: Record<string, string> = { low: 'ນ້ອຍ', normal: 'ປົກກະຕິ', high: 'ສູງ', urgent: 'ດ່ວນ' };

export default function PRDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const user     = useAuthStore((s) => s.user);
  const [createPoOpen, setCreatePoOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pr', id],
    queryFn:  () => prApi.get(Number(id)),
  });

  const { data: supData } = useQuery({
    queryKey: ['suppliers'],
    queryFn:  () => supplierApi.list(),
    enabled:  createPoOpen,
  });
  const suppliers: Supplier[] = (supData?.data as { data: Supplier[] } | undefined)?.data ?? [];

  const pr: PRDetail | undefined = (data?.data as { data: PRDetail } | undefined)?.data;

  const invalidate = () => qc.invalidateQueries({ queryKey: ['pr'] });

  const submitMut = useMutation({
    mutationFn: () => prApi.submit(Number(id)),
    onSuccess:  () => { toast.success('ສົ່ງ PR ສຳເລັດ'); invalidate(); },
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const cancelMut = useMutation({
    mutationFn: () => prApi.cancel(Number(id)),
    onSuccess:  () => { toast.success('ຍົກເລີກ PR ສຳເລັດ'); invalidate(); navigate('/purchase-requests'); },
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const approveMut = useMutation({
    mutationFn: (decision: 'approved' | 'rejected') =>
      prApi.approve(Number(id), { decision }),
    onSuccess: () => { toast.success('ດຳເນີນການສຳເລັດ'); invalidate(); },
    onError:   (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const createPoMut = useMutation({
    mutationFn: () => prApi.createPO(Number(id), Number(selectedSupplier)),
    onSuccess: (res) => {
      const po = (res.data as { data: { poNumber: string } }).data;
      toast.success(`ສ້າງ ${po.poNumber} ສຳເລັດ`);
      invalidate();
      qc.invalidateQueries({ queryKey: ['po'] });
      setCreatePoOpen(false);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const role      = user?.role.code ?? '';
  const isAdmin   = role === 'admin';

  const canSubmit   = pr?.status === 'draft'
    && (isAdmin || pr.requester.fullName === user?.fullName);
  const canCancel   = ['draft', 'finance_review', 'md_review'].includes(pr?.status ?? '')
    && (isAdmin || pr?.requester.fullName === user?.fullName);
  const canApprove  =
    (role === 'finance' && pr?.status === 'finance_review') ||
    (role === 'md'      && pr?.status === 'md_review')      ||
    (isAdmin && ['finance_review', 'md_review'].includes(pr?.status ?? ''));
  const canCreatePO = pr?.status === 'md_approved' && ['purchasing', 'admin'].includes(role);

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">ກຳລັງໂຫຼດ...</div>
  );
  if (!pr) return (
    <div className="text-center py-20 text-gray-400">ບໍ່ພົບ PR</div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/purchase-requests')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-primary-700 font-mono">{pr.prNumber}</h2>
              <PrStatusBadge status={pr.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              ສ້າງໂດຍ {pr.requester.fullName} · {new Date(pr.createdAt).toLocaleDateString('lo-LA')}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 flex-wrap">
          {canSubmit && (
            <Button loading={submitMut.isPending} onClick={() => submitMut.mutate()}>
              <Send className="w-4 h-4" />ສົ່ງເພື່ອອະນຸມັດ
            </Button>
          )}
          {canCreatePO && (
            <Button onClick={() => { setSelectedSupplier(''); setCreatePoOpen(true); }}>
              <ShoppingCart className="w-4 h-4" />ສ້າງ PO
            </Button>
          )}
          {canApprove && ['finance_review', 'md_review'].includes(pr.status) && (
            <>
              <Button variant="danger" loading={approveMut.isPending}
                onClick={() => approveMut.mutate('rejected')}>
                <XOctagon className="w-4 h-4" />ປະຕິເສດ
              </Button>
              <Button loading={approveMut.isPending}
                onClick={() => approveMut.mutate('approved')}>
                <CheckCircle className="w-4 h-4" />ອະນຸມັດ
              </Button>
            </>
          )}
          {canCancel && (
            <Button variant="secondary" loading={cancelMut.isPending}
              onClick={() => { if (confirm('ຢືນຢັນຍົກເລີກ PR?')) cancelMut.mutate(); }}>
              <XCircle className="w-4 h-4" />ຍົກເລີກ
            </Button>
          )}
        </div>
      </div>

      {/* PO created notice */}
      {pr.purchaseOrder && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600 shrink-0" />
          ສ້າງ PO ແລ້ວ:
          <button onClick={() => navigate(`/purchase-orders/${pr.purchaseOrder!.id}`)}
            className="font-mono font-bold underline hover:text-green-900">
            {pr.purchaseOrder.poNumber}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main */}
        <div className="lg:col-span-2 space-y-5">

          {/* Info */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">ຂໍ້ມູນທົ່ວໄປ</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-500">ພະແນກ:</span> <span className="font-medium">{pr.department ?? '-'}</span></div>
              <div><span className="text-gray-500">ຄວາມຮີບດ່ວນ:</span> <span className="font-medium">{priorities[pr.priority] ?? pr.priority}</span></div>
              <div><span className="text-gray-500">ວັນທີຕ້ອງການ:</span> <span className="font-medium">{pr.requiredDate ? new Date(pr.requiredDate).toLocaleDateString('lo-LA') : '-'}</span></div>
              <div><span className="text-gray-500">ຜູ້ຂໍ:</span> <span className="font-medium">{pr.requester.fullName}</span></div>
            </div>
            {pr.purpose && (
              <div className="text-sm">
                <span className="text-gray-500">ຈຸດປະສົງ: </span>{pr.purpose}
              </div>
            )}
            {pr.note && (
              <div className="text-sm">
                <span className="text-gray-500">ໝາຍເຫດ: </span>{pr.note}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-3">ລາຍການສິນຄ້າ</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['#', 'ສິນຄ້າ', 'ຈຳນວນ', 'ລາຄາ/ໜ່ວຍ', 'ລວມ', 'Supplier'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {pr.items.map((item, i) => (
                    <tr key={item.id}>
                      <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium">{item.product.nameLo}</p>
                        <p className="text-xs text-gray-400 font-mono">{item.product.code}</p>
                      </td>
                      <td className="px-3 py-2.5">{item.quantity.toLocaleString()} {item.product.unit.nameLo}</td>
                      <td className="px-3 py-2.5">{Number(item.unitPrice).toLocaleString()} ₭</td>
                      <td className="px-3 py-2.5 font-semibold">
                        {(item.quantity * Number(item.unitPrice)).toLocaleString()} ₭
                      </td>
                      <td className="px-3 py-2.5 text-gray-500">{item.supplier?.name ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-gray-700">ລວມທັງໝົດ:</td>
                    <td colSpan={2} className="px-3 py-2.5 font-bold text-primary-700 text-base">
                      {Number(pr.totalAmount).toLocaleString()} ₭
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar — Approvals */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-3">ການອະນຸມັດ</h3>
            {pr.approvals.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">ຍັງບໍ່ມີການອະນຸມັດ</p>
            ) : (
              <div className="space-y-3">
                {pr.approvals.map((a) => (
                  <div key={a.id} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {a.level === 1 ? 'Finance' : 'MD'}: {a.approver.fullName}
                      </span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${a.decision === 'approved' ? 'bg-green-100 text-green-700'
                          : a.decision === 'rejected' ? 'bg-red-100 text-red-700'
                          : 'bg-yellow-100 text-yellow-700'}`}>
                        {a.decision === 'approved' ? 'ອະນຸມັດ' : a.decision === 'rejected' ? 'ປະຕິເສດ' : 'ລໍຖ້າ'}
                      </span>
                    </div>
                    {a.comment && <p className="text-gray-500 text-xs mt-1 italic">"{a.comment}"</p>}
                    {a.actedAt && <p className="text-gray-400 text-xs mt-0.5">{new Date(a.actedAt).toLocaleString('lo-LA')}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Create PO Modal ─── */}
      <Modal open={createPoOpen} onClose={() => setCreatePoOpen(false)} title="ສ້າງ PO ຈາກ PR ນີ້" size="sm">
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
            PR ນີ້ອະນຸມັດແລ້ວ ແຕ່ items ບໍ່ມີ Supplier — ກະລຸນາເລືອກ Supplier ສຳລັບທຸກລາຍການ
          </div>

          <div>
            <label className="label">Supplier <span className="text-red-500">*</span></label>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="input"
            >
              <option value="">-- ເລືອກ Supplier --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Supplier ນີ້ຈະຖືກກຳນົດໃຫ້ທຸກລາຍການໃນ PO</p>
          </div>

          {/* Items preview */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">ລາຍການທີ່ຈະໃສ່ PO</div>
            {pr.items.map((item) => (
              <div key={item.id} className="px-3 py-2 border-t border-gray-100 text-sm flex justify-between">
                <span>{item.product.nameLo}</span>
                <span className="text-gray-500">{item.quantity.toLocaleString()} {item.product.unit.nameLo}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-2 justify-end pt-1 border-t border-gray-100">
            <Button variant="secondary" onClick={() => setCreatePoOpen(false)}>ຍົກເລີກ</Button>
            <Button
              disabled={!selectedSupplier}
              loading={createPoMut.isPending}
              onClick={() => createPoMut.mutate()}
            >
              <ShoppingCart className="w-4 h-4" />ສ້າງ PO
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
