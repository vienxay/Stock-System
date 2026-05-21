import { Router }              from 'express';
import { body }                from 'express-validator';
import { purchaseOrderController } from '../controllers/purchaseOrderController';
import { authenticate }        from '../middlewares/authMiddleware';
import { authorize }           from '../middlewares/authorizeMiddleware';
import { validate }            from '../middlewares/validateMiddleware';
import { AuthRequest }         from '../types';
import { prisma }              from '../config/prisma';
import { ApiResponse }         from '../utils/ApiResponse';
import { asAuth }              from '../utils/routeHelpers';

const router = Router();

router.use(authenticate);

router.get('/',    asAuth(purchaseOrderController.findAll));

// ─── POs ທີ່ຮັບສິນຄ້າແລ້ວ ແຕ່ຍັງບໍ່ມີ Invoice ───────────────
router.get('/needs-invoice', async (_req, res) => {
  const pos = await prisma.purchaseOrder.findMany({
    where: {
      status:   { in: ['partial_received', 'received'] },
      invoices: { none: {} },
    },
    include: {
      supplier:     { select: { name: true } },
      goodsReceipts: { select: { id: true, grNumber: true, receivedDate: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  ApiResponse.success(res, pos);
});

router.get('/:id', asAuth(purchaseOrderController.findById));

router.patch('/:id/send',
  authorize('purchasing', 'admin'),
  asAuth(purchaseOrderController.markSent));

router.post('/:id/receive',
  authorize('stock', 'admin'),
  body('items').isArray({ min: 1 }),
  body('items.*.po_item_id').isInt(),
  body('items.*.received_qty').isInt({ min: 0 }),
  validate,
  asAuth(purchaseOrderController.receiveGoods));

router.patch('/:id/cancel',
  authorize('purchasing', 'admin'),
  asAuth(purchaseOrderController.cancelPo));

router.delete('/:poId/gr/:grId',
  authorize('stock', 'admin'),
  asAuth(purchaseOrderController.cancelGr));

export default router;
