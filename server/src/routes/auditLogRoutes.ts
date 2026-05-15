import { Router } from 'express';
import { prisma }  from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';
import { buildPaginationMeta } from '../utils/runningNumber';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);
router.use(authorize('admin'));

const TABLE_LABEL: Record<string, string> = {
  products:        'ສິນຄ້າ',
  suppliers:       'Supplier',
  categories:      'ໝວດໝູ່',
  users:           'User',
  purchase_orders: 'ໃບສັ່ງຊື້ PO',
  invoices:        'Invoice',
};

router.get('/', async (req, res) => {
  const {
    page = '1', limit = '20',
    table, action, user_id, from_date, to_date,
  } = req.query as Record<string, string>;

  const p = Number(page), l = Number(limit);
  const where: Record<string, unknown> = {};
  if (table)    where.tableName = table;
  if (action)   where.action   = action;
  if (user_id)  where.userId   = Number(user_id);
  if (from_date || to_date) {
    where.createdAt = {
      ...(from_date && { gte: new Date(from_date) }),
      ...(to_date   && { lte: new Date(to_date + 'T23:59:59') }),
    };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, username: true } } },
      orderBy: { createdAt: 'desc' },
      take:    l,
      skip:    (p - 1) * l,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const enriched = rows.map((r) => ({
    ...r,
    tableLabel: TABLE_LABEL[r.tableName] ?? r.tableName,
  }));

  ApiResponse.paginate(res, enriched, buildPaginationMeta(total, p, l));
});

// ─── Stats summary ─────────────────────────────────────────
router.get('/stats', async (_req, res) => {
  const [byAction, byTable, recentUsers] = await prisma.$transaction([
    prisma.auditLog.groupBy({ by: ['action'],    _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.auditLog.groupBy({ by: ['tableName'], _count: { id: true }, orderBy: { _count: { id: 'desc' } } }),
    prisma.auditLog.findMany({
      distinct:  ['userId'],
      orderBy:   { createdAt: 'desc' },
      take:      5,
      include:   { user: { select: { fullName: true } } },
    }),
  ]);
  ApiResponse.success(res, { byAction, byTable, recentUsers });
});

export default router;
