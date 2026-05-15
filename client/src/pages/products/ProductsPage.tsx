import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Upload, Search, AlertTriangle, Pencil } from 'lucide-react';
import { productApi } from '@/api/endpoints';
import { Table, type Column } from '@/components/ui/Table';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { ProductFormModal } from './ProductFormModal';
import { ProductImportModal } from './ProductImportModal';
import type { Product, PaginationMeta } from '@/types';

export default function ProductsPage() {
  const [page, setPage]           = useState(1);
  const [search, setSearch]       = useState('');
  const [lowStock, setLowStock]   = useState(false);
  const [formOpen, setFormOpen]   = useState(false);
  const [importOpen, setImport]   = useState(false);
  const [editing, setEditing]     = useState<Product | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['products', page, search, lowStock],
    queryFn:  () => productApi.list({ page, limit: 20, search: search || undefined, low_stock: lowStock || undefined }),
  });

  const rows: Product[]            = (data?.data as { data: Product[] }           | undefined)?.data ?? [];
  const meta: PaginationMeta | undefined = (data?.data as { pagination?: PaginationMeta } | undefined)?.pagination;

  const openAdd  = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (p: Product) => { setEditing(p); setFormOpen(true); };

  const columns: Column<Product>[] = [
    { key: 'code',          label: 'ລະຫັດ',        className: 'font-mono text-xs w-24' },
    {
      key: 'nameLo', label: 'ຊື່ສິນຄ້າ',
      render: (r) => (
        <div>
          <p className="font-medium text-gray-800">{r.nameLo}</p>
          {r.barcode && <p className="text-xs text-gray-400 font-mono">{r.barcode}</p>}
        </div>
      ),
    },
    { key: 'category',      label: 'ໝວດ',           render: (r) => r.category?.nameLo ?? '-' },
    { key: 'unit',          label: 'ຫົວໜ່ວຍ',        render: (r) => r.unit?.nameLo ?? '-' },
    {
      key: 'currentStock',
      label: 'Stock ປັດຈຸບັນ',
      render: (r) => (
        <span className={`font-semibold ${r.currentStock <= r.minStock ? 'text-red-600' : 'text-gray-900'}`}>
          {r.currentStock.toLocaleString()}
          {r.currentStock <= r.minStock && <AlertTriangle className="inline w-3 h-3 ml-1 text-red-500" />}
        </span>
      ),
    },
    { key: 'minStock',      label: 'ໜ້ອຍສຸດ',         render: (r) => r.minStock.toLocaleString() },
    { key: 'standardPrice', label: 'ລາຄາ (₭)', render: (r) => Number(r.standardPrice).toLocaleString() },
    {
      key: 'imageUrl', label: 'ຮູບພາບ',
      render: (r) => r.imageUrl
        ? <img src={r.imageUrl} alt={r.nameLo} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
        : <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 text-xs">-</div>,
    },
    { key: 'isActive',      label: 'ສະຖານະ',         render: (r) => <Badge variant={r.isActive ? 'green' : 'gray'}>{r.isActive ? 'ໃຊ້ງານ' : 'ປິດ'}</Badge> },
    {
      key: 'actions', label: '',
      render: (r) => (
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500 hover:text-primary-600">
          <Pencil className="w-4 h-4" />
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 w-full sm:w-64" placeholder="ຄົ້ນຫາລະຫັດ / ຊື່..." />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer whitespace-nowrap self-center">
            <input type="checkbox" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }}
              className="rounded border-gray-300 text-primary-600" />
            <AlertTriangle className="w-4 h-4 text-red-500" /> Stock ນ້ອຍ
          </label>
        </div>

        <div className="flex gap-2 shrink-0">
          <Button variant="secondary" onClick={() => setImport(true)}>
            <Upload className="w-4 h-4" />Import CSV
          </Button>
          <Button onClick={openAdd}>
            <Plus className="w-4 h-4" />ເພີ່ມສິນຄ້າ
          </Button>
        </div>
      </div>

      <Table<Product> columns={columns} data={rows} loading={isLoading} keyField="id" onRowClick={openEdit} />
      {meta && <Pagination meta={meta} onChange={setPage} />}

      <ProductFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        product={editing}
      />

      <ProductImportModal
        open={importOpen}
        onClose={() => setImport(false)}
      />
    </div>
  );
}
