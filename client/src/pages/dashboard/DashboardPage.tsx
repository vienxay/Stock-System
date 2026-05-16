import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import {
  FileText, ShoppingCart, Receipt, AlertTriangle,
  TrendingUp, ArrowRight, Package, CheckCircle,
  Banknote, CalendarDays, Clock, BadgeCheck,
} from 'lucide-react';
import { dashboardApi } from '@/api/endpoints';
import type { DashboardSummary } from '@/types';

// ─── Colour palettes ──────────────────────────────────────────
const PR_COLORS: Record<string, string> = {
  draft:            '#94a3b8',
  finance_review:   '#f59e0b',
  finance_rejected: '#ef4444',
  md_review:        '#8b5cf6',
  md_approved:      '#10b981',
  md_rejected:      '#ef4444',
  po_created:       '#3b82f6',
  cancelled:        '#d1d5db',
};
const PO_COLORS: Record<string, string> = {
  open:             '#f59e0b',
  sent:             '#3b82f6',
  partial_received: '#8b5cf6',
  received:         '#10b981',
  cancelled:        '#d1d5db',
};

// ─── KPI Card ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, gradient, textColor }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; gradient: string; textColor: string;
}) {
  return (
    <div className={`rounded-2xl p-5 text-white shadow-lg ${gradient} relative overflow-hidden`}>
      <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
      <div className="absolute -right-1 -bottom-6 w-16 h-16 rounded-full bg-white/10" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-white/80">{label}</span>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
        <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
        {sub && <p className="text-xs text-white/70 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Procurement Flow ─────────────────────────────────────────
function FlowStep({ label, count, icon: Icon, color, bg, isLast }: {
  label: string; count: number; icon: React.ElementType;
  color: string; bg: string; isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
      <div className="flex-1 flex flex-col items-center gap-1 sm:gap-2 min-w-0">
        <div className={`w-9 h-9 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-sm sm:shadow-md shrink-0 ${bg}`}>
          <Icon className={`w-4 h-4 sm:w-7 sm:h-7 ${color}`} />
        </div>
        <p className={`text-lg sm:text-2xl font-bold leading-none ${color}`}>{count.toLocaleString()}</p>
        <p className="text-[10px] sm:text-xs text-gray-500 text-center font-medium leading-tight">{label}</p>
      </div>
      {!isLast && (
        <ArrowRight className="w-3 h-3 sm:w-5 sm:h-5 text-gray-300 shrink-0 mb-4" />
      )}
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────
const AreaTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-semibold text-gray-700 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
};

const PieTooltip = ({ active, payload }: { active?: boolean; payload?: { name: string; value: number }[] }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700">{payload[0].name}</p>
      <p className="font-bold text-gray-900">{payload[0].value} ລາຍການ</p>
    </div>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-gray-100 ${className}`} />;
}

// ─── Main ─────────────────────────────────────────────────────
export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn:  () => dashboardApi.summary(),
    refetchInterval: 60_000,
  });

  const d: DashboardSummary | undefined = (data?.data as { data: DashboardSummary } | undefined)?.data;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-24" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="lg:col-span-2 h-72" />
          <Skeleton className="h-72" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64" />
          <Skeleton className="lg:col-span-2 h-64" />
        </div>
      </div>
    );
  }

  // ─── Derived values ─────────────────────────────────────────
  const prPending  = (d?.pr.find((p) => p.status === 'finance_review')?._count.id ?? 0)
                   + (d?.pr.find((p) => p.status === 'md_review')?._count.id ?? 0);
  const poActive   = (d?.po.find((p) => p.status === 'open')?._count.id ?? 0)
                   + (d?.po.find((p) => p.status === 'sent')?._count.id ?? 0);

  const prPieData  = (d?.pr ?? [])
    .filter((p) => p._count.id > 0)
    .map((p) => ({ name: p.status.replace(/_/g, ' '), value: p._count.id, status: p.status }));

  // PO status — ສະແດງທຸກ status ລວມຖ້ວນ (ລວມ 0)
  const PO_STATUS_LABELS: Record<string, string> = {
    open:             'ເປີດ',
    sent:             'ສົ່ງ Supplier',
    partial_received: 'ຮັບບາງສ່ວນ',
    received:         'ຮັບຄົບ',
    cancelled:        'ຍົກເລີກ',
  };
  const PO_STATUS_ALL: import('@/types').PoStatus[] = ['open', 'sent', 'partial_received', 'received', 'cancelled'];
  const poStatusMap   = new Map((d?.po ?? []).map((p) => [p.status, p._count.id]));
  const poStatusData  = PO_STATUS_ALL.map((s) => ({
    status: s,
    label:  PO_STATUS_LABELS[s] ?? s,
    count:  poStatusMap.get(s) ?? 0,
    color:  PO_COLORS[s] ?? '#94a3b8',
  }));
  const poTotal = poStatusData.reduce((s, p) => s + p.count, 0);

  const monthlyChart = (d?.monthly ?? []).map((m) => ({
    month:    m.month,
    'ຈຳນວນ PR': m.prCount,
    'ຈຳນວນ PO (ລ້ານ)': +(m.poAmount / 1_000_000).toFixed(2),
  }));

  const prTotal = d?.flow.pr ?? 0;

  return (
    <div className="space-y-5">

      {/* ─── Page Title ─────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">ພາບລວມລະບົບ Procurement & Stock</p>
        </div>
        <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full self-start sm:self-auto">
          ອັບເດດທຸກ 60 ວິ
        </span>
      </div>

      {/* ─── KPI Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          label="PR ລໍຮັບອະນຸມັດ"
          value={prPending}
          sub="Finance & MD review"
          icon={FileText}
          gradient="bg-gradient-to-br from-amber-400 to-orange-500"
          textColor=""
        />
        <KpiCard
          label="PO ກຳລັງດຳເນີນ"
          value={poActive}
          sub="Open + Sent"
          icon={ShoppingCart}
          gradient="bg-gradient-to-br from-blue-500 to-indigo-600"
          textColor=""
        />
        <KpiCard
          label="Invoice ລໍດຳເນີນການ"
          value={d?.pendingInvoices ?? 0}
          sub="Matched + Approved"
          icon={Receipt}
          gradient="bg-gradient-to-br from-violet-500 to-purple-600"
          textColor=""
        />
        <KpiCard
          label="ສິນຄ້າ Stock ນ້ອຍ"
          value={d?.lowStockCount ?? 0}
          sub="ນ້ອຍກວ່າຂີດຈຳກັດ"
          icon={AlertTriangle}
          gradient="bg-gradient-to-br from-rose-500 to-red-600"
          textColor=""
        />
      </div>

      {/* ─── Procurement Flow ───────────────────────────────── */}
      <div className="card">
        <h3 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary-600" />
          ການໄຫຼຂໍ້ມູນ Procurement
        </h3>
        <div className="flex items-center overflow-x-auto pb-1 gap-0">
          <FlowStep label="ໃບຂໍຊື້ PR"    count={d?.flow.pr      ?? 0} icon={FileText}    color="text-amber-600"   bg="bg-amber-50"   />
          <FlowStep label="ໃບສັ່ງຊື້ PO"   count={d?.flow.po      ?? 0} icon={ShoppingCart} color="text-blue-600"    bg="bg-blue-50"    />
          <FlowStep label="ຮັບ GR"         count={d?.flow.gr      ?? 0} icon={Package}      color="text-green-600"   bg="bg-green-50"   />
          <FlowStep label="Invoice"        count={d?.flow.invoice ?? 0} icon={Receipt}      color="text-violet-600"  bg="bg-violet-50"  />
          <FlowStep label="ຊຳລະແລ້ວ"      count={d?.flow.paid    ?? 0} icon={CheckCircle}  color="text-emerald-600" bg="bg-emerald-50" isLast />
        </div>
        {/* Progress bar */}
        {prTotal > 0 && (
          <div className="mt-5 h-2 bg-gray-100 rounded-full overflow-hidden flex">
            {[
              { val: d?.flow.pr ?? 0, color: 'bg-amber-400' },
              { val: d?.flow.po ?? 0, color: 'bg-blue-500' },
              { val: d?.flow.gr ?? 0, color: 'bg-green-500' },
              { val: d?.flow.invoice ?? 0, color: 'bg-violet-500' },
              { val: d?.flow.paid ?? 0, color: 'bg-emerald-500' },
            ].map((s, i) => (
              <div
                key={i}
                className={`h-full ${s.color} transition-all`}
                style={{ width: `${(s.val / (prTotal || 1)) * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ─── Charts Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

        {/* Area Chart — Monthly Trend */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary-600" />
            ແນວໂນ້ມ 6 ເດືອນຜ່ານມາ
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthlyChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradPR" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPO" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<AreaTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Area type="monotone" dataKey="ຈຳນວນ PR" stroke="#3b82f6" strokeWidth={2.5}
                fill="url(#gradPR)" dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="ຈຳນວນ PO (ລ້ານ)" stroke="#10b981" strokeWidth={2.5}
                fill="url(#gradPO)" dot={{ r: 4, fill: '#10b981', strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Pie — PR Status */}
        <div className="card">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-500" />
            ສະຖານະ PR
          </h3>
          {prPieData.length === 0 ? (
            <div className="flex items-center justify-center h-44 text-gray-400 text-sm">ບໍ່ມີຂໍ້ມູນ</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={prPieData} cx="50%" cy="50%" innerRadius={52} outerRadius={80}
                  paddingAngle={3} dataKey="value">
                  {prPieData.map((entry) => (
                    <Cell key={entry.status} fill={PR_COLORS[entry.status] ?? '#94a3b8'} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-1.5 mt-1">
            {prPieData.slice(0, 5).map((p) => (
              <div key={p.status} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PR_COLORS[p.status] ?? '#94a3b8' }} />
                  <span className="text-gray-500 truncate max-w-[130px]">{p.name}</span>
                </div>
                <span className="font-semibold text-gray-800 ml-2">{p.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Payment Summary ────────────────────────────────── */}
      <div className="card bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-100">
        <h3 className="font-semibold text-gray-900 mb-4 sm:mb-5 flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-600" />
          ສະຫລຸບຍອດການຊຳລະ
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">

          {/* ຈ່າຍທັງໝົດ */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-emerald-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <BadgeCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">ຍອດຈ່າຍທັງໝົດ</span>
            </div>
            <p className="text-xl font-bold text-emerald-700 leading-tight">
              {Number(d?.totalPaidAmount ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">₭ ສະສົມຕັ້ງແຕ່ເລີ່ມ</p>
          </div>

          {/* ຈ່າຍປີນີ້ */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-blue-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <CalendarDays className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">ຈ່າຍປີນີ້</span>
            </div>
            <p className="text-xl font-bold text-blue-700 leading-tight">
              {Number(d?.thisYearPaid ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">₭ ປີ {new Date().getFullYear()}</p>
          </div>

          {/* ຈ່າຍເດືອນນີ້ */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-violet-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-violet-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">ຈ່າຍເດືອນນີ້</span>
            </div>
            <p className="text-xl font-bold text-violet-700 leading-tight">
              {Number(d?.thisMonthPaid ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              ₭ ເດືອນ {new Date().toLocaleDateString('lo-LA', { month: 'long' })}
            </p>
          </div>

          {/* ລໍຊຳລະ */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-orange-100">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                <Clock className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">ຍັງລໍຊຳລະ</span>
            </div>
            <p className="text-xl font-bold text-orange-600 leading-tight">
              {Number(d?.pendingPaymentAmt ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">₭ Invoice ທີ່ອະນຸມັດແລ້ວ</p>
          </div>

        </div>

        {/* Progress bar: ຈ່າຍແລ້ວ vs ຍັງຄ້າງ */}
        {(Number(d?.totalPaidAmount ?? 0) + Number(d?.pendingPaymentAmt ?? 0)) > 0 && (() => {
          const paid    = Number(d?.totalPaidAmount ?? 0);
          const pending = Number(d?.pendingPaymentAmt ?? 0);
          const total   = paid + pending;
          const paidPct = Math.round((paid / total) * 100);
          return (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
                <span>ຊຳລະແລ້ວ {paidPct}%</span>
                <span>ຄ້າງ {100 - paidPct}%</span>
              </div>
              <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${paidPct}%` }}
                />
                <div
                  className="h-full bg-orange-400 rounded-full transition-all"
                  style={{ width: `${100 - paidPct}%` }}
                />
              </div>
              <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                  ຊຳລະແລ້ວ {paid.toLocaleString()} ₭
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  ຍັງຄ້າງ {pending.toLocaleString()} ₭
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ─── Bottom Row ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">

        {/* PO Status List */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-blue-500" />
              ສະຖານະ PO
            </h3>
            <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {poTotal} ລາຍການ
            </span>
          </div>
          <div className="space-y-3">
            {poStatusData.map((s) => {
              const pct = poTotal > 0 ? Math.round((s.count / poTotal) * 100) : 0;
              return (
                <div key={s.status}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-sm text-gray-600">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{pct}%</span>
                      <span className="text-sm font-bold text-gray-800 w-6 text-right">{s.count}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Items */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              ສິນຄ້າ Stock ນ້ອຍ ({d?.lowStockCount ?? 0} ລາຍການ)
            </h3>
          </div>

          {(d?.lowStockItems ?? []).length === 0 ? (
            <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
              <div className="text-center">
                <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                Stock ທຸກລາຍການຢູ່ໃນລະດັບດີ
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(d?.lowStockItems ?? []).map((item) => {
                const pct = Math.max(0, Math.min(100, (item.currentStock / item.minStock) * 100));
                const danger = pct < 30;
                return (
                  <div key={item.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${danger ? 'bg-red-100' : 'bg-orange-100'}`}>
                      <Package className={`w-4 h-4 ${danger ? 'text-red-600' : 'text-orange-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">{item.nameLo}</p>
                        <span className={`text-xs font-bold shrink-0 ${danger ? 'text-red-600' : 'text-orange-600'}`}>
                          {item.currentStock} / {item.minStock}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-400 font-mono">{item.code}</span>
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${danger ? 'bg-red-500' : 'bg-orange-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 shrink-0">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
