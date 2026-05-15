import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/types';

interface Props { meta: PaginationMeta; onChange: (page: number) => void; }

export function Pagination({ meta, onChange }: Props) {
  if (meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
      <span>ທັງໝົດ {meta.total.toLocaleString()} ລາຍການ</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(meta.page - 1)} disabled={!meta.hasPrevPage}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="px-3 py-1 bg-primary-600 text-white rounded font-medium">{meta.page}</span>
        <span className="px-2">/ {meta.totalPages}</span>
        <button onClick={() => onChange(meta.page + 1)} disabled={!meta.hasNextPage}
          className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
