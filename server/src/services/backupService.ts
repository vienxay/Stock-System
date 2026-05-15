import ExcelJS   from 'exceljs';
import fs         from 'fs';
import path       from 'path';
import { prisma } from '../config/prisma';

const BACKUP_DIR = path.join(process.cwd(), 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

const ts = () => {
  const d = new Date();
  return `${d.toISOString().slice(0, 10)}_${String(d.getHours()).padStart(2,'0')}h${String(d.getMinutes()).padStart(2,'0')}`;
};

// ─── Helper: fetch all data ───────────────────────────────────
async function fetchAll() {
  const [
    users, roles, categories, units, suppliers, products,
    purchaseRequests, prItems, prApprovals,
    purchaseOrders, poItems, goodsReceipts, grItems,
    invoices, payments, stockMovements, systemSettings,
  ] = await prisma.$transaction([
    prisma.user.findMany({ select: { id:true, username:true, fullName:true, email:true, phone:true, department:true, employeeId:true, isActive:true, createdAt:true, role: { select: { code:true, nameLo:true } } } }),
    prisma.role.findMany(),
    prisma.category.findMany(),
    prisma.unit.findMany(),
    prisma.supplier.findMany(),
    prisma.product.findMany(),
    prisma.purchaseRequest.findMany(),
    prisma.purchaseRequestItem.findMany(),
    prisma.prApproval.findMany(),
    prisma.purchaseOrder.findMany(),
    prisma.purchaseOrderItem.findMany(),
    prisma.goodsReceipt.findMany(),
    prisma.goodsReceiptItem.findMany(),
    prisma.invoice.findMany(),
    prisma.payment.findMany(),
    prisma.stockMovement.findMany(),
    prisma.systemSettings.findFirst(),
  ]);
  return {
    users, roles, categories, units, suppliers, products,
    purchaseRequests, prItems, prApprovals,
    purchaseOrders, poItems, goodsReceipts, grItems,
    invoices, payments, stockMovements, systemSettings,
  };
}

// ─── 1. JSON Backup ───────────────────────────────────────────
export async function createJsonBackup(saveToDisk = false) {
  const data = await fetchAll();
  const payload = {
    metadata: {
      version: '1.0', type: 'json',
      exportedAt: new Date().toISOString(),
      system: 'ລະບົບສາງ PR-PO',
    },
    data,
  };
  const json = JSON.stringify(payload, (_k, v) =>
    typeof v === 'bigint' ? Number(v) : v, 2);

  if (saveToDisk) {
    const file = path.join(BACKUP_DIR, `backup-json-${ts()}.json`);
    fs.writeFileSync(file, json, 'utf8');
    return { file, json };
  }
  return { json };
}

// ─── 2. SQL INSERT Backup ─────────────────────────────────────
export async function createSqlBackup(saveToDisk = false) {
  const data  = await fetchAll();
  const lines: string[] = [
    '-- ລະບົບສາງ PR-PO — SQL Backup',
    `-- Generated: ${new Date().toISOString()}`,
    `-- WARNING: ລຶບ table ເດີມກ່ອນ import ຖ້າ restore ໃໝ່ທັງໝົດ`,
    '',
  ];

  const esc = (v: unknown): string => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (v instanceof Date) return `'${v.toISOString()}'`;
    return `'${String(v).replace(/'/g, "''")}'`;
  };

  const insertBlock = (table: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    lines.push(`-- Table: ${table} (${rows.length} rows)`);
    for (const row of rows) {
      const cols = Object.keys(row).join(', ');
      const vals = Object.values(row).map(esc).join(', ');
      lines.push(`INSERT INTO ${table} (${cols}) VALUES (${vals}) ON CONFLICT DO NOTHING;`);
    }
    lines.push('');
  };

  insertBlock('roles',                  data.roles as Record<string, unknown>[]);
  insertBlock('categories',             data.categories as Record<string, unknown>[]);
  insertBlock('units',                  data.units as Record<string, unknown>[]);
  insertBlock('suppliers',              data.suppliers as Record<string, unknown>[]);
  insertBlock('products',               data.products as Record<string, unknown>[]);
  insertBlock('purchase_requests',      data.purchaseRequests as Record<string, unknown>[]);
  insertBlock('purchase_request_items', data.prItems as Record<string, unknown>[]);
  insertBlock('pr_approvals',           data.prApprovals as Record<string, unknown>[]);
  insertBlock('purchase_orders',        data.purchaseOrders as Record<string, unknown>[]);
  insertBlock('purchase_order_items',   data.poItems as Record<string, unknown>[]);
  insertBlock('goods_receipts',         data.goodsReceipts as Record<string, unknown>[]);
  insertBlock('goods_receipt_items',    data.grItems as Record<string, unknown>[]);
  insertBlock('invoices',               data.invoices as Record<string, unknown>[]);
  insertBlock('payments',               data.payments as Record<string, unknown>[]);
  insertBlock('stock_movements',        data.stockMovements as Record<string, unknown>[]);

  const sql = lines.join('\n');
  if (saveToDisk) {
    const file = path.join(BACKUP_DIR, `backup-sql-${ts()}.sql`);
    fs.writeFileSync(file, sql, 'utf8');
    return { file, sql };
  }
  return { sql };
}

