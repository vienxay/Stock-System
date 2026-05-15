import { Router }       from 'express';
import { prisma }       from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';
import { AuthRequest }  from '../types';
import { buildPaginationMeta } from '../utils/runningNumber';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { page = '1', limit = '20' } = req.query as Record<string,string>;
  const userId = (req as AuthRequest).user.id;
  const p = Number(page), l = Number(limit);
  const [rows, total, unread] = await prisma.$transaction([
    prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: l, skip: (p-1)*l }),
    prisma.notification.count({ where: { userId } }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);
  ApiResponse.paginate(res, rows, buildPaginationMeta(total, p, l), `ມີ ${unread} ການແຈ້ງເຕືອນໃໝ່`);
});

router.patch('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: (req as AuthRequest).user.id, isRead: false }, data: { isRead: true } });
  ApiResponse.success(res, null, 'ອ່ານທັງໝົດແລ້ວ');
});

router.patch('/:id/read', async (req, res) => {
  const userId = (req as unknown as AuthRequest).user.id;
  await prisma.notification.updateMany({
    where: { id: Number(req.params.id), userId },
    data:  { isRead: true },
  });
  ApiResponse.success(res, null, 'ອ່ານແລ້ວ');
});

export default router;
