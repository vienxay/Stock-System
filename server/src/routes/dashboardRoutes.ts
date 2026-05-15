import { Router }       from 'express';
import { prisma }       from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();
router.use(authenticate);

const LAO_MONTHS = ['ມ.ກ','ກ.ພ','ມ.ນ','ມ.ສ','ພ.ພ','ມ.ຖ','ກ.ລ','ສ.ຫ','ກ.ຍ','ຕ.ລ','ພ.ຈ','ທ.ວ'];

router.get('/summary', async (_req, res) => {
  // ─── Build last-6-month date buckets ──────────────────────
  const buckets: Date[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1); d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() - i);
    buckets.push(d);
  }
  const sixMonthsAgo = buckets[0];

  const now           = new Date();
  const monthStart    = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart     = new Date(now.getFullYear(), 0, 1);

  const [
    prByStatus, poByStatus,
    lowStockRaw, pendingInvoices, totalPaid,
    thisMonthPaid, thisYearPaid, pendingPaymentAmt,
    monthlyPRs, monthlyPOs,
    lowStockItems,
  ] = await prisma.$transaction([
    prisma.purchaseRequest.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.purchaseOrder.groupBy({ by: ['status'], _count: { id: true } }),
    prisma.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint FROM products WHERE is_active=true AND current_stock <= min_stock`,
    prisma.invoice.count({ where: { status: { in: ['matched', 'approved'] } } }),
    prisma.payment.aggregate({ _sum: { amountPaid: true } }),
    // ຈ່າຍເດືອນນີ້
    prisma.payment.aggregate({ _sum: { amountPaid: true }, where: { paymentDate: { gte: monthStart } } }),
    // ຈ່າຍປີນີ້
    prisma.payment.aggregate({ _sum: { amountPaid: true }, where: { paymentDate: { gte: yearStart } } }),
    // ຍັງຕ້ອງຈ່າຍ (approved invoices)
    prisma.invoice.aggregate({ _sum: { totalAmount: true }, where: { status: 'approved' } }),
    prisma.purchaseRequest.findMany({
      where:  { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true },
    }),
    prisma.purchaseOrder.findMany({
      where:  { createdAt: { gte: sixMonthsAgo } },
      select: { createdAt: true, totalAmount: true },
    }),
    prisma.$queryRaw<{ id: number; code: string; nameLo: string; currentStock: number; minStock: number }[]>`
      SELECT id, code, name_lo AS "nameLo",
             current_stock AS "currentStock", min_stock AS "minStock"
      FROM products
      WHERE is_active = true AND current_stock <= min_stock
      ORDER BY (CAST(current_stock AS FLOAT) / NULLIF(min_stock, 0)) ASC
      LIMIT 8
    `,
  ]);

  // ─── Group PRs & POs by month ─────────────────────────────
  const monthly = buckets.map((d) => {
    const yr = d.getFullYear(), mo = d.getMonth();
    const prCount  = monthlyPRs.filter((pr) => {
      const c = new Date(pr.createdAt);
      return c.getFullYear() === yr && c.getMonth() === mo;
    }).length;
    const poAmount = monthlyPOs
      .filter((po) => {
        const c = new Date(po.createdAt);
        return c.getFullYear() === yr && c.getMonth() === mo;
      })
      .reduce((s, po) => s + Number(po.totalAmount), 0);
    return { month: LAO_MONTHS[mo], prCount, poAmount };
  });

  // ─── PO & Invoice counts for flow diagram ─────────────────
  const poTotal      = poByStatus.reduce((s, p) => s + p._count.id, 0);
  const grTotal      = await prisma.goodsReceipt.count();
  const invoiceTotal = await prisma.invoice.count();
  const paidTotal    = await prisma.payment.count();
  const prTotal      = prByStatus.reduce((s, p) => s + p._count.id, 0);

  ApiResponse.success(res, {
    pr:             prByStatus,
    po:             poByStatus,
    lowStockCount:  Number(lowStockRaw[0]?.count ?? 0),
    pendingInvoices,
    totalPaidAmount:   totalPaid._sum.amountPaid          ?? 0,
    thisMonthPaid:     thisMonthPaid._sum.amountPaid      ?? 0,
    thisYearPaid:      thisYearPaid._sum.amountPaid       ?? 0,
    pendingPaymentAmt: pendingPaymentAmt._sum.totalAmount ?? 0,
    monthly,
    lowStockItems,
    flow: { pr: prTotal, po: poTotal, gr: grTotal, invoice: invoiceTotal, paid: paidTotal },
  });
});

export default router;