// ─── 3. Excel Backup ──────────────────────────────────────────
export async function createExcelBackup(saveToDisk = false) {
  const data = await fetchAll();
  const wb   = new ExcelJS.Workbook();
  wb.creator = 'ລະບົບສາງ PR-PO';

  const styleHeader = (row: ExcelJS.Row) => {
    row.height = 24;
    row.eachCell((c) => {
      c.fill  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      c.font  = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Calibri' };
      c.alignment = { vertical: 'middle', horizontal: 'center' };
      c.border = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
    });
  };
  const styleRow = (row: ExcelJS.Row, idx: number) => {
    row.height = 18;
    row.eachCell((c) => {
      if (idx % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
      c.border = { top:{style:'thin',color:{argb:'FFD1D5DB'}}, left:{style:'thin',color:{argb:'FFD1D5DB'}},
                   bottom:{style:'thin',color:{argb:'FFD1D5DB'}}, right:{style:'thin',color:{argb:'FFD1D5DB'}} };
      c.alignment = { vertical: 'middle' };
    });
  };

  const addSheet = (name: string, rows: Record<string, unknown>[]) => {
    if (!rows.length) return;
    const ws   = wb.addWorksheet(name);
    const keys = Object.keys(rows[0]);
    ws.columns = keys.map((k) => ({ header: k, key: k, width: Math.min(Math.max(k.length + 4, 12), 30) }));
    styleHeader(ws.getRow(1));
    rows.forEach((r, i) => {
      const row = ws.addRow(Object.fromEntries(
        Object.entries(r).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : typeof v === 'bigint' ? Number(v) : v])
      ));
      styleRow(row, i);
    });
  };

  addSheet('users',            data.users         as Record<string, unknown>[]);
  addSheet('categories',       data.categories    as Record<string, unknown>[]);
  addSheet('units',            data.units         as Record<string, unknown>[]);
  addSheet('suppliers',        data.suppliers     as Record<string, unknown>[]);
  addSheet('products',         data.products      as Record<string, unknown>[]);
  addSheet('purchase_requests',data.purchaseRequests as Record<string, unknown>[]);
  addSheet('purchase_orders',  data.purchaseOrders   as Record<string, unknown>[]);
  addSheet('goods_receipts',   data.goodsReceipts    as Record<string, unknown>[]);
  addSheet('invoices',         data.invoices         as Record<string, unknown>[]);
  addSheet('payments',         data.payments         as Record<string, unknown>[]);
  addSheet('stock_movements',  data.stockMovements   as Record<string, unknown>[]);

  if (saveToDisk) {
    const file = path.join(BACKUP_DIR, `backup-excel-${ts()}.xlsx`);
    await wb.xlsx.writeFile(file);
    return { file, wb };
  }
  return { wb };
}

// ─── List saved backups ───────────────────────────────────────
export function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => /\.(json|sql|xlsx)$/.test(f))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      const type = f.endsWith('.sql') ? 'sql' : f.endsWith('.xlsx') ? 'excel' : 'json';
      return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString(), type };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ─── Delete old backups (keep latest N per type) ─────────────
export function cleanOldBackups(keepDays = 30) {
  const files = listBackups();
  const cutoff = Date.now() - keepDays * 24 * 60 * 60 * 1000;
  files.forEach(({ filename, createdAt }) => {
    if (new Date(createdAt).getTime() < cutoff) {
      fs.unlinkSync(path.join(BACKUP_DIR, filename));
    }
  });
}

export { BACKUP_DIR };
