import { useState, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, Download, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { productApi, categoryApi, unitApi } from '@/api/endpoints';
import type { Category, Unit } from '@/types';

interface CsvRow {
  code: string; nameLo: string; nameEn?: string;
  categoryId: number; unitId: number;
  standardPrice: number; minStock: number; maxStock: number;
  location?: string; barcode?: string;
}
interface PreviewRow extends CsvRow { _line: number; _error?: string; }

interface Props { open: boolean; onClose: () => void; }

// ─── CSV parser (ງ່າຍ, ບໍ່ຕ້ອງ library) ──────────────────────
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/\r/, ''));
  return lines.slice(1).map((line) => {
    const vals = line.split(',').map((v) => v.trim().replace(/\r/, ''));
    return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? '']));
  });
}

// ─── Download CSV template ────────────────────────────────────
function downloadTemplate(categories: Category[], units: Unit[]) {
  const catInfo = categories.map((c) => `${c.id}=${c.nameLo}`).join(' | ');
  const unitInfo = units.map((u) => `${u.id}=${u.nameLo}`).join(' | ');
  const header   = 'code,nameLo,nameEn,categoryId,unitId,standardPrice,minStock,maxStock,location,barcode';
  const example  = `P001,ກະດາດ A4,A4 Paper,${categories[0]?.id ?? 1},${units[0]?.id ?? 1},25000,10,500,A1,`;
  const comment1 = `# ໝວດໝູ່ (categoryId): ${catInfo}`;
  const comment2 = `# ຫົວໜ່ວຍ (unitId): ${unitInfo}`;
  const content  = `${comment1}\n${comment2}\n${header}\n${example}\n`;
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'product_import_template.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function ProductImportModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [fileName, setFileName] = useState('');

  const { data: catData }  = useQuery({ queryKey: ['categories'], queryFn: () => categoryApi.list() });
  const { data: unitData } = useQuery({ queryKey: ['units'],      queryFn: () => unitApi.list() });
  const categories: Category[] = (catData?.data  as { data: Category[] } | undefined)?.data ?? [];
  const units: Unit[]          = (unitData?.data as { data: Unit[] }     | undefined)?.data ?? [];

  const importMut = useMutation({
    mutationFn: (rows: CsvRow[]) => productApi.import(rows),
    onSuccess: (res) => {
      const d = (res.data as { data: { created: number; errors: { row: number; code: string; error: string }[] } }).data;
      if (d.errors.length === 0) {
        toast.success(`ນຳເຂົ້າສຳເລັດ ${d.created} ລາຍການ`);
        qc.invalidateQueries({ queryKey: ['products'] });
        handleClose();
      } else {
        toast.error(`ສຳເລັດ ${d.created} / ຜິດພາດ ${d.errors.length} ລາຍການ`);
        qc.invalidateQueries({ queryKey: ['products'] });
      }
    },
    onError: (e: { response?: { data?: { message?: string } } }) =>
      toast.error(e?.response?.data?.message ?? 'ເກີດຂໍ້ຜິດພາດ'),
  });

  const handleClose = () => { setPreview([]); setFileName(''); onClose(); };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      const parsed: PreviewRow[] = rows.map((r, i) => {
        const errors: string[] = [];
        if (!r.code)       errors.push('ຂາດ code');
        if (!r.nameLo)     errors.push('ຂາດ nameLo');
        if (!r.categoryId) errors.push('ຂາດ categoryId');
        if (!r.unitId)     errors.push('ຂາດ unitId');
        return {
          _line:         i + 2,
          _error:        errors.length ? errors.join(', ') : undefined,
          code:          r.code,
          nameLo:        r.nameLo,
          nameEn:        r.nameEn || undefined,
          categoryId:    Number(r.categoryId),
          unitId:        Number(r.unitId),
          standardPrice: Number(r.standardPrice ?? 0),
          minStock:      Number(r.minStock ?? 0),
          maxStock:      Number(r.maxStock ?? 0),
          location:      r.location || undefined,
          barcode:       r.barcode || undefined,
        };
      });
      setPreview(parsed);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const validRows  = preview.filter((r) => !r._error);
  const invalidRows = preview.filter((r) => r._error);

  return (
    <Modal open={open} onClose={handleClose} title="ນຳເຂົ້າສິນຄ້າ (CSV)" size="xl">
      <div className="space-y-4">

        {/* Step 1: Download template */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm font-medium text-blue-800 mb-2">ຂັ້ນຕອນທີ 1: ດາວໂຫຼດ Template</p>
          <p className="text-xs text-blue-600 mb-3">
            Template ຈະມີ ID ໝວດໝູ່ ແລະ ຫົວໜ່ວຍ ທີ່ຖືກຕ້ອງ ສຳລັບ database ຂອງທ່ານ
          </p>
          <Button variant="secondary" onClick={() => downloadTemplate(categories, units)}>
            <Download className="w-4 h-4" />ດາວໂຫຼດ Template CSV
          </Button>
        </div>

        {/* Step 2: Upload */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-400 transition-colors">
          <p className="text-sm font-medium text-gray-700 mb-2">ຂັ້ນຕອນທີ 2: Upload ໄຟລ໌ CSV</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          {fileName ? (
            <div className="flex items-center justify-center gap-2 text-sm text-green-700">
              <CheckCircle className="w-4 h-4" />{fileName}
            </div>
          ) : (
            <p className="text-xs text-gray-400 mb-3">ເລືອກໄຟລ໌ .csv</p>
          )}
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="mt-2">
            <Upload className="w-4 h-4" />{fileName ? 'ປ່ຽນໄຟລ໌' : 'ເລືອກໄຟລ໌'}
          </Button>
        </div>

        {/* Step 3: Preview */}
        {preview.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                ຂັ້ນຕອນທີ 3: ກວດສອບຂໍ້ມູນ ({preview.length} ລາຍການ)
              </p>
              <div className="flex gap-3 text-xs">
                <span className="text-green-600 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />{validRows.length} ຖືກ
                </span>
                {invalidRows.length > 0 && (
                  <span className="text-red-600 flex items-center gap-1">
                    <XCircle className="w-3 h-3" />{invalidRows.length} ຜິດ
                  </span>
                )}
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg overflow-x-auto max-h-56 overflow-y-auto">
              <table className="min-w-full text-xs divide-y divide-gray-100">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['ແຖວ', 'Code', 'ຊື່', 'Cat ID', 'Unit ID', 'ລາຄາ', 'Min', 'ສະຖານະ'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.map((r) => (
                    <tr key={r._line} className={r._error ? 'bg-red-50' : 'bg-white'}>
                      <td className="px-3 py-1.5 text-gray-400">{r._line}</td>
                      <td className="px-3 py-1.5 font-mono">{r.code}</td>
                      <td className="px-3 py-1.5">{r.nameLo}</td>
                      <td className="px-3 py-1.5">{r.categoryId}</td>
                      <td className="px-3 py-1.5">{r.unitId}</td>
                      <td className="px-3 py-1.5">{r.standardPrice.toLocaleString()}</td>
                      <td className="px-3 py-1.5">{r.minStock}</td>
                      <td className="px-3 py-1.5">
                        {r._error
                          ? <span className="text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r._error}</span>
                          : <span className="text-green-600"><CheckCircle className="w-3 h-3 inline" /></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidRows.length > 0 && (
              <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                ຈະ import ສະເພາະ {validRows.length} ລາຍການທີ່ຖືກຕ້ອງ
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2 justify-end pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={handleClose}>ຍົກເລີກ</Button>
          <Button
            disabled={validRows.length === 0}
            loading={importMut.isPending}
            onClick={() => importMut.mutate(validRows)}
          >
            <Upload className="w-4 h-4" />
            ນຳເຂົ້າ {validRows.length > 0 ? `(${validRows.length} ລາຍການ)` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
