import { Router } from 'express';
import { body }   from 'express-validator';
import { authController }              from '../controllers/authController';
import { authenticate }                from '../middlewares/authMiddleware';
import { validate }                    from '../middlewares/validateMiddleware';

const router = Router();

router.post('/login',
  body('username').notEmpty().withMessage('ກະລຸນາປ້ອນ username'),
  body('password').notEmpty().withMessage('ກະລຸນາປ້ອນ password'),
  validate, authController.login);

router.post('/refresh',
  body('refresh_token').notEmpty(),
  validate, authController.refresh);

router.get('/me',      authenticate, authController.me);
router.post('/logout', authenticate, authController.logout);

router.patch('/change-password', authenticate,
  body('old_password').notEmpty(),
  body('new_password').isLength({ min: 8 }).withMessage('ລະຫັດຜ່ານຕ້ອງ 8 ຕົວຂຶ້ນໄປ'),
  validate, authController.changePassword);

export default router;
