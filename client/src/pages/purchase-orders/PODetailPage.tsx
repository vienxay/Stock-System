import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowLeft, Send, PackageCheck, CheckCircle, Printer, AlertTriangle, AlertCircle, Receipt, XCircle, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { poApi, settingsApi } from '@/api/endpoints';
import { buildPOPrintHtml } from './poPrintTemplate';
import { Button } from '@/components/ui/Button';
import { PoStatusBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { useAuthStore } from '@/stores/authStore';

// ─── Types ────────────────────────────────────────────────────
interface POItem {
  id: number; quantity: number; unitPrice: number; receivedQty: number;
  product: { code: string; nameLo: string; unit: { nameLo: string } };
}
interface GR {
  id: number; grNumber: string; status: string; receivedDate: string; note?: string;
  // status: completed | rejected
  receiver: { fullName: string };
  items: { id: number; poItemId: number; orderedQty: number; receivedQty: number; rejectedQty: number; note?: string; }[];
}
interface POInvoice {
  id: number; invoiceNumber: string; status: string; totalAmount: number;
}
interface PODetail {
  id: number; poNumber: string; status: string;
  totalAmount: number; createdAt: string; sentAt?: string; note?: string;
  supplier: { id: number; name: string; phone?: string; email?: string; paymentTerm: number };
  creator:  { fullName: string };
  purchaseRequest: { prNumber: string; purpose?: string };
  items:           POItem[];
  goodsReceipts:   GR[];
  invoices:        POInvoice[];
}

// ─── Receive Form state ───────────────────────────────────────
interface ReceiveItemInput {
  po_item_id:   number;
  received_qty: number;
  rejected_qty: number;
  note:         string;
}

export default function PODetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const user     = useAuthStore((s) => s.user);

  const [grOpen,       setGrOpen]    = useState(false);
  const [receiveDate,  setDate]      = useState('');
  const [grNote,       setGrNote]    = useState('');
  const [receiveItems, setItems]     = useState<ReceiveItemInput[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['po', id],
    queryFn:  () => poApi.get(Number(id)),
    enabled:  !!id,
  });

  const po: PODetail | undefined = (data?.data as { data: PODetail } | undefined)?.data;

  // ─── Open GR modal — init items from PO ──────────────────
  const openGR = () => {
    if (!po) return;
    setItems(po.items.map((item) => ({
      po_item_id:   item.id,
      received_qty: item.quantity - item.receivedQty,   // ຍອດທີ່ຍັງຕ້ອງຮັບ
      rejected_qty: 0,
      note:         '',
    })));
    setDate(new Date().toISOString().split('T')[0]);
    setGrNote('');
    setGrOpen(true);
  };

  // ─── Send PO ─────────────────────────────────────────────
  const sendMut = useMutation({
    mutationFn: () => poApi.markSent(Number(id)),
    onSuccess:  () => { toast.success('ສົ່ງ PO ສຳເລັດ'); qc.invalidateQueries({ queryKey: ['po', id] }); },
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  // ─── Receive Goods ────────────────────────────────────────
  const grMut = useMutation({
    mutationFn: () => poApi.receiveGoods(Number(id), {
      received_date: receiveDate || undefined,
      note:          grNote || undefined,
      items:         receiveItems.map((i) => ({
        po_item_id:   i.po_item_id,
        received_qty: Number(i.received_qty),
        rejected_qty: Number(i.rejected_qty) || 0,
        note:         i.note || undefined,
      })),
    }),
    onSuccess: () => {
      toast.success('ຮັບສິນຄ້າ GR ສຳເລັດ — Stock ອັບເດດແລ້ວ');
      qc.invalidateQueries({ queryKey: ['po', id] });
      qc.invalidateQueries({ queryKey: ['products'] });
      setGrOpen(false);
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const updateItem = (idx: number, field: keyof ReceiveItemInput, value: string | number) => {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const cancelPoMut = useMutation({
    mutationFn: () => poApi.cancel(Number(id)),
    onSuccess:  () => { toast.success('ຍົກເລີກ PO ສຳເລັດ'); qc.invalidateQueries({ queryKey: ['po', id] }); navigate('/purchase-orders'); },
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const cancelGrMut = useMutation({
    mutationFn: (grId: number) => poApi.cancelGr(Number(id), grId),
    onSuccess:  () => { toast.success('ຍົກເລີກ GR ສຳເລັດ'); qc.invalidateQueries({ queryKey: ['po', id] }); qc.invalidateQueries({ queryKey: ['products'] }); },
    onError:    (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const canSend    = po?.status === 'open'  && ['purchasing', 'admin'].includes(user?.role.code ?? '');
  const canCancelPo = ['open', 'sent'].includes(po?.status ?? '')
                    && (po?.goodsReceipts?.length ?? 0) === 0
                    && ['purchasing', 'admin'].includes(user?.role.code ?? '');
  const canReceive = ['sent', 'partial_received'].includes(po?.status ?? '')
                   && ['stock', 'admin'].includes(user?.role.code ?? '');
  const canCancelGr = ['stock', 'admin'].includes(user?.role.code ?? '');

  // ─── fetch settings for company info ───────────────────────
  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn:  () => settingsApi.get(),
    staleTime: 5 * 60_000,
  });
  const settings = (settingsData?.data as { data: { companyName: string; companyNameEn?: string; logoUrl?: string; phone?: string; address?: string } } | undefined)?.data;

  // ─── Print PO ───────────────────────────────────────────────
  const handlePrint = () => {
    if (!po) return;
    const win = window.open('', '_blank', 'width=900,height=1100');
    if (!win) { toast.error('Pop-up ຖືກ block — ກະລຸນາອະນຸຍາດ Pop-up ກ່ອນ'); return; }
    win.document.write(buildPOPrintHtml(po, settings));
    win.document.close();
  };

  if (isLoading) return (
    <div className="flex items-center justify-center py-20 text-gray-400">ກຳລັງໂຫຼດ...</div>
  );
  if (!po) return (
    <div className="text-center py-20 text-gray-400">ບໍ່ພົບ PO</div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-5">

      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/purchase-orders')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-primary-700 font-mono">{po.poNumber}</h2>
              <PoStatusBadge status={po.status} />
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              ສ້າງໂດຍ {po.creator.fullName} · {new Date(po.createdAt).toLocaleDateString('lo-LA')}
            </p>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="w-4 h-4" />ພິມ / PDF
          </Button>
          {canSend && (
            <Button variant="secondary" loading={sendMut.isPending} onClick={() => sendMut.mutate()}>
              <Send className="w-4 h-4" />ສົ່ງ PO ໃຫ້ Supplier
            </Button>
          )}
          {canReceive && (
            <Button onClick={openGR}>
              <PackageCheck className="w-4 h-4" />ຮັບສິນຄ້າ (GR)
            </Button>
          )}
          {canCancelPo && (
            <Button variant="danger" loading={cancelPoMut.isPending}
              onClick={() => { if (confirm('ຢືນຢັນຍົກເລີກ PO?')) cancelPoMut.mutate(); }}>
              <XCircle className="w-4 h-4" />ຍົກເລີກ PO
            </Button>
          )}
        </div>
      </div>

      {/* ─── Invoice Warning Banners ─── */}
      {(() => {
        const hasGR       = po.goodsReceipts.length > 0;
        const invoices    = po.invoices ?? [];
        const noInvoice   = hasGR && invoices.length === 0;
        const hasMismatch = invoices.some((i) => i.status === 'mismatch');
        const allPaid     = invoices.length > 0 && invoices.every((i) => i.status === 'paid');
        const hasPending  = invoices.some((i) => ['matched', 'approved'].includes(i.status));

        if (!hasGR) return null;
        return (
          <div className="space-y-2">
            {noInvoice && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-300 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold text-red-800">ຍັງບໍ່ໄດ້ບັນທຶກ Invoice!</p>
                  <p className="text-sm text-red-600 mt-0.5">
                    PO ນີ້ມີການຮັບສິນຄ້າ {po.goodsReceipts.length} ຄັ້ງແລ້ວ ແຕ່ <strong>ຍັງບໍ່ມີ Invoice</strong> ຖືກສ້າງ —
                    ກະລຸນາ AP ບັນທຶກ Invoice ຈາກ Supplier.
                  </p>
                </div>
                <div className="shrink-0">
                  <Receipt className="w-8 h-8 text-red-300" />
                </div>
              </div>
            )}
            {hasMismatch && (
              <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-300 rounded-xl">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-orange-800">Invoice ຈຳນວນບໍ່ກົງກັບ PO!</p>
                  <p className="text-sm text-orange-600 mt-0.5">
                    ມີ Invoice ທີ່ <strong>mismatch</strong> — ກະລຸນາ AP ກວດສອບ ແລະ ດຳເນີນການ.
                  </p>
                </div>
              </div>
            )}
            {hasPending && !hasMismatch && (
              <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-300 rounded-xl">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-yellow-800">Invoice ລໍຖ້າຊຳລະ</p>
                  <p className="text-sm text-yellow-600 mt-0.5">
                    Invoice ຖືກ matched/approved ແລ້ວ — ລໍຖ້າ AP ດຳເນີນການຊຳລະ.
                  </p>
                </div>
              </div>
            )}
            {allPaid && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-300 rounded-xl">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
                <p className="font-semibold text-green-800">ຊຳລະ Invoice ຄົບທຸກລາຍການແລ້ວ ✓</p>
              </div>
            )}
          </div>
        );
      })()}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* ─── Main ─── */}
        <div className="lg:col-span-2 space-y-5">

          {/* PO Info */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">ຂໍ້ມູນ PO</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-gray-500">PR:</span> <span className="font-mono font-semibold text-primary-600">{po.purchaseRequest.prNumber}</span></div>
              <div><span className="text-gray-500">Supplier:</span> <span className="font-medium">{po.supplier.name}</span></div>
              <div><span className="text-gray-500">ສ້າງວັນທີ:</span> <span>{new Date(po.createdAt).toLocaleDateString('lo-LA')}</span></div>
              <div><span className="text-gray-500">ເງື່ອນໄຂຊຳລະ:</span> <span>{po.supplier.paymentTerm} ວັນ</span></div>
              {po.sentAt && <div className="col-span-2"><span className="text-gray-500">ສົ່ງວັນທີ:</span> <span>{new Date(po.sentAt).toLocaleDateString('lo-LA')}</span></div>}
            </div>
            {po.purchaseRequest.purpose && (
              <p className="text-sm text-gray-600"><span className="text-gray-400">ຈຸດປະສົງ: </span>{po.purchaseRequest.purpose}</p>
            )}
          </div>

          {/* Items */}
          <div className="card">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-3">ລາຍການສິນຄ້າ</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    {['#', 'ສິນຄ້າ', 'ສັ່ງ', 'ຮັບແລ້ວ', 'ຄ້າງ', 'ລາຄາ/ໜ່ວຍ', 'ລວມ'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {po.items.map((item, i) => {
                    const remaining = item.quantity - item.receivedQty;
                    return (
                      <tr key={item.id}>
                        <td className="px-3 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-medium">{item.product.nameLo}</p>
                          <p className="text-xs text-gray-400 font-mono">{item.product.code}</p>
                        </td>
                        <td className="px-3 py-2.5">{item.quantity.toLocaleString()} {item.product.unit.nameLo}</td>
                        <td className="px-3 py-2.5">
                          <span className={item.receivedQty > 0 ? 'text-green-600 font-semibold' : 'text-gray-400'}>
                            {item.receivedQty.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className={remaining > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}>
                            {remaining.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">{Number(item.unitPrice).toLocaleString()} ₭</td>
                        <td className="px-3 py-2.5 font-semibold">
                          {(item.quantity * Number(item.unitPrice)).toLocaleString()} ₭
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-3 py-2.5 text-right font-semibold text-gray-700">ລວມທັງໝົດ:</td>
                    <td className="px-3 py-2.5 font-bold text-primary-700">{Number(po.totalAmount).toLocaleString()} ₭</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* GR History */}
          {po.goodsReceipts.length > 0 && (
            <div className="card">
              <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2 mb-3">
                ປະຫວັດການຮັບສິນຄ້າ ({po.goodsReceipts.length} ຄັ້ງ)
              </h3>
              <div className="space-y-3">
                {po.goodsReceipts.map((gr) => (
                  <div key={gr.id} className={`border rounded-lg p-3 ${gr.status === 'rejected' ? 'border-gray-200 bg-gray-100' : 'border-gray-200 bg-green-50'}`}>
                    <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        {gr.status === 'rejected'
                          ? <XCircle className="w-4 h-4 text-gray-500" />
                          : <CheckCircle className="w-4 h-4 text-green-600" />}
                        <span className={`font-mono font-semibold ${gr.status === 'rejected' ? 'text-gray-600 line-through' : 'text-green-700'}`}>
                          {gr.grNumber}
                        </span>
                        {gr.status === 'rejected' && <span className="text-xs text-gray-500">(ຍົກເລີກ)</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {new Date(gr.receivedDate).toLocaleDateString('lo-LA')} · {gr.receiver.fullName}
                        </span>
                        {canCancelGr && gr.status !== 'rejected' && (
                          <button
                            type="button"
                            title="ຍົກເລີກ GR"
                            disabled={cancelGrMut.isPending}
                            onClick={() => { if (confirm(`ຍົກເລີກ ${gr.grNumber}? Stock ຈະຖືກຫັກຄືນ`)) cancelGrMut.mutate(gr.id); }}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs divide-y divide-gray-100">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="px-2 py-1 text-left">ສິນຄ້າ</th>
                            <th className="px-2 py-1 text-left">ຮັບ</th>
                            <th className="px-2 py-1 text-left">ປະຕິເສດ</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(gr.items ?? []).map((gi) => {
                            const poItem = po.items.find((p) => p.id === gi.poItemId);
                            return (
                              <tr key={gi.id}>
                                <td className="px-2 py-1">{poItem?.product.nameLo ?? '-'}</td>
                                <td className="px-2 py-1 text-green-700 font-semibold">{gi.receivedQty}</td>
                                <td className="px-2 py-1 text-red-600">{gi.rejectedQty > 0 ? gi.rejectedQty : '-'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {gr.note && <p className="text-xs text-gray-500 mt-1">ໝາຍເຫດ: {gr.note}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ─── Sidebar ─── */}
        <div>
          <div className="card space-y-3">
            <h3 className="font-semibold text-gray-900 border-b border-gray-100 pb-2">Supplier</h3>
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold text-gray-900">{po.supplier.name}</p>
              {po.supplier.phone && <p className="text-gray-600">📞 {po.supplier.phone}</p>}
              {po.supplier.email && <p className="text-gray-600">✉️ {po.supplier.email}</p>}
              <p className="text-gray-500">ເງື່ອນໄຂ: {po.supplier.paymentTerm} ວັນ</p>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Receive Goods Modal ─── */}
      <Modal open={grOpen} onClose={() => setGrOpen(false)} title="ຮັບສິນຄ້າ (Goods Receipt)" size="xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ວັນທີຮັບສິນຄ້າ</label>
              <input type="date" value={receiveDate} onChange={(e) => setDate(e.target.value)}
                className="input" />
            </div>
            <div>
              <label className="label">ໝາຍເຫດ GR</label>
              <input value={grNote} onChange={(e) => setGrNote(e.target.value)}
                className="input" placeholder="ໝາຍເຫດ..." />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['ສິນຄ້າ', 'ສັ່ງ', 'ຮັບ *', 'ປະຕິເສດ', 'ໝາຍເຫດ'].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {po.items.map((item, idx) => (
                  <tr key={item.id} className="bg-white">
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-sm">{item.product.nameLo}</p>
                      <p className="text-xs text-gray-400 font-mono">{item.product.code}</p>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600 whitespace-nowrap">
                      {item.quantity} {item.product.unit.nameLo}
                      {item.receivedQty > 0 && (
                        <p className="text-xs text-green-600">ຮັບແລ້ວ: {item.receivedQty}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number" min="0" max={item.quantity}
                        value={receiveItems[idx]?.received_qty ?? 0}
                        onChange={(e) => updateItem(idx, 'received_qty', e.target.value)}
                        className="input w-24 text-center"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        type="number" min="0"
                        value={receiveItems[idx]?.rejected_qty ?? 0}
                        onChange={(e) => updateItem(idx, 'rejected_qty', e.target.value)}
                        className="input w-24 text-center"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <input
                        value={receiveItems[idx]?.note ?? ''}
                        onChange={(e) => updateItem(idx, 'note', e.target.value)}
                        className="input w-36" placeholder="ໝາຍເຫດ..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-gray-500">
            * ຫຼັງຈາກຮັບ — Stock ຂອງສິນຄ້າທຸກລາຍການຈະເພີ່ມຂຶ້ນໂດຍອັດຕະໂນມັດ
          </p>

          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setGrOpen(false)}>ຍົກເລີກ</Button>
            <Button loading={grMut.isPending} onClick={() => grMut.mutate()}>
              <PackageCheck className="w-4 h-4" />ຢືນຢັນຮັບສິນຄ້າ
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
