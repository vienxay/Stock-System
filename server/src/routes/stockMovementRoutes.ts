import { Router }                      from 'express';
import { body, query }                  from 'express-validator';
import { stockMovementController }      from '../controllers/stockMovementController';
import { authenticate }                 from '../middlewares/authMiddleware';
import { authorize }                    from '../middlewares/authorizeMiddleware';
import { validate }                     from '../middlewares/validateMiddleware';
import { asAuth }                       from '../utils/routeHelpers';

const router = Router();

router.use(authenticate);

// GET /stock-movements?product_id=&movement_type=&from_date=&to_date=&page=&limit=
router.get('/',
  query('product_id').optional().isInt(),
  query('movement_type').optional().isIn(['gr_in', 'issue_out', 'return_in', 'adjust_in', 'adjust_out', 'transfer']),
  query('from_date').optional().isDate(),
  query('to_date').optional().isDate(),
  validate,
  asAuth(stockMovementController.findAll));

// GET /stock-movements/product/:productId?page=&limit=
router.get('/product/:productId',
  asAuth(stockMovementController.findByProduct));

// POST /stock-movements/issue — ເບີກສິນຄ້າອອກ
router.post('/issue',
  authorize('stock', 'admin'),
  body('product_id').isInt({ min: 1 }).withMessage('product_id ຕ້ອງເປັນຕົວເລກ'),
  body('quantity').isInt({ min: 1 }).withMessage('quantity ຕ້ອງ >= 1'),
  body('note').optional().isString(),
  body('ref_type').optional().isString().isLength({ max: 20 }),
  body('ref_id').optional().isInt({ min: 1 }),
  validate,
  asAuth(stockMovementController.issueOut));

// POST /stock-movements/adjust — ປັບຍອດ Stock
router.post('/adjust',
  authorize('stock', 'admin'),
  body('product_id').isInt({ min: 1 }).withMessage('product_id ຕ້ອງເປັນຕົວເລກ'),
  body('quantity').isInt({ min: 1 }).withMessage('quantity ຕ້ອງ >= 1'),
  body('movement_type')
    .isIn(['adjust_in', 'adjust_out'])
    .withMessage('movement_type ຕ້ອງເປັນ adjust_in ຫຼື adjust_out'),
  body('note').optional().isString(),
  validate,
  asAuth(stockMovementController.adjust));

export default router;
