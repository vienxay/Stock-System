import { Router }          from 'express';
import { body }            from 'express-validator';
import { invoiceController } from '../controllers/invoiceController';
import { authenticate }    from '../middlewares/authMiddleware';
import { authorize }       from '../middlewares/authorizeMiddleware';
import { validate }        from '../middlewares/validateMiddleware';
import { Response } from 'express';
import { AuthRequest } from '../types';
import { asAuth } from '../utils/routeHelpers';

const router = Router();

router.use(authenticate);

router.get('/', asAuth(invoiceController.findAll));

router.post('/',
  authorize('ap', 'admin'),
  body('po_id').isInt(), body('gr_id').isInt(),
  body('invoice_number').notEmpty(),
  body('invoice_amount').isFloat({ min: 0 }),
  body('invoice_date').isDate(),
  validate, asAuth(invoiceController.create));

router.patch('/:id/approve', authorize('ap', 'admin'), asAuth(invoiceController.approve));

// ─── ແກ້ໄຂຈຳນວນ (mismatch) ──────────────────────────────────
router.patch('/:id/amount', authorize('ap', 'admin'),
  body('invoice_amount').isFloat({ min: 0 }),
  validate, asAuth(invoiceController.updateAmount));

// ─── Override ອະນຸມັດ (mismatch) ─────────────────────────────
router.patch('/:id/override-approve', authorize('ap', 'admin'),
  body('comment').notEmpty().withMessage('ກະລຸນາໃສ່ເຫດຜົນ'),
  validate, asAuth(invoiceController.overrideApprove));

// ─── ຍົກເລີກ Invoice ─────────────────────────────────────────
router.delete('/:id', authorize('ap', 'admin'), asAuth(invoiceController.cancel));

router.post('/:id/pay',
  authorize('ap', 'admin'),
  body('payment_date').isDate(),
  body('amount_paid').isFloat({ min: 0 }),
  validate, asAuth(invoiceController.pay));

export default router;
