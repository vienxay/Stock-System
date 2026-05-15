import { Router, Response } from 'express';
import { prisma }       from '../config/prisma';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

// ─── Export all data as JSON ────────────────────────────────
router.get('/export', async (_req, res: Response) => {
  const now = new Date();
  const filename = `backup-${now.toISOString().slice(0, 10)}-${now.getHours()}h${String(now.getMinutes()).padStart(2, '0')}.json`;

  const [
    users, roles, categories, units, suppliers,
    products, purchaseRequests, purchaseOrders,
    goodsReceipts, invoices, payments, stockMovements,
    notifications, systemSettings,
  ] = await prisma.$transaction([
    prisma.user.findMany({ include: { role: true } }),
    prisma.role.findMany(),
    prisma.category.findMany(),
    prisma.unit.findMany(),
    prisma.supplier.findMany(),
    prisma.product.findMany({ include: { category: true, unit: true } }),
    prisma.purchaseRequest.findMany({
      include: { items: true, approvals: true, requester: { select: { fullName: true } } },
    }),
    prisma.purchaseOrder.findMany({
      include: { items: true, supplier: { select: { name: true } } },
    }),
    prisma.goodsReceipt.findMany({ include: { items: true } }),
    prisma.invoice.findMany(),
    prisma.payment.findMany(),
    prisma.stockMovement.findMany(),
    prisma.notification.findMany({ orderBy: { createdAt: 'desc' }, take: 1000 }),
    prisma.systemSettings.findFirst(),
  ]);

  const backup = {
    metadata: {
      version:     '1.0',
      exportedAt:  now.toISOString(),
      exportedBy:  'ລະບົບສາງ PR-PO',
      tables:      14,
      recordCount: {
        users:           users.length,
        roles:           roles.length,
        categories:      categories.length,
        units:           units.length,
        suppliers:       suppliers.length,
        products:        products.length,
        purchaseRequests: purchaseRequests.length,
        purchaseOrders:  purchaseOrders.length,
        goodsReceipts:   goodsReceipts.length,
        invoices:        invoices.length,
        payments:        payments.length,
        stockMovements:  stockMovements.length,
      },
    },
    data: {
      users, roles, categories, units, suppliers,
      products, purchaseRequests, purchaseOrders,
      goodsReceipts, invoices, payments, stockMovements,
      notifications, systemSettings,
    },
  };

  const json = JSON.stringify(backup, (_k, v) =>
    typeof v === 'bigint' ? Number(v) : v,
  , 2);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8'));
  res.send(json);
});

// ─── Backup summary (size info) ─────────────────────────────
router.get('/summary', async (_req, res: Response) => {
  const counts = await prisma.$transaction([
    prisma.user.count(),
    prisma.product.count(),
    prisma.purchaseRequest.count(),
    prisma.purchaseOrder.count(),
    prisma.invoice.count(),
    prisma.payment.count(),
    prisma.stockMovement.count(),
  ]);
  const [users, products, prs, pos, invoices, payments, movements] = counts;
  res.json({
    success: true,
    data: { users, products, prs, pos, invoices, payments, movements,
      total: counts.reduce((s, c) => s + c, 0) },
  });
});

export default router;
