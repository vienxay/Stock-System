import { Router } from 'express';
import { body }   from 'express-validator';
import { purchaseRequestController }   from '../controllers/purchaseRequestController';
import { authenticate }                from '../middlewares/authMiddleware';
import { authorize }                   from '../middlewares/authorizeMiddleware';
import { validate }                    from '../middlewares/validateMiddleware';
import { AuthRequest }                 from '../types';
import { prisma }                      from '../config/prisma';
import { ApiResponse }                 from '../utils/ApiResponse';
import { AppError }                    from '../utils/AppError';
import { purchaseOrderService }        from '../services/purchaseOrderService';
import { PrStatus }                    from '@prisma/client';
import { asAuth }                      from '../utils/routeHelpers';

const router = Router();

router.use(authenticate);

router.get('/',    asAuth(purchaseRequestController.findAll));
router.get('/:id', asAuth(purchaseRequestController.findById));

router.post('/',
  body('items').isArray({ min: 1 }).withMessage('ຕ້ອງມີສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ'),
  body('items.*.product_id').isInt().withMessage('product_id ຕ້ອງເປັນຕົວເລກ'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity ຕ້ອງ >= 1'),
  validate,
  asAuth(purchaseRequestController.create));

router.patch('/:id/submit',  asAuth(purchaseRequestController.submit));
router.patch('/:id/cancel',  asAuth(purchaseRequestController.cancel));

router.patch('/:id/approve',
  authorize('finance', 'md', 'admin'),
  body('decision').isIn(['approved', 'rejected']).withMessage('decision ຕ້ອງເປັນ approved ຫຼື rejected'),
  validate,
  asAuth(purchaseRequestController.approve));

// ─── Manual PO creation (ສຳລັບ md_approved PR ທີ່ items ບໍ່ມີ supplier) ──
router.post('/:id/create-po',
  authorize('purchasing', 'admin'),
  body('supplier_id').isInt({ min: 1 }).withMessage('ກະລຸນາເລືອກ Supplier'),
  validate,
  async (req, res) => {
    const prId       = Number(req.params.id);
    const supplierId = Number(req.body.supplier_id);
    const userId     = (req as AuthRequest).user.id;

    const pr = await prisma.purchaseRequest.findUnique({
      where: { id: prId }, include: { items: true },
    });
    if (!pr) throw AppError.notFound('ບໍ່ພົບ PR');
    if (pr.status !== PrStatus.md_approved) {
      throw AppError.badRequest(`PR ຕ້ອງຢູ່ໃນສະຖານະ md_approved (ປັດຈຸບັນ: ${pr.status})`);
    }

    // ກຳນົດ supplier ໃຫ້ items ທີ່ຍັງບໍ່ມີ
    await prisma.purchaseRequestItem.updateMany({
      where: { prId, supplierId: null },
      data:  { supplierId },
    });

    // ສ້າງ PO
    const po = await prisma.$transaction(async (tx) => purchaseOrderService.createFromPR(prId, userId, tx));

    if (!po) throw AppError.badRequest('ບໍ່ສາມາດສ້າງ PO ໄດ້ ກະລຸນາກວດ supplier');

    await prisma.purchaseRequest.update({
      where: { id: prId }, data: { status: PrStatus.po_created },
    });

    ApiResponse.created(res, po, `ສ້າງ PO ${po.poNumber} ສຳເລັດ`);
  });

export default router;
