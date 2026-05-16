import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, Eye, Plus, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { auditApi } from '@/api/endpoints';
import { Pagination } from '@/components/ui/Pagination';
import type { PaginationMeta } from '@/types';

interface AuditLog {
  id:         number;
  action:     'CREATE' | 'UPDATE' | 'DELETE';
  tableName:  string;
  tableLabel: string;
  recordId:   number;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  createdAt:  string;
  user:       { fullName: string; username: string };
}

interface Stats {
  byAction:    { action: string; _count: { id: number } }[];
  byTable:     { tableName: string; _count: { id: number } }[];
  recentUsers: { user: { fullName: string }; createdAt: string }[];
}

// ─── Field labels ທີ່ admin ອ່ານໄດ້ ──────────────────────────
const FIELD_LABELS: Record<string, string> = {
  code:          'ລະຫັດ',
  name:          'ຊື່',
  nameLo:        'ຊື່ (ລາວ)',
  nameEn:        'ຊື່ (ອັງກິດ)',
  email:         'Email',
  phone:         'ເບີໂທ',
  taxId:         'ເລກທະບຽນພາສີ',
  bankName:      'ທະນາຄານ',
  bankAccount:   'ເລກບັນຊີ',
  contactName:   'ຜູ້ຕິດຕໍ່',
  paymentTerm:   'ເງື່ອນໄຂຊຳລະ (ວັນ)',
  address:       'ທີ່ຢູ່',
  standardPrice: 'ລາຄາ (₭)',
  currentStock:  'Stock ປັດຈຸບັນ',
  minStock:      'Stock ໜ້ອຍສຸດ',
  maxStock:      'Stock ສູງສຸດ',
  isActive:      'ສະຖານະ',
  status:        'ສະຖານະ',
  poNumber:      'ເລກ PO',
  grNumber:      'ເລກ GR',
  invoiceNumber: 'ເລກ Invoice',
  invoiceAmount: 'ຈຳນວນ Invoice (₭)',
  taxAmount:     'ພາສີ (₭)',
  totalAmount:   'ລວມ (₭)',
  amountPaid:    'ຈຳນວນຊຳລະ (₭)',
  description:   'ລາຍລະອຽດ',
  location:      'ທີ່ຕັ້ງໃນສາງ',
  barcode:       'Barcode',
  parentId:      'ໝວດຫຼັກ ID',
  supplierId:    'Supplier ID',
  categoryId:    'ໝວດໝູ່ ID',
  unitId:        'ຫົວໜ່ວຍ ID',
};

const formatValue = (key: string, val: unknown): string => {
  if (val === null || val === undefined) return '-';
  if (key === 'isActive') return val ? 'ໃຊ້ງານ' : 'ປິດ';
  if (typeof val === 'boolean') return val ? 'ແມ່ນ' : 'ບໍ່';
  if (typeof val === 'number' && (key.toLowerCase().includes('amount') || key.toLowerCase().includes('price') || key === 'amountPaid')) {
    return `${Number(val).toLocaleString()} ₭`;
  }
  return String(val);
};

// ─── ຊອກ keys ທີ່ປ່ຽນແປງ ─────────────────────────────────────
const getChangedKeys = (
  oldData?: Record<string, unknown>,
  newData?: Record<string, unknown>,
): Set<string> => {
  if (!oldData || !newData) return new Set();
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const changed = new Set<string>();
  keys.forEach((k) => {
    if (String(oldData[k] ?? '') !== String(newData[k] ?? '')) changed.add(k);
  });
  return changed;
};

