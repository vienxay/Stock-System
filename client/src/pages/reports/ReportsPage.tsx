import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Printer, Download, Package, FileText, ShoppingCart, Receipt, ArrowLeftRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { reportApi, productApi, prApi, poApi, invoiceApi, stockApi } from '@/api/endpoints';
import { Button } from '@/components/ui/Button';
import type { Product, PurchaseRequest, PurchaseOrder, Invoice, StockMovement } from '@/types';

// ─── Types ────────────────────────────────────────────────────
type ReportType = 'stock' | 'purchase-requests' | 'purchase-orders' | 'invoices' | 'stock-movements';

interface ReportConfig {
  type:    ReportType;
  label:   string;
  icon:    React.ElementType;
  color:   string;
  hasDate: boolean;
  hasStatus: boolean;
  statusOptions: string[];
}

const REPORTS: ReportConfig[] = [
  {
    type: 'stock', label: 'ສາງສິນຄ້າ', icon: Package, color: 'bg-blue-500',
    hasDate: false, hasStatus: false, statusOptions: [],
  },
  {
    type: 'purchase-requests', label: 'ໃບຂໍຊື້ (PR)', icon: FileText, color: 'bg-yellow-500',
    hasDate: true, hasStatus: true,
    statusOptions: ['draft','finance_review','finance_rejected','md_review','md_approved','md_rejected','po_created','cancelled'],
  },
  {
    type: 'purchase-orders', label: 'ໃບສັ່ງຊື້ (PO)', icon: ShoppingCart, color: 'bg-purple-500',
    hasDate: true, hasStatus: true,
    statusOptions: ['open','sent','partial_received','received','cancelled'],
  },
  {
    type: 'invoices', label: 'Invoice', icon: Receipt, color: 'bg-green-500',
    hasDate: true, hasStatus: true,
    statusOptions: ['received','matched','mismatch','approved','paid'],
  },
  {
    type: 'stock-movements', label: 'ການເຄື່ອນໄຫວ Stock', icon: ArrowLeftRight, color: 'bg-orange-500',
    hasDate: true, hasStatus: false,
    statusOptions: [],
  },
];

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Phetsarath OT','Noto Sans Lao','Arial Unicode MS',Arial,sans-serif; font-size: 11px; padding: 20px; color: #374151; }
  h1 { text-align: center; color: #1e40af; font-size: 15px; margin-bottom: 4px; font-weight: 700; }
  .sub { text-align: center; color: #6b7280; font-size: 10px; margin-bottom: 14px; }
  table { border-collapse: collapse; width: 100%; }
  th { background: #475569 !important; color: #f1f5f9 !important; padding: 6px 8px; text-align: left; font-size: 10.5px; font-weight: 500; border: 1px solid #334155; letter-spacing: 0.3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  td { padding: 5px 8px; border: 1px solid #e5e7eb; font-size: 11px; color: #4b5563; }
  tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  tfoot td { background: #1e40af !important; color: #fff !important; font-weight: bold; padding: 6px 8px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .low  { color: #ef4444; font-weight: bold; }
  .good { color: #15803d; }
  .inc  { color: #16a34a; font-weight: bold; }
  .dec  { color: #ef4444; font-weight: bold; }
  .mono { font-family: 'Courier New', monospace; font-size: 10px; }
  @page { margin: 15mm; }
`;

export default function ReportsPage() {
  const [selected, setSelected] = useState<ReportType>('stock');
  const [from,     setFrom]     = useState('');
  const [to,       setTo]       = useState('');
  const [status,   setStatus]   = useState('');
  const [loading,  setLoading]  = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const cfg = REPORTS.find((r) => r.type === selected)!;

  const filters = { from: from || undefined, to: to || undefined, status: status || undefined };

  // ─── Preview queries ──────────────────────────────────────
  const stockQ = useQuery({
    queryKey: ['report-preview-stock'],
    queryFn:  () => productApi.list({ limit: 500 }),
    enabled:  selected === 'stock',
    select:   (r) => (r?.data as { data: Product[] } | undefined)?.data ?? [],
  });

  const prQ = useQuery({
    queryKey: ['report-preview-pr', from, to, status],
    queryFn:  () => prApi.list({ limit: 500, from_date: from || undefined, to_date: to || undefined, status: status || undefined }),
    enabled:  selected === 'purchase-requests',
    select:   (r) => (r?.data as { data: PurchaseRequest[] } | undefined)?.data ?? [],
  });

  const poQ = useQuery({
    queryKey: ['report-preview-po', from, to, status],
    queryFn:  () => poApi.list({ limit: 500, status: status || undefined }),
    enabled:  selected === 'purchase-orders',
    select:   (r) => (r?.data as { data: PurchaseOrder[] } | undefined)?.data ?? [],
  });

  const invQ = useQuery({
    queryKey: ['report-preview-inv', from, to, status],
    queryFn:  () => invoiceApi.list({ limit: 500, status: status || undefined }),
    enabled:  selected === 'invoices',
    select:   (r) => (r?.data as { data: Invoice[] } | undefined)?.data ?? [],
  });

  const smQ = useQuery({
    queryKey: ['report-preview-sm', from, to],
    queryFn:  () => stockApi.list({ limit: 500, from_date: from || undefined, to_date: to || undefined }),
    enabled:  selected === 'stock-movements',
    select:   (r) => (r?.data as { data: StockMovement[] } | undefined)?.data ?? [],
  });

  // ─── Excel download ───────────────────────────────────────
  const handleDownload = async () => {
    setLoading(true);
    try {
      await reportApi.download(selected, filters);
      toast.success('ດາວໂຫລດ Excel ສຳເລັດ');
    } catch {
      toast.error('ດາວໂຫລດລົ້ມເຫລວ');
    } finally {
      setLoading(false);
    }
  };

  // ─── Print — open new window so Sidebar/UI don't appear ──
  const handlePrint = () => {
    const tableEl = printRef.current?.querySelector('table');
    if (!tableEl) { toast.error('ບໍ່ມີຂໍ້ມູນ — ລໍຖ້າໂຫຼດໃຫ້ສຳເລັດກ່ອນ'); return; }

    // Clone + convert Tailwind utility classes → inline styles
    const clone = tableEl.cloneNode(true) as HTMLTableElement;
    clone.querySelectorAll<HTMLElement>('.text-red-600,.text-red-600.font-bold').forEach((el) => {
      el.className = 'low';
    });
    clone.querySelectorAll<HTMLElement>('.text-green-700').forEach((el) => {
      el.className = 'good';
    });
    clone.querySelectorAll<HTMLElement>('[class*="text-green-700"][class*="font-bold"]').forEach((el) => {
      el.className = 'inc';
    });
    clone.querySelectorAll<HTMLElement>('.font-mono,.font-mono.text-xs').forEach((el) => {
      el.className = 'mono';
    });

    const dateRange = (from || to) ? `&nbsp;|&nbsp; ໄລຍະ: ${from || '—'} ຫາ ${to || '—'}` : '';

    const win = window.open('', '_blank', 'width=1200,height=800');
    if (!win) { toast.error('Pop-up ຖືກ block — ກະລຸນາອະນຸຍາດ Pop-up ໃນ browser ກ່ອນ'); return; }

    win.document.write(`<!DOCTYPE html>
<html lang="lo"><head>
  <meta charset="utf-8">
  <title>ລາຍງານ ${cfg.label}</title>
  <style>${PRINT_CSS}</style>
</head><body>
  <h1>ລາຍງານ ${cfg.label}</h1>
  <div class="sub">ວັນທີ Export: ${new Date().toLocaleDateString('lo-LA')} ${dateRange}</div>
  ${clone.outerHTML}
  <script>window.addEventListener('load', () => { window.print(); });<\/script>
</body></html>`);
    win.document.close();
  };

  // ─── Preview table content ────────────────────────────────
  const renderTable = () => {
    if (selected === 'stock') {
      const rows       = stockQ.data ?? [];
      const totalStock = rows.reduce((s, p) => s + p.currentStock, 0);
      const totalValue = rows.reduce((s, p) => s + p.currentStock * Number(p.standardPrice), 0);
      const lowCount   = rows.filter((p) => p.currentStock <= p.minStock).length;
      return (
        <table>
          <thead><tr>
            {['#','ລະຫັດ','ຊື່ສິນຄ້າ','ໝວດໝູ່','ໜ່ວຍ','Stock','ໜ້ອຍສຸດ','ສູງສຸດ','ລາຄາ (₭)','ມູນຄ່າ (₭)','ສະຖານະ'].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((p, i) => {
              const low = p.currentStock <= p.minStock;
              return (
                <tr key={p.id}>
                  <td>{i + 1}</td><td className="font-mono text-xs">{p.code}</td>
                  <td>{p.nameLo}</td><td>{p.category.nameLo}</td><td>{p.unit.nameLo}</td>
                  <td style={{ color: low ? '#ef4444' : undefined, fontWeight: low ? 'bold' : undefined }}>
                    {p.currentStock.toLocaleString()}
                  </td>
                  <td>{p.minStock}</td><td>{p.maxStock}</td>
                  <td>{Number(p.standardPrice).toLocaleString()}</td>
                  <td className="font-semibold">{(p.currentStock * Number(p.standardPrice)).toLocaleString()}</td>
                  <td style={{ color: low ? '#ef4444' : '#16a34a', fontWeight: 'bold' }}>
                    {low ? 'ນ້ອຍ ⚠' : 'ປົກກະຕິ'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e40af', color: '#fff', fontWeight: 'bold' }}>
              <td colSpan={5} style={{ padding: '6px 8px' }}>
                ລວມທັງໝົດ ({rows.length} ລາຍການ) · Stock ນ້ອຍ: {lowCount} ລາຍການ
              </td>
              <td style={{ padding: '6px 8px' }}>{totalStock.toLocaleString()}</td>
              <td colSpan={3} />
              <td style={{ padding: '6px 8px' }}>{totalValue.toLocaleString()} ₭</td>
              <td />
            </tr>
          </tfoot>
        </table>
      );
    }

    if (selected === 'purchase-requests') {
      const rows   = prQ.data ?? [];
      const sumAmt = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
      return (
        <table>
          <thead><tr>
            {['#','ເລກ PR','ຜູ້ຂໍ','ພະແນກ','ຈຳນວນ (₭)','ລາຍການ','ຄວາມສຳຄັນ','ສະຖານະ','ວັນທີ'].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td className="font-mono text-xs">{r.prNumber}</td>
                <td>{r.requester.fullName}</td><td>{r.department ?? '-'}</td>
                <td>{Number(r.totalAmount).toLocaleString()}</td>
                <td>{r._count?.items ?? '-'}</td>
                <td>{r.priority}</td><td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleDateString('lo-LA')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e40af', color: '#fff', fontWeight: 'bold' }}>
              <td colSpan={4} style={{ padding: '6px 8px' }}>ລວມທັງໝົດ ({rows.length} ລາຍການ)</td>
              <td style={{ padding: '6px 8px' }}>{sumAmt.toLocaleString()} ₭</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      );
    }

    if (selected === 'purchase-orders') {
      const rows   = poQ.data ?? [];
      const sumAmt = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
      return (
        <table>
          <thead><tr>
            {['#','ເລກ PO','Supplier','ຜູ້ສ້າງ','ຈຳນວນ (₭)','ສະຖານະ','ວັນທີສ້າງ'].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td className="font-mono text-xs">{r.poNumber}</td>
                <td>{r.supplier.name}</td><td>{r.creator.fullName}</td>
                <td>{Number(r.totalAmount).toLocaleString()}</td>
                <td>{r.status}</td>
                <td>{new Date(r.createdAt).toLocaleDateString('lo-LA')}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e40af', color: '#fff', fontWeight: 'bold' }}>
              <td colSpan={4} style={{ padding: '6px 8px' }}>ລວມທັງໝົດ ({rows.length} ລາຍການ)</td>
              <td style={{ padding: '6px 8px' }}>{sumAmt.toLocaleString()} ₭</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      );
    }

    if (selected === 'invoices') {
      const rows      = invQ.data ?? [];
      const sumAmount = rows.reduce((s, r) => s + Number(r.invoiceAmount), 0);
      const sumTax    = rows.reduce((s, r) => s + Number(r.taxAmount), 0);
      const sumTotal  = rows.reduce((s, r) => s + Number(r.totalAmount), 0);
      return (
        <table>
          <thead><tr>
            {['#','ເລກ Invoice','Supplier','PO','GR','ຈຳນວນ (₭)','ພາສີ (₭)','ລວມ (₭)','ຜົນຕ່າງ','ສະຖານະ','ວັນທີ'].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const v = Number(r.matchVariance);
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td><td className="font-mono text-xs">{r.invoiceNumber}</td>
                  <td>{r.supplier?.name}</td>
                  <td className="font-mono text-xs">{r.purchaseOrder?.poNumber}</td>
                  <td className="font-mono text-xs">{r.goodsReceipt?.grNumber ?? '-'}</td>
                  <td>{Number(r.invoiceAmount).toLocaleString()}</td>
                  <td>{Number(r.taxAmount).toLocaleString()}</td>
                  <td className="font-bold">{Number(r.totalAmount).toLocaleString()}</td>
                  <td className={v !== 0 ? 'text-red-600 font-bold' : ''}>{v.toLocaleString()}</td>
                  <td>{r.status}</td>
                  <td>{new Date(r.invoiceDate).toLocaleDateString('lo-LA')}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e40af', color: '#fff', fontWeight: 'bold' }}>
              <td colSpan={5} style={{ padding: '6px 8px' }}>ລວມທັງໝົດ ({rows.length} ລາຍການ)</td>
              <td style={{ padding: '6px 8px' }}>{sumAmount.toLocaleString()} ₭</td>
              <td style={{ padding: '6px 8px' }}>{sumTax.toLocaleString()} ₭</td>
              <td style={{ padding: '6px 8px', fontSize: '13px' }}>{sumTotal.toLocaleString()} ₭</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      );
    }

    if (selected === 'stock-movements') {
      const rows = smQ.data ?? [];
      return (
        <table>
          <thead><tr>
            {['#','ສິນຄ້າ','ລະຫັດ','ໜ່ວຍ','ປະເພດ','ຈຳນວນ','ກ່ອນ','ຫຼັງ','Ref','ຜູ້ດຳເນີນການ','ວັນທີ'].map((h) => <th key={h}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td>{r.product.nameLo}</td>
                <td className="font-mono text-xs">{r.product.code}</td>
                <td>{r.product.unit.nameLo}</td><td>{r.movementType}</td>
                <td className={r.movementType.includes('in') ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                  {r.quantity}
                </td>
                <td>{r.beforeQty}</td><td>{r.afterQty}</td>
                <td className="text-xs">{r.refType ? `${r.refType}-${r.refId}` : '-'}</td>
                <td>{r.creator?.fullName ?? '-'}</td>
                <td className="text-xs">{new Date(r.createdAt).toLocaleString('lo-LA')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
  };

  const isLoading = stockQ.isLoading || prQ.isLoading || poQ.isLoading || invQ.isLoading || smQ.isLoading;

  return (
    <div className="space-y-5">

      {/* ─── Header ─── */}
      <div className="no-print">
        <h2 className="text-xl font-bold text-gray-900">ລາຍງານ</h2>
        <p className="text-sm text-gray-500">Export ຂໍ້ມູນເປັນ Excel ຫຼື ພິມ PDF</p>
      </div>

      {/* ─── Report Type Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 no-print">
        {REPORTS.map((r) => {
          const Icon    = r.icon;
          const active  = selected === r.type;
          return (
            <button
              key={r.type}
              onClick={() => { setSelected(r.type); setStatus(''); }}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                ${active
                  ? 'border-primary-600 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${r.color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-sm font-medium text-center">{r.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Filters ─── */}
      {(cfg.hasDate || cfg.hasStatus) && (
        <div className="card flex flex-wrap gap-3 items-end no-print">
          {cfg.hasDate && (
            <>
              <div>
                <label className="label">ຈາກວັນທີ</label>
                <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div>
                <label className="label">ຫາວັນທີ</label>
                <input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          )}
          {cfg.hasStatus && (
            <div>
              <label className="label">ສະຖານະ</label>
              <select className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">ທຸກສະຖານະ</option>
                {cfg.statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          <Button variant="secondary" onClick={() => { setFrom(''); setTo(''); setStatus(''); }}>
            ລ້າງ Filter
          </Button>
        </div>
      )}

      {/* ─── Action Buttons ─── */}
      <div className="flex gap-2 no-print">
        <Button loading={loading} onClick={handleDownload}>
          <FileSpreadsheet className="w-4 h-4" />ດາວໂຫລດ Excel
        </Button>
        <Button variant="secondary" onClick={handlePrint}>
          <Printer className="w-4 h-4" />ພິມ / PDF
        </Button>
      </div>

      {/* ─── Preview Table ─── */}
      <div ref={printRef}>

        <div className="card overflow-x-auto">
          <div className="flex items-center justify-between mb-3 no-print">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Download className="w-4 h-4 text-primary-600" />
              Preview — {cfg.label}
            </h3>
            {isLoading && <span className="text-sm text-gray-400">ກຳລັງໂຫຼດ...</span>}
          </div>

          <div className="text-sm [&_table]:min-w-full [&_table]:divide-y [&_table]:divide-gray-100
            [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium
            [&_th]:bg-slate-600 [&_th]:text-slate-100 [&_th]:whitespace-nowrap [&_th]:tracking-wide
            [&_td]:px-3 [&_td]:py-2 [&_td]:text-slate-600 [&_td]:whitespace-nowrap [&_td]:text-sm
            [&_tr:nth-child(even)_td]:bg-slate-50
            [&_tfoot_td]:text-white">
            {renderTable()}
          </div>
        </div>
      </div>
    </div>
  );
}
