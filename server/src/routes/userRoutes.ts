import { Router }       from 'express';
import { body }         from 'express-validator';
import bcrypt           from 'bcryptjs';
import { RoleCode }     from '@prisma/client';
import { prisma }       from '../config/prisma';
import { ApiResponse }  from '../utils/ApiResponse';
import { AppError }     from '../utils/AppError';
import { authenticate } from '../middlewares/authMiddleware';
import { authorize }    from '../middlewares/authorizeMiddleware';
import { validate }     from '../middlewares/validateMiddleware';

const router = Router();
router.use(authenticate, authorize('admin'));


// ─── List ────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { search, role } = req.query as { search?: string; role?: string };
  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { email:    { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = { code: role };

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, username: true, fullName: true, email: true,
      phone: true, department: true, employeeId: true,
      isActive: true, createdAt: true,
      role: { select: { code: true, nameLo: true, nameEn: true } },
    },
  });
  ApiResponse.success(res, users);
});

// ─── Get one ─────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const user = await prisma.user.findUnique({
    where:  { id: Number(req.params.id) },
    select: {
      id: true, username: true, fullName: true, email: true,
      phone: true, department: true, employeeId: true, isActive: true,
      role: { select: { code: true, nameLo: true } },
    },
  });
  if (!user) throw AppError.notFound('ບໍ່ພົບ User');
  ApiResponse.success(res, user);
});

// ─── Create ──────────────────────────────────────────────────
router.post('/',
  body('username').notEmpty().isLength({ min: 3, max: 50 }).withMessage('username 3-50 ຕົວອັກສອນ'),
  body('password').isLength({ min: 8 }).withMessage('password ຕ້ອງຢ່າງໜ້ອຍ 8 ຕົວ'),
  body('fullName').notEmpty().withMessage('ກະລຸນາໃສ່ຊື່ເຕັມ'),
  body('roleCode').isIn(Object.values(RoleCode)).withMessage('role ບໍ່ຖືກຕ້ອງ'),
  body('email').optional().isEmail().withMessage('email ບໍ່ຖືກຕ້ອງ'),
  validate,
  async (req, res) => {
    const { username, password, fullName, roleCode, email, phone, department, employeeId } = req.body as {
      username: string; password: string; fullName: string; roleCode: RoleCode;
      email?: string; phone?: string; department?: string; employeeId?: string;
    };

    const role = await prisma.role.findUnique({ where: { code: roleCode } });
    if (!role) throw AppError.badRequest('Role ບໍ່ພົບໃນລະບົບ');

    const hashed = await bcrypt.hash(password, 12);
    const user   = await prisma.user.create({
      data: {
        roleId: role.id, username, password: hashed, fullName,
        email:      email      || null,
        phone:      phone      || null,
        department: department || null,
        employeeId: employeeId || null,
        isActive:   true,
      },
      select: {
        id: true, username: true, fullName: true, email: true,
        department: true, isActive: true,
        role: { select: { code: true, nameLo: true } },
      },
    });
    ApiResponse.created(res, user, 'ສ້າງ User ສຳເລັດ');
  });

// ─── Update (role, info, active) ────────────────────────────
router.put('/:id',
  body('fullName').optional().notEmpty(),
  body('roleCode').optional().isIn(Object.values(RoleCode)),
  body('email').optional().isEmail(),
  body('isActive').optional().isBoolean(),
  validate,
  async (req, res) => {
    const { fullName, roleCode, email, phone, department, employeeId, isActive } = req.body as {
      fullName?: string; roleCode?: RoleCode; email?: string;
      phone?: string; department?: string; employeeId?: string; isActive?: boolean;
    };

    const updateData: Record<string, unknown> = {};
    if (fullName   !== undefined) updateData.fullName   = fullName;
    if (email      !== undefined) updateData.email      = email || null;
    if (phone      !== undefined) updateData.phone      = phone || null;
    if (department !== undefined) updateData.department = department || null;
    if (employeeId !== undefined) updateData.employeeId = employeeId || null;
    if (isActive   !== undefined) updateData.isActive   = isActive;

    if (roleCode) {
      const role = await prisma.role.findUnique({ where: { code: roleCode } });
      if (!role) throw AppError.badRequest('Role ບໍ່ພົບ');
      updateData.roleId = role.id;
    }

    const user = await prisma.user.update({
      where:  { id: Number(req.params.id) },
      data:   updateData,
      select: {
        id: true, username: true, fullName: true, email: true,
        department: true, isActive: true,
        role: { select: { code: true, nameLo: true } },
      },
    });
    ApiResponse.success(res, user, 'ອັບເດດ User ສຳເລັດ');
  });

// ─── Reset password ──────────────────────────────────────────
router.patch('/:id/reset-password',
  body('newPassword').isLength({ min: 8 }).withMessage('password ຕ້ອງຢ່າງໜ້ອຍ 8 ຕົວ'),
  validate,
  async (req, res) => {
    const { newPassword } = req.body as { newPassword: string };
    const hashed          = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: Number(req.params.id) },
      data:  { password: hashed },
    });
    ApiResponse.success(res, null, 'Reset password ສຳເລັດ');
  });

export default router;
