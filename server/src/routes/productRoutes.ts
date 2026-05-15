import { Router }       from 'express';
import { body }         from 'express-validator';
import { prisma }       from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';
import { validate }     from '../middlewares/validateMiddleware';
import { buildPaginationMeta } from '../utils/runningNumber';
import { auditLog, getIp } from '../services/auditLogService';
import { AuthRequest }  from '../types';

const router = Router();
router.use(authenticate);

router.get('/', async (req, res) => {
  const { page = '1', limit = '20', search, category_id, low_stock } = req.query as Record<string, string>;
  const p = Number(page), l = Number(limit);
  const where: Record<string, unknown> = { isActive: true };
  if (search)      where.OR = [
    { nameLo:  { contains: search, mode: 'insensitive' } },
    { nameEn:  { contains: search, mode: 'insensitive' } },
    { code:    { contains: search, mode: 'insensitive' } },
    { barcode: { contains: search, mode: 'insensitive' } },
  ];
  if (category_id) where.categoryId = Number(category_id);
  if (low_stock === 'true') {
    const ids = await prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM products WHERE is_active = true AND current_stock <= min_stock
    `;
    where.id = { in: ids.map((r) => r.id) };
  }

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({ where, include: { category: true, unit: true }, orderBy: { nameLo: 'asc' }, take: l, skip: (p - 1) * l }),
    prisma.product.count({ where }),
  ]);
  ApiResponse.paginate(res, rows, buildPaginationMeta(total, p, l));
});

router.get('/low-stock', async (_req, res) => {
  const rows = await prisma.$queryRaw`SELECT p.*, c.name_lo as category_name, u.name_lo as unit_name FROM products p JOIN categories c ON c.id = p.category_id JOIN units u ON u.id = p.unit_id WHERE p.is_active = true AND p.current_stock <= p.min_stock ORDER BY p.current_stock ASC`;
  ApiResponse.success(res, rows);
});

router.get('/:id', async (req, res) => {
  const p = await prisma.product.findUnique({ where: { id: Number(req.params.id) }, include: { category: true, unit: true, stockMovements: { take: 20, orderBy: { createdAt: 'desc' } } } });
  if (!p) return ApiResponse.notFound(res);
  ApiResponse.success(res, p);
});

router.post('/', authorize('admin', 'stock'),
  body('code').notEmpty().withMessage('ກະລຸນາໃສ່ລະຫັດສິນຄ້າ'),
  body('nameLo').notEmpty().withMessage('ກະລຸນາໃສ່ຊື່ສິນຄ້າ'),
  body('categoryId').isInt({ min: 1 }).withMessage('ກະລຸນາເລືອກໝວດໝູ່'),
  body('unitId').isInt({ min: 1 }).withMessage('ກະລຸນາເລືອກຫົວໜ່ວຍ'),
  body('standardPrice').optional().isFloat({ min: 0 }),
  body('minStock').optional().isInt({ min: 0 }),
  body('maxStock').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    const { code, nameLo, nameEn, categoryId, unitId, standardPrice, minStock, maxStock, location, description, barcode, imageUrl } = req.body as Record<string, unknown>;
    const p = await prisma.product.create({
      data: {
        code:          String(code).trim(),
        nameLo:        String(nameLo).trim(),
        nameEn:        (nameEn as string)?.trim() || null,
        categoryId:    Number(categoryId),
        unitId:        Number(unitId),
        standardPrice: Number(standardPrice ?? 0),
        minStock:      Number(minStock ?? 0),
        maxStock:      Number(maxStock ?? 0),
        location:      (location as string)?.trim() || null,
        description:   (description as string)?.trim() || null,
        barcode:       (barcode as string)?.trim() || null,
        imageUrl:      (imageUrl as string)?.trim() || null,
      },
      include: { category: true, unit: true },
    });
    ApiResponse.created(res, p, 'ເພີ່ມສິນຄ້າສຳເລັດ');
    auditLog((req as unknown as AuthRequest).user.id, 'CREATE', 'products', p.id, null, p, getIp(req));
  });

router.put('/:id', authorize('admin', 'stock'),
  body('nameLo').optional().notEmpty(),
  body('categoryId').optional().isInt(),
  body('unitId').optional().isInt(),
  body('standardPrice').optional().isFloat({ min: 0 }),
  body('minStock').optional().isInt({ min: 0 }),
  body('maxStock').optional().isInt({ min: 0 }),
  validate,
  async (req, res) => {
    const id = Number(req.params.id);
    const { nameLo, nameEn, categoryId, unitId, standardPrice, minStock, maxStock, location, description, barcode, imageUrl } = req.body as Record<string, unknown>;
    // ດຶງຂໍ້ມູນເກົ່າກ່ອນ update
    const old = await prisma.product.findUnique({ where: { id }, select: { nameLo: true, nameEn: true, categoryId: true, unitId: true, standardPrice: true, minStock: true, maxStock: true, location: true, description: true, barcode: true, imageUrl: true } });
    const p = await prisma.product.update({
      where: { id },
      data:  {
        nameLo:        nameLo        as string,
        nameEn:        (nameEn as string)?.trim()   || null,
        categoryId:    categoryId    as number,
        unitId:        unitId        as number,
        standardPrice: standardPrice as number,
        minStock:      minStock      as number,
        maxStock:      maxStock      as number,
        location:      (location    as string)?.trim() || null,
        description:   (description as string)?.trim() || null,
        barcode:       (barcode     as string)?.trim() || null,
        imageUrl:      (imageUrl    as string)?.trim() || null,
      },
      include: { category: true, unit: true },
    });
    ApiResponse.success(res, p, 'ແກ້ໄຂສຳເລັດ');
    auditLog((req as unknown as AuthRequest).user.id, 'UPDATE', 'products', p.id, old, req.body, getIp(req));
  });

// ─── Bulk Import ────────────────────────────────────────────
router.post('/import', authorize('admin', 'stock'),
  body('products').isArray({ min: 1 }).withMessage('ຕ້ອງມີສິນຄ້າຢ່າງໜ້ອຍ 1 ລາຍການ'),
  validate,
  async (req, res) => {
    interface ImportRow {
      code: string; nameLo: string; nameEn?: string;
      categoryId: number; unitId: number;
      standardPrice?: number; minStock?: number; maxStock?: number;
      location?: string; description?: string; barcode?: string;
    }
    const products: ImportRow[] = req.body.products;
    const created: unknown[] = [];
    const errors:  { row: number; code: string; error: string }[] = [];

    for (let i = 0; i < products.length; i++) {
      const row = products[i];
      try {
        const p = await prisma.product.create({
          data: {
            code:          String(row.code).trim(),
            nameLo:        String(row.nameLo).trim(),
            nameEn:        row.nameEn?.trim() || null,
            categoryId:    Number(row.categoryId),
            unitId:        Number(row.unitId),
            standardPrice: Number(row.standardPrice ?? 0),
            minStock:      Number(row.minStock ?? 0),
            maxStock:      Number(row.maxStock ?? 0),
            location:      row.location?.trim() || null,
            description:   row.description?.trim() || null,
            barcode:       row.barcode?.trim() || null,
          },
        });
        created.push(p);
      } catch (err: unknown) {
        errors.push({
          row:   i + 1,
          code:  row.code ?? '',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    ApiResponse.success(res, { created: created.length, errors }, `ນຳເຂົ້າສຳເລັດ ${created.length} ລາຍການ${errors.length ? `, ຜິດພາດ ${errors.length} ລາຍການ` : ''}`);
  });

export default router;
