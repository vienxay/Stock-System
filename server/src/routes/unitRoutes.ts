import { Router } from 'express';
import { prisma }       from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();
router.use(authenticate);

router.get('/', async (_req, res) => {
  const units = await prisma.unit.findMany({ orderBy: { nameLo: 'asc' } });
  ApiResponse.success(res, units);
});

export default router;
