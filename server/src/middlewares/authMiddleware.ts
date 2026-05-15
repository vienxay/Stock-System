import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { ApiResponse } from '../utils/ApiResponse';
import { JwtPayload, AuthRequest } from '../types';

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    ApiResponse.unauthorized(res);
    return;
  }
  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    const user = await prisma.user.findUnique({
      where:   { id: decoded.id, isActive: true },
      include: { role: { select: { code: true, nameLo: true } } },
    });

    if (!user) {
      ApiResponse.unauthorized(res, 'ບັນຊີຖືກປິດໃຊ້ງານ ຫຼື ບໍ່ພົບ');
      return;
    }

    (req as AuthRequest).user = user as AuthRequest['user'];
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      ApiResponse.unauthorized(res, 'Token ໝົດອາຍຸ ກະລຸນາ Login ໃໝ່');
    } else {
      ApiResponse.unauthorized(res, 'Token ບໍ່ຖືກຕ້ອງ');
    }
  }
}
