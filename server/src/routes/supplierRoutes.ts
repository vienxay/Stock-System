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

router.get('/', async (req, res) => {
  const { search } = req.query as { search?: string };
  const where: Record<string, unknown> = { isActive: true };
  if (search) where.name = { contains: search, mode: 'insensitive' };
  ApiResponse.success(res, await prisma.supplier.findMany({ where, orderBy: { name: 'asc' } }));
});

router.post('/', authorize('purchasing', 'admin'),
  body('code').notEmpty().isLength({ max: 20 }),
  body('name').notEmpty().isLength({ max: 200 }),
  body('taxId').optional().isString(),
  body('paymentTerm').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    const { code, name, taxId, contactName, phone, email, address, bankName, bankAccount, paymentTerm } = req.body as {
      code: string; name: string; taxId?: string; contactName?: string;
      phone?: string; email?: string; address?: string;
      bankName?: string; bankAccount?: string; paymentTerm?: number;
    };
    const s = await prisma.supplier.create({
      data: { code, name, taxId, contactName, phone, email, address, bankName, bankAccount, paymentTerm },
    });
    ApiResponse.created(res, s);
    auditLog((req as unknown as AuthRequest).user.id, 'CREATE', 'suppliers', s.id, null, s, getIp(req));
  });

router.put('/:id', authorize('purchasing', 'admin'),
  body('name').optional().notEmpty().isLength({ max: 200 }),
  body('paymentTerm').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    const id = Number(req.params.id);
    const { name, taxId, contactName, phone, email, address, bankName, bankAccount, paymentTerm } = req.body as {
      name?: string; taxId?: string; contactName?: string; phone?: string;
      email?: string; address?: string; bankName?: string; bankAccount?: string; paymentTerm?: number;
    };
    const old = await prisma.supplier.findUnique({ where: { id }, select: { name: true, taxId: true, contactName: true, phone: true, email: true, address: true, bankName: true, bankAccount: true, paymentTerm: true } });
    const s = await prisma.supplier.update({
      where: { id },
      data:  { name, taxId, contactName, phone, email, address, bankName, bankAccount, paymentTerm },
    });
    ApiResponse.success(res, s);
    auditLog((req as unknown as AuthRequest).user.id, 'UPDATE', 'suppliers', s.id, old, req.body, getIp(req));
  });

router.delete('/:id', authorize('admin'), async (req, res) => {
  const id = Number(req.params.id);
  const poCount = await prisma.purchaseOrder.count({ where: { supplierId: id } });
  if (poCount > 0) {
    // ມີ PO ຜູກຢູ່ → soft delete ເທົ່ານັ້ນ
    await prisma.supplier.update({ where: { id }, data: { isActive: false } });
    ApiResponse.success(res, null, `ປິດ Supplier ສຳເລັດ (ມີ PO ${poCount} ລາຍການຜູກຢູ່)`);
    return;
  }
  await prisma.supplier.delete({ where: { id } });
  ApiResponse.success(res, null, 'ລົບ Supplier ສຳເລັດ');
  auditLog((req as unknown as AuthRequest).user.id, 'DELETE', 'suppliers', id, null, null, getIp(req));
});

export default router;
