import { Router } from 'express';
import { body }   from 'express-validator';
import { purchaseRequestController } from '../controllers/purchaseRequestController';
import { authenticate }              from '../middlewares/authMiddleware';
import { authorize }                   from '../middlewares/authorizeMiddleware';
import { validate }                    from '../middlewares/validateMiddleware';
import { asAuth }                      from '../utils/routeHelpers';

const router = Router();
const itemRules = [
  body('items').isArray({ min: 1 }).withMessage('ຕ້ອງມີສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ'),
  body('items.*.product_id').isInt().withMessage('product_id ຕ້ອງເປັນຕົວເລກ'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('quantity ຕ້ອງ >= 1'),
];

router.use(authenticate);

router.get('/',    asAuth(purchaseRequestController.findAll));
router.get('/:id', asAuth(purchaseRequestController.findById));

router.post('/', itemRules, validate, asAuth(purchaseRequestController.create));

router.put('/:id', itemRules, validate, asAuth(purchaseRequestController.update));

router.patch('/:id/submit',   asAuth(purchaseRequestController.submit));
router.patch('/:id/resubmit', asAuth(purchaseRequestController.resubmit));
router.patch('/:id/cancel',   asAuth(purchaseRequestController.cancel));

router.patch('/:id/approve',
  authorize('finance', 'md', 'admin'),
  body('decision').isIn(['approved', 'rejected']).withMessage('decision ຕ້ອງເປັນ approved ຫຼື rejected'),
  validate,
  asAuth(purchaseRequestController.approve));

router.post('/:id/create-po',
  authorize('purchasing', 'admin'),
  body('items').optional().isArray(),
  body('items.*.pr_item_id').optional().isInt({ min: 1 }),
  body('items.*.supplier_id').optional().isInt({ min: 1 }),
  validate,
  asAuth(purchaseRequestController.createPo));

export default router;
