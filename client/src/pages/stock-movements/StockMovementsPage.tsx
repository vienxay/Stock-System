import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, AlertTriangle, ArrowDownCircle, ArrowUpCircle, SlidersHorizontal, ScanLine } from 'lucide-react';
import toast from 'react-hot-toast';
import { stockApi, productApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { MovementBadge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { BarcodeScanner } from '@/components/ui/BarcodeScanner';
import { useAuthStore } from '@/stores/authStore';
import type { StockMovement, Product, PaginationMeta } from '@/types';

type ApiErr = { response?: { data?: { message?: string } } };

// ─── Product Search Select ────────────────────────────────────
function ProductSelect({
  products, value, onChange,
}: {
  products: Product[];
  value: number | '';
  onChange: (id: number | '') => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search) return products.slice(0, 50);
    const q = search.toLowerCase().trim();
    return products.filter((p) =>
      p.code.toLowerCase().includes(q)    ||
      p.nameLo.toLowerCase().includes(q)  ||
      (p.barcode ?? '').toLowerCase().includes(q)
    ).slice(0, 50);
  }, [products, search]);

  // Auto-select ເມື່ອ scan barcode ຕົງກັນ (USB scanner)
  useEffect(() => {
    if (!search) return;
    const q = search.trim();
    const exact = products.find(
      (p) => p.barcode === q || p.code === q
    );
    if (exact) {
      onChange(exact.id);
      setSearch('');
      toast.success(`ພົບສິນຄ້າ: ${exact.nameLo}`);
    }
  }, [search, products, onChange]);

  const selected = products.find((p) => p.id === value);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="ຄົ້ນຫາລະຫັດ / ຊື່ສິນຄ້າ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : '')}
        size={5}
      >
        <option value="">— ເລືອກສິນຄ້າ —</option>
        {filtered.map((p) => (
          <option key={p.id} value={p.id}>
            [{p.code}] {p.nameLo} — Stock: {p.currentStock} {p.unit?.nameLo}
          </option>
        ))}
      </select>
      {/* Stock info card */}
      {selected && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border ${
          selected.currentStock <= selected.minStock
            ? 'bg-red-50 border-red-200'
            : 'bg-green-50 border-green-200'
        }`}>
          {selected.currentStock <= selected.minStock
            ? <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            : <ArrowDownCircle className="w-5 h-5 text-green-500 shrink-0" />
          }
          <div className="text-sm">
            <p className="font-medium text-gray-800">{selected.nameLo}</p>
            <p className={`font-bold text-lg ${selected.currentStock <= selected.minStock ? 'text-red-600' : 'text-green-700'}`}>
              Stock ປັດຈຸບັນ: {selected.currentStock.toLocaleString()} {selected.unit?.nameLo}
              {selected.currentStock <= selected.minStock && ' ⚠ ນ້ອຍ'}
            </p>
            <p className="text-xs text-gray-500">ຂີດໜ້ອຍສຸດ: {selected.minStock}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function StockMovementsPage() {
  const [page, setPage]         = useState(1);
  const [type, setType]         = useState('');
  const [issueOpen, setIssue]   = useState(false);
  const [adjustOpen, setAdjust] = useState(false);
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canEdit = ['stock', 'admin'].includes(user?.role.code ?? '');

  // ─── Issue form state ──────────────────────────────────────
  const [issueProductId, setIssueProductId] = useState<number | ''>('');
  const [issueQty,       setIssueQty]       = useState('');
  const [issueNote,      setIssueNote]      = useState('');
  const [scanOpen,       setScanOpen]       = useState(false);

  // ─── Adjust form state ─────────────────────────────────────
  const [adjProductId, setAdjProductId] = useState<number | ''>('');
  const [adjQty,       setAdjQty]       = useState('');
  const [adjType,      setAdjType]      = useState<'adjust_in' | 'adjust_out'>('adjust_in');
  const [adjNote,      setAdjNote]      = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stock-movements', page, type],
    queryFn:  () => stockApi.list({ page, limit: 20, movement_type: type || undefined }),
  });

  const { data: prodData } = useQuery({
    queryKey: ['products-for-issue'],
    queryFn:  () => productApi.list({ limit: 500, status: 'active' }),
    select:   (r) => (r?.data as { data: Product[] } | undefined)?.data ?? [],
    enabled:  issueOpen || adjustOpen,
  });

  const products = prodData ?? [];

  const resetIssue  = () => { setIssueProductId(''); setIssueQty(''); setIssueNote(''); };
  const resetAdjust = () => { setAdjProductId('');   setAdjQty('');   setAdjNote('');  setAdjType('adjust_in'); };

  // ─── Mutations ─────────────────────────────────────────────
  const issueMut = useMutation({
    mutationFn: () => stockApi.issueOut({
      product_id: Number(issueProductId),
      quantity:   Number(issueQty),
      note:       issueNote || undefined,
    }),
    onSuccess: () => {
      toast.success('ເບີກສິນຄ້າອອກສຳເລັດ');
      setIssue(false); resetIssue();
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: ApiErr) => toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const adjustMut = useMutation({
    mutationFn: () => stockApi.adjust({
      product_id:    Number(adjProductId),
      quantity:      Number(adjQty),
      movement_type: adjType,
      note:          adjNote || undefined,
    }),
    onSuccess: () => {
      toast.success('ປັບຍອດ Stock ສຳເລັດ');
      setAdjust(false); resetAdjust();
      qc.invalidateQueries({ queryKey: ['stock-movements'] });
      qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e: ApiErr) => toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const selectedIssue  = products.find((p) => p.id === issueProductId);
  const selectedAdjust = products.find((p) => p.id === adjProductId);
  const issueExceedsStock = issueProductId && issueQty
    && Number(issueQty) > (selectedIssue?.currentStock ?? 0);

  const rows: StockMovement[] = (data?.data as { data: StockMovement[] } | undefined)?.data ?? [];
  const meta: PaginationMeta | undefined = (data?.data as { pagination?: PaginationMeta } | undefined)?.pagination;

  const columns: Column<StockMovement>[] = [
    { key: 'movementType', label: 'ປະເພດ',       render: (r) => <MovementBadge type={r.movementType} /> },
    {
      key: 'product', label: 'ສິນຄ້າ',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-800">{r.product?.nameLo}</p>
          <p className="text-xs text-gray-400 font-mono">{r.product?.code}</p>
        </div>
      ),
    },
    {
      key: 'quantity', label: 'ຈຳນວນ',
      render: (r) => (
        <span className={`font-semibold ${r.movementType.includes('in') ? 'text-green-600' : 'text-red-600'}`}>
          {r.movementType.includes('in') ? '+' : '-'}{r.quantity.toLocaleString()} {r.product?.unit?.nameLo}
        </span>
      ),
    },
    {
      key: 'beforeQty', label: 'ກ່ອນ → ຫຼັງ',
      render: (r) => (
        <span className="text-sm">
          {r.beforeQty.toLocaleString()}
          <span className="text-gray-400 mx-1">→</span>
          <span className={r.afterQty <= (r.beforeQty * 0.2) ? 'text-red-600 font-semibold' : ''}>
            {r.afterQty.toLocaleString()}
          </span>
        </span>
      ),
    },
    { key: 'creator',   label: 'ຜູ້ດຳເນີນ',  render: (r) => r.creator?.fullName ?? '-' },
    { key: 'note',      label: 'ໝາຍເຫດ',      render: (r) => r.note ? <span className="text-xs text-gray-500">{r.note}</span> : '-' },
    { key: 'createdAt', label: 'ວັນທີ-ເວລາ',  render: (r) => new Date(r.createdAt).toLocaleString('lo-LA') },
  ];

  return (
    <div className="space-y-4">

      {/* ─── Toolbar ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className="input w-52">
          <option value="">ທຸກປະເພດ</option>
          <option value="gr_in">📦 ຮັບເຂົ້າ GR</option>
          <option value="issue_out">📤 ເບີກອອກ</option>
          <option value="return_in">↩ ຄືນເຂົ້າ</option>
          <option value="adjust_in">➕ ປັບເພີ່ມ</option>
          <option value="adjust_out">➖ ປັບຫຼຸດ</option>
        </select>
        {canEdit && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { resetAdjust(); setAdjust(true); }}>
              <SlidersHorizontal className="w-4 h-4" />ປັບຍອດ Stock
            </Button>
            <Button onClick={() => { resetIssue(); setIssue(true); }}>
              <ArrowUpCircle className="w-4 h-4" />ເບີກສິນຄ້າ
            </Button>
          </div>
        )}
      </div>

      <Table<StockMovement> columns={columns} data={rows} loading={isLoading} keyField="id" />
      {meta && <Pagination meta={meta} onChange={setPage} />}

      {/* ─── Issue Out Modal ─── */}
      <Modal open={issueOpen} onClose={() => { setIssue(false); resetIssue(); }}
        title="ເບີກສິນຄ້າອອກ" size="lg">
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">ເລືອກສິນຄ້າ *</label>
              <button
                type="button"
                onClick={() => setScanOpen(true)}
                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                <ScanLine className="w-4 h-4" />ສະແກນ Barcode
              </button>
            </div>
            <ProductSelect
              products={products}
              value={issueProductId}
              onChange={setIssueProductId}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">ຈຳນວນ * {selectedIssue && <span className="text-gray-400">(ສູງສຸດ: {selectedIssue.currentStock})</span>}</label>
              <input
                type="number" min="1"
                max={selectedIssue?.currentStock}
                className={`input ${issueExceedsStock ? 'border-red-400 bg-red-50' : ''}`}
                value={issueQty}
                onChange={(e) => setIssueQty(e.target.value)}
                placeholder="0"
              />
              {issueExceedsStock && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  ຈຳນວນເກີນ Stock ທີ່ມີ ({selectedIssue?.currentStock} ໜ່ວຍ)
                </p>
              )}
            </div>
            <div>
              <label className="label">ໝາຍເຫດ / ຈຸດປະສົງ</label>
              <input className="input" placeholder="ເບີກໄປໃຊ້ເພື່ອ..." value={issueNote} onChange={(e) => setIssueNote(e.target.value)} />
            </div>
          </div>

          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => { setIssue(false); resetIssue(); }}>ຍົກເລີກ</Button>
            <Button
              loading={issueMut.isPending}
              disabled={!issueProductId || !issueQty || !!issueExceedsStock}
              onClick={() => issueMut.mutate()}
            >
              <ArrowUpCircle className="w-4 h-4" />ຢືນຢັນເບີກ
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Adjust Modal ─── */}
      <Modal open={adjustOpen} onClose={() => { setAdjust(false); resetAdjust(); }}
        title="ປັບຍອດ Stock" size="lg">
        <div className="space-y-4">
          <div>
            <label className="label">ເລືອກສິນຄ້າ *</label>
            <ProductSelect
              products={products}
              value={adjProductId}
              onChange={setAdjProductId}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">ປະເພດ</label>
              <select className="input" value={adjType} onChange={(e) => setAdjType(e.target.value as 'adjust_in' | 'adjust_out')}>
                <option value="adjust_in">➕ ປັບເພີ່ມ</option>
                <option value="adjust_out">➖ ປັບຫຼຸດ</option>
              </select>
            </div>
            <div>
              <label className="label">ຈຳນວນ *</label>
              <input
                type="number" min="1"
                className="input"
                value={adjQty}
                onChange={(e) => setAdjQty(e.target.value)}
                placeholder="0"
              />
              {selectedAdjust && adjQty && adjType === 'adjust_out' && Number(adjQty) > selectedAdjust.currentStock && (
                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />Stock ບໍ່ພໍ
                </p>
              )}
            </div>
            <div>
              <label className="label">ໝາຍເຫດ *</label>
              <input className="input" placeholder="ເຫດຜົນ..." value={adjNote} onChange={(e) => setAdjNote(e.target.value)} />
            </div>
          </div>

          {selectedAdjust && adjQty && (
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-sm">
              <p className="text-gray-600">
                Stock ຈະປ່ຽນ:
                <span className="font-bold text-gray-900 mx-2">{selectedAdjust.currentStock}</span>
                →
                <span className={`font-bold mx-2 ${
                  adjType === 'adjust_in'
                    ? 'text-green-600'
                    : (selectedAdjust.currentStock - Number(adjQty)) <= selectedAdjust.minStock
                      ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {adjType === 'adjust_in'
                    ? selectedAdjust.currentStock + Number(adjQty)
                    : selectedAdjust.currentStock - Number(adjQty)
                  }
                </span>
                {selectedAdjust.unit?.nameLo}
              </p>
            </div>
          )}

          <div className="flex gap-2 justify-end border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => { setAdjust(false); resetAdjust(); }}>ຍົກເລີກ</Button>
            <Button
              loading={adjustMut.isPending}
              disabled={!adjProductId || !adjQty || !adjNote}
              onClick={() => adjustMut.mutate()}
            >
              <ArrowDownCircle className="w-4 h-4" />ຢືນຢັນປັບຍອດ
            </Button>
          </div>
        </div>
      </Modal>

      {/* ─── Barcode Scanner (render ຫຼັງ modal ທັງໝົດ z-[60]) ─── */}
      <BarcodeScanner
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        title="ສະແກນ Barcode ສິນຄ້າ"
        onResult={(value) => {
          const found = products.find((p) => p.barcode === value || p.code === value);
          if (found) {
            setIssueProductId(found.id);
            toast.success(`ພົບສິນຄ້າ: ${found.nameLo}`);
          } else {
            toast.error(`ບໍ່ພົບສິນຄ້າ barcode: ${value}`);
          }
        }}
      />

    </div>
  );
}
