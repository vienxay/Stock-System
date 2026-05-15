import { Router } from 'express';
import { body }   from 'express-validator';
import { prisma } from '../config/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';
import { validate }     from '../middlewares/validateMiddleware';
import { auditLog, getIp } from '../services/auditLogService';
import { AuthRequest } from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const list = await prisma.category.findMany({ where: { isActive: true }, include: { children: true }, orderBy: { nameLo: 'asc' } });
  ApiResponse.success(res, list);
});

const bodyRules = [
  body('code').notEmpty().isLength({ max: 20 }),
  body('nameLo').notEmpty().isLength({ max: 100 }),
  body('nameEn').optional().isString().isLength({ max: 100 }),
  body('parentId').optional({ nullable: true }).isInt(),
];

router.post('/', authorize('admin'), ...bodyRules, validate, async (req, res) => {
  const { code, nameLo, nameEn, parentId } = req.body as {
    code: string; nameLo: string; nameEn?: string; parentId?: number | null;
  };
  const cat = await prisma.category.create({ data: { code, nameLo, nameEn: nameEn || null, parentId: parentId || null } });
  ApiResponse.created(res, cat, 'ເພີ່ມໝວດໝູ່ສຳເລັດ');
  auditLog((req as unknown as AuthRequest).user.id, 'CREATE', 'categories', cat.id, null, cat, getIp(req));
});

router.put('/:id', authorize('admin'),
  body('nameLo').notEmpty().isLength({ max: 100 }),
  body('nameEn').optional().isString().isLength({ max: 100 }),
  body('parentId').optional({ nullable: true }).isInt(),
  body('isActive').optional().isBoolean(),
  validate,
  async (req, res) => {
    const id = Number(req.params.id);
    const { nameLo, nameEn, parentId, isActive } = req.body as {
      nameLo: string; nameEn?: string; parentId?: number | null; isActive?: boolean;
    };
    const old = await prisma.category.findUnique({ where: { id }, select: { nameLo: true, nameEn: true, parentId: true, isActive: true } });
    const cat = await prisma.category.update({
      where: { id },
      data:  { nameLo, nameEn: nameEn || null, parentId: parentId || null, isActive: isActive ?? true },
    });
    ApiResponse.success(res, cat, 'ແກ້ໄຂໝວດໝູ່ສຳເລັດ');
    auditLog((req as unknown as AuthRequest).user.id, 'UPDATE', 'categories', cat.id, old, req.body, getIp(req));
  });

router.delete('/:id', authorize('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const hasProducts = await prisma.product.count({ where: { categoryId: id } });
  if (hasProducts > 0) {
    res.status(400).json({ success: false, message: `ບໍ່ສາມາດລົບໄດ້ — ມີສິນຄ້າ ${hasProducts} ລາຍການໃຊ້ໝວດໝູ່ນີ້` });
    return;
  }
  const hasChildren = await prisma.category.count({ where: { parentId: id } });
  if (hasChildren > 0) {
    res.status(400).json({ success: false, message: `ບໍ່ສາມາດລົບໄດ້ — ມີໝວດໝູ່ຍ່ອຍ ${hasChildren} ລາຍການ` });
    return;
  }
  await prisma.category.delete({ where: { id } });
  ApiResponse.success(res, null, 'ລົບໝວດໝູ່ສຳເລັດ');
  auditLog((req as unknown as AuthRequest).user.id, 'DELETE', 'categories', id, null, null, getIp(req));
});

export default router;