function DataTable({
  data, color, changedKeys, side,
}: {
  data:        Record<string, unknown>;
  color:       'green' | 'red' | 'blue';
  changedKeys: Set<string>;
  side:        'old' | 'new' | 'none';
}) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined);
  if (entries.length === 0) return null;

  const bg     = color === 'green' ? 'bg-green-50 border-green-200'
               : color === 'red'   ? 'bg-red-50 border-red-200'
               :                     'bg-blue-50 border-blue-200';
  const hdrCls = color === 'green' ? 'text-green-700'
               : color === 'red'   ? 'text-red-700'
               :                     'text-blue-700';

  return (
    <div className={`rounded-lg border ${bg} overflow-hidden`}>
      <table className="w-full text-xs">
        <tbody>
          {entries.map(([k, v]) => {
            const changed = changedKeys.has(k);
            const rowCls  = changed
              ? side === 'old'
                ? 'bg-red-200/60 border-b border-red-300'
                : 'bg-green-200/60 border-b border-green-300'
              : 'border-b border-white/60 last:border-0';
            return (
              <tr key={k} className={rowCls}>
                <td className={`px-3 py-1.5 font-semibold whitespace-nowrap w-40 ${changed ? (side === 'old' ? 'text-red-700' : 'text-green-700') : hdrCls}`}>
                  {changed && (
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${side === 'old' ? 'bg-red-500' : 'bg-green-500'}`} />
                  )}
                  {FIELD_LABELS[k] ?? k}
                </td>
                <td className={`px-3 py-1.5 ${changed ? (side === 'old' ? 'text-red-700 line-through opacity-75 font-medium' : 'text-green-800 font-bold') : 'text-gray-700'}`}>
                  {formatValue(k, v)}
                  {changed && side === 'new' && (
                    <span className="ml-2 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded-full font-semibold">ໃໝ່</span>
                  )}
                  {changed && side === 'old' && (
                    <span className="ml-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-semibold">ເກົ່າ</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const ACTION_CFG = {
  CREATE: { label: 'ສ້າງ',   icon: Plus,   cls: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'ແກ້ໄຂ', icon: Pencil, cls: 'bg-blue-100  text-blue-700'  },
  DELETE: { label: 'ລົບ',   icon: Trash2, cls: 'bg-red-100   text-red-700'   },
};

const TABLES = [
  { value: '',                label: 'ທຸກຕາຕະລາງ'     },
  { value: 'products',       label: 'ສິນຄ້າ'           },
  { value: 'suppliers',      label: 'Supplier'         },
  { value: 'categories',     label: 'ໝວດໝູ່'           },
  { value: 'users',          label: 'User'             },
  { value: 'purchase_orders',label: 'ໃບສັ່ງຊື້ PO'      },
  { value: 'invoices',       label: 'Invoice'          },
];

function ActionBadge({ action }: { action: 'CREATE' | 'UPDATE' | 'DELETE' }) {
  const cfg = ACTION_CFG[action];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

export default function AuditLogsPage() {
  const [page,      setPage]     = useState(1);
  const [table,     setTable]    = useState('');
  const [action,    setAction]   = useState('');
  const [from,      setFrom]     = useState('');
  const [to,        setTo]       = useState('');
  const [expanded,  setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', page, table, action, from, to],
    queryFn:  () => auditApi.list({
      page, limit: 25,
      table:     table   || undefined,
      action:    action  || undefined,
      from_date: from    || undefined,
      to_date:   to      || undefined,
    }),
  });

  const { data: statsData } = useQuery({
    queryKey: ['audit-stats'],
    queryFn:  () => auditApi.stats(),
    staleTime: 60_000,
  });

  const rows: AuditLog[]            = (data?.data as { data: AuditLog[] }         | undefined)?.data         ?? [];
  const meta: PaginationMeta | undefined = (data?.data as { pagination?: PaginationMeta } | undefined)?.pagination;
  const stats: Stats | undefined    = (statsData?.data as { data: Stats }         | undefined)?.data;

  const totalActions = stats?.byAction.reduce((s, a) => s + a._count.id, 0) ?? 0;

  const clearFilters = () => { setTable(''); setAction(''); setFrom(''); setTo(''); setPage(1); };

  return (
    <div className="space-y-5">

      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary-600" />ປະຫວັດການດຳເນີນການ (Audit Log)
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">ບັນທຶກທຸກການ ສ້າງ / ແກ້ໄຂ / ລົບ ຂໍ້ມູນໃນລະບົບ</p>
        </div>
        {totalActions > 0 && (
          <span className="text-sm font-semibold text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-100">
            {totalActions.toLocaleString()} ລາຍການ
          </span>
        )}
      </div>

      {/* ─── Stats Cards ─── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.byAction.map((a) => {
            const cfg = ACTION_CFG[a.action as 'CREATE' | 'UPDATE' | 'DELETE'];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={a.action} className="card flex items-center gap-3 py-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${cfg.cls}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold text-gray-900">{a._count.id.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{cfg.label}ທັງໝົດ</p>
                </div>
              </div>
            );
          })}
          {stats.byTable.slice(0, 4 - (stats.byAction.length || 0)).map((t) => (
            <div key={t.tableName} className="card flex items-center gap-3 py-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                <Eye className="w-4 h-4 text-slate-600" />
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{t._count.id.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{t.tableName}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── Filters ─── */}
      <div className="card flex flex-wrap gap-3 items-end">
        <div>
          <label className="label">ຕາຕະລາງ</label>
          <select value={table} onChange={(e) => { setTable(e.target.value); setPage(1); }} className="input w-44">
            {TABLES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label">ການດຳເນີນ</label>
          <select value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} className="input w-36">
            <option value="">ທັງໝົດ</option>
            <option value="CREATE">ສ້າງ</option>
            <option value="UPDATE">ແກ້ໄຂ</option>
            <option value="DELETE">ລົບ</option>
          </select>
        </div>
        <div>
          <label className="label">ຈາກວັນທີ</label>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="input" />
        </div>
        <div>
          <label className="label">ຫາວັນທີ</label>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="input" />
        </div>
        {(table || action || from || to) && (
          <button onClick={clearFilters} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-600 transition-colors mb-0.5">
            <RefreshCw className="w-4 h-4" />ລ້າງ
          </button>
        )}
      </div>

      {/* ─── Table ─── */}
      <div className="card overflow-x-auto p-0">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">ກຳລັງໂຫຼດ...</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-400">ຍັງບໍ່ມີລາຍການ Audit Log</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {['ວັນທີ-ເວລາ','ຜູ້ດຳເນີນ','ການດຳເນີນ','ຕາຕະລາງ','Record ID','IP Address',''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((log) => (
                <React.Fragment key={log.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString('lo-LA')}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{log.user?.fullName ?? '-'}</p>
                      <p className="text-xs text-gray-400">@{log.user?.username}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ActionBadge action={log.action} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-700">{log.tableLabel}</span>
                      <span className="text-xs text-gray-400 ml-1">({log.tableName})</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">#{log.recordId}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400">{log.ipAddress || '-'}</td>
                    <td className="px-4 py-3">
                      {(!!log.oldValues || !!log.newValues) && (
                        <button
                          onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          {expanded === log.id ? 'ປິດ' : 'ລາຍລະອຽດ'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expanded === log.id && (() => {
                    const oldData = log.oldValues as Record<string, unknown> | undefined;
                    const newData = log.newValues as Record<string, unknown> | undefined;
                    const changedKeys = getChangedKeys(oldData, newData);
                    const hasChanges  = changedKeys.size > 0;
                    return (
                      <tr className="bg-slate-50">
                        <td colSpan={7} className="px-4 py-4">
                          {/* Legend */}
                          {hasChanges && log.action === 'UPDATE' && (
                            <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-red-200 inline-block border border-red-300" />
                                ຂໍ້ມູນທີ່ຖືກແກ້ໄຂ (ເກົ່າ)
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 rounded bg-green-200 inline-block border border-green-300" />
                                ຂໍ້ມູນໃໝ່ຫຼັງແກ້ໄຂ
                              </span>
                              <span className="font-medium text-primary-600">
                                {changedKeys.size} ຊ່ອງທີ່ປ່ຽນ
                              </span>
                            </div>
                          )}

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            {oldData && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-red-600 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                                  ຂໍ້ມູນກ່ອນແກ້ໄຂ
                                </p>
                                <DataTable data={oldData} color="red" changedKeys={changedKeys} side="old" />
                              </div>
                            )}
                            {newData && (
                              <div className="space-y-1.5">
                                <p className="text-xs font-semibold text-green-600 flex items-center gap-1">
                                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                                  {oldData ? 'ຂໍ້ມູນຫຼັງແກ້ໄຂ' : 'ຂໍ້ມູນທີ່ສ້າງ'}
                                </p>
                                <DataTable data={newData} color="green" changedKeys={changedKeys} side={oldData ? 'new' : 'none'} />
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })()}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {meta && <Pagination meta={meta} onChange={setPage} />}

    </div>
  );
}
