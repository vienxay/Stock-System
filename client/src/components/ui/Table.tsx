import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export interface Column<T> {
  key:        string;
  label:      string;
  render?:    (row: T) => ReactNode;
  className?: string;
}

interface Props<T> {
  columns:     Column<T>[];
  data:        T[];
  loading?:    boolean;
  keyField:    keyof T;
  onRowClick?: (row: T) => void;
}

export function Table<T>({ columns, data, loading, keyField, onRowClick }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-left font-semibold text-gray-600 whitespace-nowrap ${col.className ?? ''}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {loading ? (
            <tr><td colSpan={columns.length} className="py-12 text-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />ກຳລັງໂຫຼດ...
            </td></tr>
          ) : data.length === 0 ? (
            <tr><td colSpan={columns.length} className="py-12 text-center text-gray-400">ບໍ່ມີຂໍ້ມູນ</td></tr>
          ) : data.map((row, i) => (
            <tr
              key={String(row[keyField] ?? i)}
              onClick={() => onRowClick?.(row)}
              className={onRowClick ? 'cursor-pointer hover:bg-gray-50 transition-colors' : ''}
            >
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 text-gray-700 ${col.className ?? ''}`}>
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '-')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
