import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle, Plus, CreditCard, AlertTriangle, ChevronDown, ChevronUp, Pencil, ShieldCheck, Trash2, } from 'lucide-react';
import toast from 'react-hot-toast';
import { invoiceApi, poApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { InvoiceStatusBadge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';
import type { Invoice, PaginationMeta, PurchaseOrder } from '@/types';

interface GR { id: number; grNumber: string; }
interface POWithGRs extends PurchaseOrder { goodsReceipts: GR[]; }

interface CreateForm {
  po_id: string; gr_id: string; invoice_number: string;
  invoice_amount: string; invoice_date: string;
  due_date: string; tax_amount: string; note: string;
}
interface PayForm {
  payment_date: string; amount_paid: string; bank_ref: string; note: string;
}

const today = new Date().toISOString().split('T')[0];
const defaultCreate: CreateForm = {
  po_id: '', gr_id: '', invoice_number: '', invoice_amount: '',
  invoice_date: today, due_date: '', tax_amount: '', note: '',
};
const defaultPay: PayForm = { payment_date: today, amount_paid: '', bank_ref: '', note: '' };

export default function InvoicesPage() {
  const [page, setPage]     = useState(1);
  const [status, setStatus] = useState('');
  const qc  = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm]             = useState<CreateForm>(defaultCreate);

  const [payOpen,      setPayOpen]      = useState(false);
  const [payTarget,    setPayTarget]    = useState<Invoice | null>(null);
  const [payForm,      setPayForm]      = useState<PayForm>(defaultPay);

  const [editAmtOpen,  setEditAmtOpen]  = useState(false);
  const [editTarget,   setEditTarget]   = useState<Invoice | null>(null);
  const [newAmount,    setNewAmount]    = useState('');
  const [editNote,     setEditNote]     = useState('');

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overTarget,   setOverTarget]   = useState<Invoice | null>(null);
  const [overComment,  setOverComment]  = useState('');

  const [cancelTarget, setCancelTarget] = useState<Invoice | null>(null);

  const canManage = ['ap', 'admin'].includes(user?.role.code ?? '');
  const [warnExpanded, setWarnExpanded] = useState(true);

  // ─── POs that have GRs but no invoice ─────────────────────
  const { data: needsInvData } = useQuery({
    queryKey: ['po-needs-invoice'],
    queryFn:  () => poApi.needsInvoice(),
    staleTime:       60_000,
    refetchInterval: 120_000,
  });
  const pendingPOs: (PurchaseOrder & { goodsReceipts: { id: number; grNumber: string; receivedDate: string }[] })[] =
    (needsInvData?.data as { data: (PurchaseOrder & { goodsReceipts: { id: number; grNumber: string; receivedDate: string }[] })[] } | undefined)?.data ?? [];

  // ─── Invoice list ──────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['invoices', page, status],
    queryFn:  () => invoiceApi.list({ page, limit: 20, status: status || undefined }),
  });

  // ─── PO list for dropdown ──────────────────────────────────
  const { data: poListData } = useQuery({
    queryKey: ['pos-received'],
    queryFn:  () => poApi.list({ limit: 200 }),
    enabled:  createOpen,
    select:   (res) => {
      const rows = (res?.data as { data: PurchaseOrder[] } | undefined)?.data ?? [];
      return rows.filter((p) => ['sent', 'partial_received', 'received'].includes(p.status));
    },
  });

  // ─── PO detail for GR dropdown ────────────────────────────
  const { data: poDetailData } = useQuery({
    queryKey: ['po-inv-detail', form.po_id],
    queryFn:  () => poApi.get(Number(form.po_id)),
    enabled:  !!form.po_id,
    select:   (res) => (res?.data as { data: POWithGRs } | undefined)?.data,
  });

  const grs: GR[] = poDetailData?.goodsReceipts ?? [];

  // ─── Auto-fill amount ເມື່ອ poListData ໂຫຼດ ຫຼື po_id ປ່ຽນ ──
  useEffect(() => {
    if (!form.po_id || !poListData?.length) return;
    const found = poListData.find((p) => String(p.id) === form.po_id);
    if (found) {
      setForm((prev) => ({ ...prev, invoice_amount: String(Number(found.totalAmount)) }));
    }
  }, [form.po_id, poListData]);

  // ─── Mutations ─────────────────────────────────────────────
  const createMut = useMutation({
    mutationFn: () => invoiceApi.create({
      po_id:          Number(form.po_id),
      gr_id:          Number(form.gr_id),
      invoice_number: form.invoice_number,
      invoice_amount: Number(form.invoice_amount),
      invoice_date:   form.invoice_date,
      due_date:       form.due_date   || undefined,
      tax_amount:     form.tax_amount ? Number(form.tax_amount) : undefined,
      note:           form.note       || undefined,
    }),
    onSuccess: () => {
      toast.success('ບັນທຶກ Invoice ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['po-needs-invoice'] });
      setCreateOpen(false);
      setForm(defaultCreate);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const approveMut = useMutation({
    mutationFn: (id: number) => invoiceApi.approve(id),
    onSuccess:  () => { toast.success('ອະນຸມັດ Invoice ສຳເລັດ'); qc.invalidateQueries({ queryKey: ['invoices'] }); },
    onError:    () => toast.error('ບໍ່ສາມາດອະນຸມັດໄດ້'),
  });

  const editAmtMut = useMutation({
    mutationFn: () => invoiceApi.updateAmount(editTarget!.id, { invoice_amount: Number(newAmount), note: editNote || undefined }),
    onSuccess: () => {
      toast.success('ແກ້ໄຂຈຳນວນ Invoice ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices-summary'] });
      setEditAmtOpen(false); setEditTarget(null); setNewAmount(''); setEditNote('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const overrideMut = useMutation({
    mutationFn: () => invoiceApi.overrideApprove(overTarget!.id, overComment),
    onSuccess: () => {
      toast.success('Override ອະນຸມັດ Invoice ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices-summary'] });
      setOverrideOpen(false); setOverTarget(null); setOverComment('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: number) => invoiceApi.cancel(id),
    onSuccess: () => {
      toast.success('ຍົກເລີກ Invoice ສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      qc.invalidateQueries({ queryKey: ['invoices-summary'] });
      qc.invalidateQueries({ queryKey: ['po-needs-invoice'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const payMut = useMutation({
    mutationFn: () => invoiceApi.pay(payTarget!.id, {
      payment_date:   payForm.payment_date,
      amount_paid:    Number(payForm.amount_paid),
      bank_ref:       payForm.bank_ref || undefined,
      note:           payForm.note     || undefined,
      payment_method: 'bank_transfer',
    }),
    onSuccess: () => {
      toast.success('ບັນທຶກການຊຳລະສຳເລັດ');
      qc.invalidateQueries({ queryKey: ['invoices'] });
      setPayOpen(false);
      setPayTarget(null);
      setPayForm(defaultPay);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const rows: Invoice[]                 = (data?.data as { data: Invoice[] } | undefined)?.data ?? [];
  const meta: PaginationMeta | undefined = (data?.data as { pagination?: PaginationMeta } | undefined)?.pagination;

  // ─── summary — ໃຊ້ data ທີ່ load ຢູ່ແລ້ວ ຢ່ານ fetch ຊ້ຳ ───
  // ສຳລັບ summary ທີ່ accurate ກວ່າ ໃຊ້ staleTime ສູງ
  const { data: summaryData } = useQuery({
    queryKey: ['invoices', 1, ''],   // reuse existing cache key (page1, no filter)
    queryFn:  () => invoiceApi.list({ page: 1, limit: 200 }),
    staleTime: 60_000,
    select:    (res) => {
      const r = (res?.data as { data: Invoice[] } | undefined)?.data ?? [];
      return {
        needApprove: r.filter((i) => i.status === 'matched').length,
        needPay:     r.filter((i) => i.status === 'approved').length,
        hasMismatch: r.filter((i) => i.status === 'mismatch').length,
      };
    },
  });
  const needApprove = summaryData?.needApprove ?? 0;
  const needPay     = summaryData?.needPay     ?? 0;
  const hasMismatch = summaryData?.hasMismatch  ?? 0;

  const f = (k: keyof CreateForm, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const columns: Column<Invoice>[] = [
    { key: 'invoiceNumber', label: 'ເລກ Invoice',       className: 'font-mono font-semibold text-primary-700' },
    { key: 'supplier',      label: 'Supplier',          render: (r) => r.supplier?.name ?? '-' },
    { key: 'purchaseOrder', label: 'PO',                render: (r) => r.purchaseOrder?.poNumber ?? '-' },
    { key: 'goodsReceipt',  label: 'GR',                render: (r) => r.goodsReceipt?.grNumber ?? '-' },
    { key: 'invoiceAmount', label: 'ຈຳນວນ Invoice (₭)',  render: (r) => Number(r.invoiceAmount).toLocaleString() },
    { key: 'matchVariance', label: 'ຜົນຕ່າງ',            render: (r) => {
      const v = Number(r.matchVariance);
      return <span className={v !== 0 ? 'text-red-600 font-semibold' : 'text-gray-500'}>{v.toLocaleString()}</span>;
    }},
    { key: 'status',        label: 'ສະຖານະ',             render: (r) => <InvoiceStatusBadge status={r.status} /> },
    { key: 'invoiceDate',   label: 'ວັນທີ Invoice',       render: (r) => new Date(r.invoiceDate).toLocaleDateString('lo-LA') },
    { key: 'actions', label: '', render: (r) => {
      if (r.status === 'matched' && canManage) return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => approveMut.mutate(r.id)}
            disabled={approveMut.isPending}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-60"
          >
            <CheckCircle className="w-3.5 h-3.5" />ອະນຸມັດ
          </button>
          <button onClick={() => setCancelTarget(r)} title="ຍົກເລີກ"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
      if (r.status === 'mismatch' && canManage) return (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { setEditTarget(r); setNewAmount(String(Number(r.invoiceAmount))); setEditNote(''); setEditAmtOpen(true); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors"
            title="ແກ້ໄຂຈຳນວນ"
          >
            <Pencil className="w-3.5 h-3.5" />ແກ້ຈຳນວນ
          </button>
          <button
            onClick={() => { setOverTarget(r); setOverComment(''); setOverrideOpen(true); }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white transition-colors"
            title="Override ອະນຸມັດ"
          >
            <ShieldCheck className="w-3.5 h-3.5" />Override
          </button>
          <button onClick={() => setCancelTarget(r)} title="ຍົກເລີກ"
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-200">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      );
      if (r.status === 'approved' && canManage) {
        const remaining = r.amountRemaining ?? Number(r.totalAmount) - (r.amountPaid ?? 0);
        return (
          <button
            onClick={() => {
              setPayTarget(r);
              setPayForm({ ...defaultPay, amount_paid: String(remaining) });
              setPayOpen(true);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            <CreditCard className="w-3.5 h-3.5" />
            {remaining < Number(r.totalAmount) ? `ຊຳລະ (${remaining.toLocaleString()}₭)` : 'ຊຳລະ'}
          </button>
        );
      }
      return null;
    }},
  ];

  return (
    <div className="space-y-4">

      {/* ─── Header ─── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Invoice</h2>
          <p className="text-sm text-gray-500">ຈັດການໃບກຳກັບສິນຄ້າຈາກ Supplier</p>
        </div>
        {canManage && (
          <Button onClick={() => { setForm(defaultCreate); setCreateOpen(true); }}>
            <Plus className="w-4 h-4" />ບັນທຶກ Invoice
          </Button>
        )}
      </div>

      {/* ─── AP Action Summary ─── */}
      {canManage && (needApprove > 0 || needPay > 0 || hasMismatch > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {needApprove > 0 && (
            <button onClick={() => setStatus('matched')}
              className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
                <CheckCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-blue-800 text-lg leading-none">{needApprove}</p>
                <p className="text-xs text-blue-600 mt-0.5">Invoice ລໍອະນຸມັດ</p>
              </div>
            </button>
          )}
          {needPay > 0 && (
            <button onClick={() => setStatus('approved')}
              className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-green-800 text-lg leading-none">{needPay}</p>
                <p className="text-xs text-green-600 mt-0.5">Invoice ລໍຊຳລະ</p>
              </div>
            </button>
          )}
          {hasMismatch > 0 && (
            <button onClick={() => setStatus('mismatch')}
              className="flex items-center gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl hover:bg-orange-100 transition-colors text-left">
              <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-sm">!</span>
              </div>
              <div>
                <p className="font-bold text-orange-800 text-lg leading-none">{hasMismatch}</p>
                <p className="text-xs text-orange-600 mt-0.5">Invoice ຈຳນວນບໍ່ກົງ</p>
              </div>
            </button>
          )}
        </div>
      )}

      {/* ─── POs ລໍ Invoice Warning ─── */}
      {pendingPOs.length > 0 && (
        <div className="border border-red-300 rounded-xl overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setWarnExpanded((v) => !v)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-red-50 hover:bg-red-100 transition-colors text-left"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="font-semibold text-red-800">
                  ມີ {pendingPOs.length} PO ທີ່ຮັບສິນຄ້າແລ້ວ ແຕ່ <span className="underline">ຍັງບໍ່ໄດ້ບັນທຶກ Invoice!</span>
                </p>
                <p className="text-xs text-red-600 mt-0.5">ກະລຸນາ AP ດຳເນີນການບັນທຶກ Invoice ຈາກ Supplier ໃຫ້ຄົບ</p>
              </div>
            </div>
            {warnExpanded
              ? <ChevronUp className="w-4 h-4 text-red-500 shrink-0" />
              : <ChevronDown className="w-4 h-4 text-red-500 shrink-0" />
            }
          </button>

          {/* List */}
          {warnExpanded && (
            <div className="divide-y divide-red-100 bg-white">
              {pendingPOs.map((po) => (
                <div key={po.id} className="flex items-center justify-between px-4 py-3 hover:bg-red-50/40 transition-colors">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div>
                      <span className="font-mono font-semibold text-primary-700 text-sm">{po.poNumber}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold
                        ${po.status === 'received' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {po.status === 'received' ? 'ຮັບຄົບ' : 'ຮັບບາງສ່ວນ'}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">{po.supplier.name}</span>
                    <span className="text-sm font-semibold text-gray-800">{Number(po.totalAmount).toLocaleString()} ₭</span>
                    <div className="flex gap-1 flex-wrap">
                      {po.goodsReceipts.map((gr) => (
                        <span key={gr.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">
                          {gr.grNumber}
                        </span>
                      ))}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => { setForm({ ...defaultCreate, po_id: String(po.id) }); setCreateOpen(true); }}
                      className="text-xs font-semibold text-red-600 border border-red-300 bg-white hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors shrink-0 whitespace-nowrap"
                    >
                      ບັນທຶກ Invoice
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── Filter ─── */}
      <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="input w-52">
        <option value="">ທຸກສະຖານະ</option>
        <option value="received">ຮັບແລ້ວ (ລໍ Match)</option>
        <option value="matched">Match ✓ (ລໍອະນຸມັດ)</option>
        <option value="mismatch">⚠ ຈຳນວນບໍ່ກົງ</option>
        <option value="approved">ອະນຸມັດແລ້ວ (ລໍຊຳລະ)</option>
        <option value="paid">ຊຳລະແລ້ວ ✓</option>
      </select>

      <Table<Invoice> columns={columns} data={rows} loading={isLoading} keyField="id" />
      {meta && <Pagination meta={meta} onChange={setPage} />}

      {/* ─── Create Invoice Modal ─── */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="ບັນທຶກ Invoice ຈາກ Supplier" size="xl">
        <div className="space-y-4">

          <div className="grid grid-cols-2 gap-4">
            {/* PO */}
            <div className="col-span-2">
              <label className="label">ໃບສັ່ງຊື້ (PO) *</label>
              <select
                className="input"
                value={form.po_id}
                onChange={(e) => {
                  const selectedPo = (poListData ?? []).find((p) => String(p.id) === e.target.value);
                  setForm((p) => ({
                    ...p,
                    po_id:          e.target.value,
                    gr_id:          '',
                    invoice_amount: selectedPo ? String(Number(selectedPo.totalAmount)) : p.invoice_amount,
                  }));
                }}
              >
                <option value="">-- ເລືອກ PO --</option>
                {(poListData ?? []).map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplier.name} ({po.status})
                  </option>
                ))}
              </select>
            </div>

            {/* GR */}
            <div className="col-span-2">
              <label className="label">ໃບຮັບສິນຄ້າ (GR) *</label>
              <select
                className="input"
                value={form.gr_id}
                onChange={(e) => f('gr_id', e.target.value)}
                disabled={!form.po_id}
              >
                <option value="">-- ເລືອກ GR --</option>
                {grs.map((gr) => (
                  <option key={gr.id} value={gr.id}>{gr.grNumber}</option>
                ))}
              </select>
              {form.po_id && grs.length === 0 && (
                <p className="text-xs text-orange-500 mt-1">PO ນີ້ຍັງບໍ່ມີ GR — ຕ້ອງຮັບສິນຄ້າກ່ອນ</p>
              )}
            </div>

            {/* Invoice Number */}
            <div>
              <label className="label">ເລກ Invoice (Supplier) *</label>
              <input className="input" placeholder="INV-XXXX" value={form.invoice_number}
                onChange={(e) => f('invoice_number', e.target.value)} />
            </div>

            {/* Invoice Amount */}
            <div>
              <label className="label">ຈຳນວນເງິນ Invoice (₭) *</label>
              <input className="input" type="number" min="0" placeholder="0"
                value={form.invoice_amount} onChange={(e) => f('invoice_amount', e.target.value)} />
            </div>

            {/* Invoice Date */}
            <div>
              <label className="label">ວັນທີ Invoice *</label>
              <input className="input" type="date" value={form.invoice_date}
                onChange={(e) => f('invoice_date', e.target.value)} />
            </div>

            {/* Due Date */}
            <div>
              <label className="label">ວັນຄົບກຳນົດ</label>
              <input className="input" type="date" value={form.due_date}
                onChange={(e) => f('due_date', e.target.value)} />
            </div>

            {/* Tax */}
            <div>
              <label className="label">ພາສີ (₭)</label>
              <input className="input" type="number" min="0" placeholder="0"
                value={form.tax_amount} onChange={(e) => f('tax_amount', e.target.value)} />
            </div>

            {/* Note */}
            <div>
              <label className="label">ໝາຍເຫດ</label>
              <input className="input" placeholder="ໝາຍເຫດ..." value={form.note}
                onChange={(e) => f('note', e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>ຍົກເລີກ</Button>
            <Button
              loading={createMut.isPending}
              onClick={() => createMut.mutate()}
              disabled={!form.po_id || !form.gr_id || !form.invoice_number || !form.invoice_amount || !form.invoice_date}
            >
              ບັນທຶກ Invoice
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Pay Modal ─── */}
      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`ຊຳລະ ${payTarget?.invoiceNumber ?? ''}`} size="md">
        <div className="space-y-4">
          {payTarget && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <p>ຍອດລວມ: <strong>{Number(payTarget.totalAmount).toLocaleString()} ₭</strong></p>
              {(payTarget.amountPaid ?? 0) > 0 && (
                <p>ຊຳລະແລ້ວ: {Number(payTarget.amountPaid).toLocaleString()} ₭ ·
                  ຄ້າງ: {Number(payTarget.amountRemaining ?? 0).toLocaleString()} ₭</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ວັນທີຊຳລະ *</label>
              <input className="input" type="date" value={payForm.payment_date}
                onChange={(e) => setPayForm((p) => ({ ...p, payment_date: e.target.value }))} />
            </div>
            <div>
              <label className="label">ຈຳນວນຊຳລະ (₭) *</label>
              <input className="input" type="number" min="0" value={payForm.amount_paid}
                onChange={(e) => setPayForm((p) => ({ ...p, amount_paid: e.target.value }))} />
            </div>
            <div>
              <label className="label">ເລກອ້າງອິງ Bank</label>
              <input className="input" placeholder="REF-XXXX" value={payForm.bank_ref}
                onChange={(e) => setPayForm((p) => ({ ...p, bank_ref: e.target.value }))} />
            </div>
            <div>
              <label className="label">ໝາຍເຫດ</label>
              <input className="input" placeholder="ໝາຍເຫດ..." value={payForm.note}
                onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>ຍົກເລີກ</Button>
            <Button loading={payMut.isPending} onClick={() => payMut.mutate()}
              disabled={!payForm.payment_date || !payForm.amount_paid}>
              <CreditCard className="w-4 h-4" />ຢືນຢັນຊຳລະ
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Edit Amount Modal (mismatch) ─── */}
      <Modal open={editAmtOpen} onClose={() => setEditAmtOpen(false)}
        title={`ແກ້ໄຂຈຳນວນ: ${editTarget?.invoiceNumber ?? ''}`} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
            ⚠ ຈຳນວນ PO: <strong>{Number(editTarget?.purchaseOrder as unknown as { totalAmount?: number } | undefined)?.toLocaleString?.() ?? '-'} ₭</strong>
            &nbsp;— ຜົນຕ່າງ: <strong>{Number(editTarget?.matchVariance ?? 0).toLocaleString()} ₭</strong>
          </div>
          <div>
            <label className="label">ຈຳນວນ Invoice ໃໝ່ (₭) *</label>
            <input type="number" min="0" className="input"
              value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">ເຫດຜົນທີ່ແກ້ໄຂ</label>
            <input className="input" placeholder="ເຊັ່ນ: Supplier ສົ່ງ Credit Note..."
              value={editNote} onChange={(e) => setEditNote(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setEditAmtOpen(false)}>ຍົກເລີກ</Button>
            <Button loading={editAmtMut.isPending} disabled={!newAmount}
              onClick={() => editAmtMut.mutate()}>ບັນທຶກ</Button>
          </div>
        </div>
      </Modal>

      {/* ─── Override Approve Modal (mismatch) ─── */}
      <Modal open={overrideOpen} onClose={() => setOverrideOpen(false)}
        title={`Override ອະນຸມັດ: ${overTarget?.invoiceNumber ?? ''}`} size="md">
        <div className="space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg text-sm text-orange-700">
            ⚠ ຈຳນວນບໍ່ກົງ PO ຜົນຕ່າງ: <strong>{Number(overTarget?.matchVariance ?? 0).toLocaleString()} ₭</strong>
            <br/>ການ Override ຕ້ອງໄດ້ຮັບການອະນຸຍາດຈາກຜູ້ຈັດການ
          </div>
          <div>
            <label className="label">ເຫດຜົນ / ໄດ້ຮັບອະນຸຍາດຈາກ *</label>
            <input className="input" placeholder="ເຊັ່ນ: ຜູ້ຈັດການ ຊ. ສົມໃຈ ອະນຸຍາດໂທ 1234..."
              value={overComment} onChange={(e) => setOverComment(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setOverrideOpen(false)}>ຍົກເລີກ</Button>
            <Button loading={overrideMut.isPending} disabled={!overComment}
              onClick={() => overrideMut.mutate()}>
              Override ອະນຸມັດ
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Cancel Confirm Modal ─── */}
      <Modal open={!!cancelTarget} onClose={() => setCancelTarget(null)}
        title="ຢືນຢັນຍົກເລີກ Invoice" size="sm">
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <span className="text-red-500 text-lg shrink-0">✕</span>
            <div className="text-sm">
              <p className="font-semibold text-red-800">ຍົກເລີກ {cancelTarget?.invoiceNumber}?</p>
              <p className="text-red-600 mt-1">Invoice ຈະຖືກລຶບ ແລະ PO ຈະກັບຄືນ "ລໍ Invoice" ໃໝ່</p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setCancelTarget(null)}>ບໍ່</Button>
            <Button loading={cancelMut.isPending}
              onClick={() => cancelMut.mutate(cancelTarget!.id)}
              className="bg-red-600 hover:bg-red-700 text-white">
              ຢືນຢັນຍົກເລີກ
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
