import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { JwtPayload } from '../types';

class AuthService {
  async login(username: string, password: string) {
    const user = await prisma.user.findUnique({
      where:   { username, isActive: true },
      include: { role: { select: { code: true, nameLo: true } } },
    });
    if (!user) throw AppError.unauthorized('ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw AppError.unauthorized('ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');

    const payload: JwtPayload = { id: user.id, role: user.role.code };

    const accessToken  = jwt.sign(payload, env.JWT_SECRET,         { expiresIn: env.JWT_EXPIRES_IN  as jwt.SignOptions['expiresIn'] });
    const refreshToken = jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'] });

    const { password: _, ...safeUser } = user;
    return { accessToken, refreshToken, user: safeUser };
  }

  async refresh(token: string) {
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
    } catch {
      throw AppError.unauthorized('Refresh token ໝົດອາຍຸ ກະລຸນາ Login ໃໝ່');
    }

    const user = await prisma.user.findUnique({
      where:   { id: decoded.id, isActive: true },
      include: { role: { select: { code: true } } },
    });
    if (!user) throw AppError.unauthorized('ບໍ່ພົບຜູ້ໃຊ້');

    const accessToken = jwt.sign(
      { id: user.id, role: user.role.code } satisfies JwtPayload,
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] },
    );
    return { accessToken };
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw AppError.badRequest('ລະຫັດຜ່ານເກົ່າບໍ່ຖືກຕ້ອງ');

    const hashed = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
  }
}

export const authService = new AuthService();
