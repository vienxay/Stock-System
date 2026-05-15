import ExcelJS from 'exceljs';
import { prisma } from '../config/prisma';

type Filters = { from?: string; to?: string; status?: string };

class ReportService {

  private styleHeader(row: ExcelJS.Row) {
    row.height = 28;
    row.eachCell((cell) => {
      cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.font   = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11, name: 'Phetsarath OT' };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' },
        bottom: { style: 'thin' }, right: { style: 'thin' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });
  }

  private styleRow(row: ExcelJS.Row, idx: number) {
    row.height = 20;
    row.eachCell((cell) => {
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
      }
      cell.border = {
        top:    { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left:   { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right:  { style: 'thin', color: { argb: 'FFD1D5DB' } },
      };
      cell.alignment = { vertical: 'middle' };
    });
  }

  private addTitle(ws: ExcelJS.Worksheet, title: string, colCount: number) {
    ws.mergeCells(1, 1, 1, colCount);
    const cell = ws.getCell('A1');
    cell.value     = title;
    cell.font      = { bold: true, size: 14, color: { argb: 'FF1E40AF' }, name: 'Phetsarath OT' };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 36;

    ws.mergeCells(2, 1, 2, colCount);
    const sub  = ws.getCell('A2');
    sub.value  = `ວັນທີ Export: ${new Date().toLocaleDateString('lo-LA')}`;
    sub.font   = { size: 10, color: { argb: 'FF6B7280' }, name: 'Phetsarath OT' };
    sub.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 20;
  }

  // ─── Stock Report ──────────────────────────────────────────
  async stockReport() {
    const products = await prisma.product.findMany({
      where:   { isActive: true },
      include: { category: { select: { nameLo: true } }, unit: { select: { nameLo: true } } },
      orderBy: [{ category: { nameLo: 'asc' } }, { nameLo: 'asc' }],
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stock System';
    const ws   = wb.addWorksheet('Stock');

    const cols = [
      { header: '#',              key: 'no',       width: 5 },
      { header: 'ລະຫັດສິນຄ້າ',    key: 'code',     width: 14 },
      { header: 'ຊື່ສິນຄ້າ',       key: 'name',     width: 30 },
      { header: 'ໝວດໝູ່',          key: 'category', width: 16 },
      { header: 'ໜ່ວຍ',            key: 'unit',     width: 10 },
      { header: 'Stock ປັດຈຸບັນ',  key: 'current',  width: 15 },
      { header: 'Stock ໜ້ອຍສຸດ',    key: 'min',      width: 13 },
      { header: 'Stock ສູງສຸດ',    key: 'max',      width: 13 },
      { header: 'ລາຄາ/ໜ່ວຍ (₭)',   key: 'price',    width: 16 },
      { header: 'ມູນຄ່າລວມ (₭)',   key: 'value',    width: 16 },
      { header: 'ສະຖານະ',          key: 'status',   width: 12 },
    ];
    this.addTitle(ws, 'ລາຍງານສາງສິນຄ້າ', cols.length);
    ws.addRow([]);  // spacer
    ws.columns = cols;
    const hRow = ws.getRow(4);
    hRow.values = cols.map((c) => c.header);
    this.styleHeader(hRow);

    let lowCount = 0;
    products.forEach((p, i) => {
      const isLow   = p.currentStock <= p.minStock;
      const row     = ws.addRow({
        no: i + 1, code: p.code, name: p.nameLo,
        category: p.category.nameLo, unit: p.unit.nameLo,
        current: p.currentStock, min: p.minStock, max: p.maxStock,
        price: Number(p.standardPrice),
        value: p.currentStock * Number(p.standardPrice),
        status: isLow ? 'ນ້ອຍ ⚠' : 'ປົກກະຕິ',
      });
      this.styleRow(row, i);
      if (isLow) {
        row.getCell('current').font = { bold: true, color: { argb: 'FFEF4444' }, name: 'Phetsarath OT' };
        row.getCell('status').font  = { bold: true, color: { argb: 'FFEF4444' }, name: 'Phetsarath OT' };
        lowCount++;
      }
    });

    // ─── Summary row ──────────────────────────────────────────
    const totalValue = products.reduce((s, p) => s + p.currentStock * Number(p.standardPrice), 0);
    ws.addRow([]);
    const sumRow = ws.addRow({
      no: '', code: `ລວມທັງໝົດ (${products.length} ລາຍການ)`,
      name: '', category: '', unit: '',
      current: products.reduce((s, p) => s + p.currentStock, 0),
      min: '', max: '',
      price: '',
      value: totalValue,
      status: `Stock ນ້ອຍ: ${lowCount} ລາຍການ`,
    });
    sumRow.height = 24;
    sumRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Phetsarath OT', size: 11 };
      cell.alignment = { vertical: 'middle' };
    });
    sumRow.getCell('current').numFmt = '#,##0';
    sumRow.getCell('value').numFmt   = '#,##0';

    return wb;
  }

  // ─── PR Report ─────────────────────────────────────────────
  async prReport(f: Filters = {}) {
    const where: Record<string, unknown> = {};
    if (f.status) where.status = f.status;
    if (f.from || f.to) where.createdAt = {
      ...(f.from && { gte: new Date(f.from) }),
      ...(f.to   && { lte: new Date(f.to + 'T23:59:59') }),
    };

    const prs = await prisma.purchaseRequest.findMany({
      where,
      include: {
        requester: { select: { fullName: true } },
        _count:    { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stock System';
    const ws   = wb.addWorksheet('PR');

    const cols = [
      { header: '#',           key: 'no',       width: 5  },
      { header: 'ເລກ PR',      key: 'prNum',    width: 16 },
      { header: 'ຜູ້ຂໍຊື້',     key: 'req',      width: 22 },
      { header: 'ພະແນກ',       key: 'dept',     width: 16 },
      { header: 'ຈຸດປະສົງ',    key: 'purpose',  width: 22 },
      { header: 'ຈຳນວນ (₭)',   key: 'amount',   width: 16 },
      { header: 'ລາຍການ',      key: 'items',    width: 10 },
      { header: 'ຄວາມສຳຄັນ',   key: 'priority', width: 13 },
      { header: 'ສະຖານະ',      key: 'status',   width: 20 },
      { header: 'ວັນທີສ້າງ',    key: 'date',     width: 15 },
    ];
    this.addTitle(ws, 'ລາຍງານໃບຂໍຊື້ (PR)', cols.length);
    ws.addRow([]);
    ws.columns = cols;
    const hRow = ws.getRow(4);
    hRow.values = cols.map((c) => c.header);
    this.styleHeader(hRow);

    prs.forEach((pr, i) => {
      const row = ws.addRow({
        no: i + 1, prNum: pr.prNumber,
        req: pr.requester.fullName, dept: pr.department ?? '-',
        purpose: pr.purpose ?? '-',
        amount: Number(pr.totalAmount), items: pr._count.items,
        priority: pr.priority, status: pr.status,
        date: new Date(pr.createdAt).toLocaleDateString('lo-LA'),
      });
      this.styleRow(row, i);
    });

    ws.addRow([]);
    const sumRow = ws.addRow(['', '', '', '', '', '', `ລວມ: ${prs.length} ລາຍການ`]);
    sumRow.font = { bold: true, name: 'Phetsarath OT' };

    return wb;
  }

  // ─── PO Report ─────────────────────────────────────────────
  async poReport(f: Filters = {}) {
    const where: Record<string, unknown> = {};
    if (f.status) where.status = f.status;
    if (f.from || f.to) where.createdAt = {
      ...(f.from && { gte: new Date(f.from) }),
      ...(f.to   && { lte: new Date(f.to + 'T23:59:59') }),
    };

    const pos = await prisma.purchaseOrder.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        creator:  { select: { fullName: true } },
        items:    true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stock System';
    const ws   = wb.addWorksheet('PO');

    const cols = [
      { header: '#',          key: 'no',       width: 5  },
      { header: 'ເລກ PO',     key: 'poNum',    width: 16 },
      { header: 'Supplier',   key: 'supplier', width: 24 },
      { header: 'ຜູ້ສ້າງ',     key: 'creator',  width: 20 },
      { header: 'ຈຳນວນ (₭)', key: 'amount',   width: 16 },
      { header: 'ລາຍການ',     key: 'items',    width: 10 },
      { header: 'ສະຖານະ',     key: 'status',   width: 16 },
      { header: 'ວັນທີສ້າງ',   key: 'date',     width: 14 },
      { header: 'ວັນທີສົ່ງ',   key: 'sentAt',   width: 14 },
    ];
    this.addTitle(ws, 'ລາຍງານໃບສັ່ງຊື້ (PO)', cols.length);
    ws.addRow([]);
    ws.columns = cols;
    const hRow = ws.getRow(4);
    hRow.values = cols.map((c) => c.header);
    this.styleHeader(hRow);

    let total = 0;
    pos.forEach((po, i) => {
      total += Number(po.totalAmount);
      const row = ws.addRow({
        no: i + 1, poNum: po.poNumber,
        supplier: po.supplier.name, creator: po.creator.fullName,
        amount: Number(po.totalAmount), items: po.items.length,
        status: po.status,
        date:   new Date(po.createdAt).toLocaleDateString('lo-LA'),
        sentAt: po.sentAt ? new Date(po.sentAt).toLocaleDateString('lo-LA') : '-',
      });
      this.styleRow(row, i);
    });

    ws.addRow([]);
    const sumRow = ws.addRow(['', '', '', 'ລວມທັງໝົດ:', total, `${pos.length} ລາຍການ`]);
    sumRow.font = { bold: true, name: 'Phetsarath OT' };
    sumRow.getCell(5).numFmt = '#,##0';

    return wb;
  }

  // ─── Invoice Report ────────────────────────────────────────
  async invoiceReport(f: Filters = {}) {
    const where: Record<string, unknown> = {};
    if (f.status) where.status = f.status;
    if (f.from || f.to) where.invoiceDate = {
      ...(f.from && { gte: new Date(f.from) }),
      ...(f.to   && { lte: new Date(f.to + 'T23:59:59') }),
    };

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        supplier:      { select: { name: true } },
        purchaseOrder: { select: { poNumber: true } },
        goodsReceipt:  { select: { grNumber: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stock System';
    const ws   = wb.addWorksheet('Invoice');

    const cols = [
      { header: '#',             key: 'no',       width: 5  },
      { header: 'ເລກ Invoice',   key: 'invNum',   width: 18 },
      { header: 'Supplier',      key: 'supplier', width: 24 },
      { header: 'PO',            key: 'po',       width: 14 },
      { header: 'GR',            key: 'gr',       width: 14 },
      { header: 'ຈຳນວນ (₭)',     key: 'amount',   width: 16 },
      { header: 'ພາສີ (₭)',      key: 'tax',      width: 13 },
      { header: 'ລວມ (₭)',       key: 'total',    width: 15 },
      { header: 'ຜົນຕ່າງ (₭)',    key: 'variance', width: 14 },
      { header: 'ສະຖານະ',        key: 'status',   width: 14 },
      { header: 'ວັນທີ Invoice',  key: 'date',     width: 15 },
    ];
    this.addTitle(ws, 'ລາຍງານ Invoice', cols.length);
    ws.addRow([]);
    ws.columns = cols;
    const hRow = ws.getRow(4);
    hRow.values = cols.map((c) => c.header);
    this.styleHeader(hRow);

    let sumAmount = 0, sumTax = 0, sumTotal = 0;
    invoices.forEach((inv, i) => {
      sumAmount += Number(inv.invoiceAmount);
      sumTax    += Number(inv.taxAmount);
      sumTotal  += Number(inv.totalAmount);
      const variance = Number(inv.matchVariance);
      const row = ws.addRow({
        no: i + 1, invNum: inv.invoiceNumber,
        supplier: inv.supplier.name,
        po: inv.purchaseOrder.poNumber,
        gr: inv.goodsReceipt?.grNumber ?? '-',
        amount: Number(inv.invoiceAmount), tax: Number(inv.taxAmount),
        total: Number(inv.totalAmount), variance,
        status: inv.status,
        date: new Date(inv.invoiceDate).toLocaleDateString('lo-LA'),
      });
      this.styleRow(row, i);
      if (inv.status === 'mismatch') {
        row.getCell('variance').font = { bold: true, color: { argb: 'FFEF4444' }, name: 'Phetsarath OT' };
      }
    });

    // ─── Summary row ──────────────────────────────────────────
    ws.addRow([]);
    const sumRow = ws.addRow({
      no:       '',
      invNum:   `ລວມທັງໝົດ (${invoices.length} ລາຍການ)`,
      supplier: '', po: '', gr: '',
      amount:   sumAmount,
      tax:      sumTax,
      total:    sumTotal,
      variance: '',
      status:   '',
      date:     '',
    });
    sumRow.height = 24;
    sumRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, name: 'Phetsarath OT', size: 11 };
      cell.alignment = { vertical: 'middle' };
    });
    sumRow.getCell('invNum').alignment = { vertical: 'middle', horizontal: 'left' };
    (['amount', 'tax', 'total'] as const).forEach((k) => {
      sumRow.getCell(k).numFmt = '#,##0';
    });

    return wb;
  }

  // ─── Stock Movement Report ─────────────────────────────────
  async stockMovementReport(f: Filters & { type?: string } = {}) {
    const where: Record<string, unknown> = {};
    if (f.type)   where.movementType = f.type;
    if (f.from || f.to) where.createdAt = {
      ...(f.from && { gte: new Date(f.from) }),
      ...(f.to   && { lte: new Date(f.to + 'T23:59:59') }),
    };

    const movements = await prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { nameLo: true, code: true, unit: { select: { nameLo: true } } } },
        creator: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Stock System';
    const ws   = wb.addWorksheet('Stock Movement');

    const cols = [
      { header: '#',          key: 'no',      width: 5  },
      { header: 'ສິນຄ້າ',     key: 'product', width: 28 },
      { header: 'ລະຫັດ',      key: 'code',    width: 14 },
      { header: 'ໜ່ວຍ',       key: 'unit',    width: 10 },
      { header: 'ປະເພດ',      key: 'type',    width: 14 },
      { header: 'ຈຳນວນ',      key: 'qty',     width: 10 },
      { header: 'ກ່ອນ',       key: 'before',  width: 10 },
      { header: 'ຫຼັງ',        key: 'after',   width: 10 },
      { header: 'Ref',        key: 'ref',     width: 10 },
      { header: 'ຜູ້ດຳເນີນການ', key: 'by',     width: 20 },
      { header: 'ວັນທີ-ເວລາ',  key: 'date',    width: 20 },
    ];
    this.addTitle(ws, 'ລາຍງານການເຄື່ອນໄຫວ Stock', cols.length);
    ws.addRow([]);
    ws.columns = cols;
    const hRow = ws.getRow(4);
    hRow.values = cols.map((c) => c.header);
    this.styleHeader(hRow);

    movements.forEach((m, i) => {
      const row = ws.addRow({
        no: i + 1, product: m.product.nameLo, code: m.product.code,
        unit: m.product.unit.nameLo, type: m.movementType,
        qty: m.quantity, before: m.beforeQty, after: m.afterQty,
        ref: m.refType ? `${m.refType}-${m.refId}` : '-',
        by:   m.creator?.fullName ?? '-',
        date: new Date(m.createdAt).toLocaleString('lo-LA'),
      });
      this.styleRow(row, i);
      const qtyCell = row.getCell('qty');
      if (m.movementType.includes('in')) {
        qtyCell.font = { color: { argb: 'FF16A34A' }, name: 'Phetsarath OT' };
      } else {
        qtyCell.font = { color: { argb: 'FFEF4444' }, name: 'Phetsarath OT' };
      }
    });

    ws.addRow([]);
    const sumRow = ws.addRow(['', '', '', '', '', `ລວມ: ${movements.length} ລາຍການ`]);
    sumRow.font = { bold: true, name: 'Phetsarath OT' };

    return wb;
  }
}

export const reportService = new ReportService();
