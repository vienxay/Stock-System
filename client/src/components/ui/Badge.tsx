import type { ReactNode } from 'react';

const variants = {
  blue:   'bg-blue-100 text-blue-800',
  green:  'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  gray:   'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
};

type Variant = keyof typeof variants;

export function Badge({ children, variant = 'gray' }: { children: ReactNode; variant?: Variant }) {
  return <span className={`badge ${variants[variant]}`}>{children}</span>;
}

// ─── Status helpers ──────────────────────────────────────────
export function PrStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    draft:             ['Draft',            'gray'],
    finance_review:    ['ລໍ Finance',       'yellow'],
    finance_rejected:  ['Finance ປະຕິເສດ',  'red'],
    md_review:         ['ລໍ MD',            'yellow'],
    md_approved:       ['MD ອະນຸມັດ',       'blue'],
    md_rejected:       ['MD ປະຕິເສດ',       'red'],
    po_created:        ['ສ້າງ PO ແລ້ວ',     'green'],
    cancelled:         ['ຍົກເລີກ',          'red'],
  };
  const [label, v] = map[status] ?? [status, 'gray'];
  return <Badge variant={v}>{label}</Badge>;
}

export function PoStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    open:             ['ເປີດ',          'blue'],
    sent:             ['ສົ່ງແລ້ວ',      'yellow'],
    partial_received: ['ຮັບບາງສ່ວນ',   'orange'],
    received:         ['ຮັບຄົບ',        'green'],
    cancelled:        ['ຍົກເລີກ',       'red'],
  };
  const [label, v] = map[status] ?? [status, 'gray'];
  return <Badge variant={v}>{label}</Badge>;
}

export function InvoiceStatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, Variant]> = {
    received: ['ຮັບແລ້ວ',   'gray'],
    matched:  ['Match ✓',   'green'],
    mismatch: ['Mismatch ✗', 'red'],
    approved: ['ອະນຸມັດ',   'blue'],
    paid:     ['ຈ່າຍແລ້ວ',  'green'],
  };
  const [label, v] = map[status] ?? [status, 'gray'];
  return <Badge variant={v}>{label}</Badge>;
}

export function MovementBadge({ type }: { type: string }) {
  const map: Record<string, [string, Variant]> = {
    gr_in:      ['GR ເຂົ້າ',   'green'],
    issue_out:  ['ເບີກອອກ',    'red'],
    return_in:  ['ສົ່ງຄືນ',    'blue'],
    adjust_in:  ['ປັບເພີ່ມ',   'green'],
    adjust_out: ['ປັບຫຼຸດ',    'orange'],
    transfer:   ['ໂອນ',        'purple'],
  };
  const [label, v] = map[type] ?? [type, 'gray'];
  return <Badge variant={v}>{label}</Badge>;
}
