import { Router } from 'express';
import { body }   from 'express-validator';
import { prisma } from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';
import { validate }     from '../middlewares/validateMiddleware';

const router = Router();
router.use(authenticate);

// ─── ດຶງ settings (ທຸກ role) ──────────────────────────────────
router.get('/', async (_req, res) => {
  let settings = await prisma.systemSettings.findUnique({ where: { id: 1 } });
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: { id: 1 } });
  }
  ApiResponse.success(res, settings);
});

// ─── ແກ້ໄຂ settings (admin only) ─────────────────────────────
router.put('/',
  authorize('admin'),
  body('companyName').notEmpty().isLength({ max: 200 }),
  body('companyNameEn').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('logoUrl').optional({ values: 'falsy' }).isString(),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  body('email').optional({ values: 'falsy' }).isEmail(),
  body('address').optional({ values: 'falsy' }).isString(),
  body('taxId').optional({ values: 'falsy' }).isString().isLength({ max: 50 }),
  validate,
  async (req, res) => {
    const { companyName, companyNameEn, logoUrl, phone, email, address, taxId } = req.body as {
      companyName: string; companyNameEn?: string; logoUrl?: string;
      phone?: string; email?: string; address?: string; taxId?: string;
    };
    const settings = await prisma.systemSettings.upsert({
      where:  { id: 1 },
      update: { companyName, companyNameEn: companyNameEn ?? null, logoUrl: logoUrl ?? null,
                phone: phone ?? null, email: email ?? null, address: address ?? null, taxId: taxId ?? null },
      create: { id: 1, companyName, companyNameEn: companyNameEn ?? null, logoUrl: logoUrl ?? null,
                phone: phone ?? null, email: email ?? null, address: address ?? null, taxId: taxId ?? null },
    });
    ApiResponse.success(res, settings, 'ບັນທຶກການຕັ້ງຄ່າສຳເລັດ');
  });

export default router;
