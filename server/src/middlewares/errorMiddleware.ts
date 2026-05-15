import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/AppError';
import { ApiResponse } from '../utils/ApiResponse';
import { logger } from '../config/logger';

export function errorHandler(
  err:  Error,
  req:  Request,
  res:  Response,
  _next: NextFunction,
): void {
  logger.error(`${req.method} ${req.path} — ${err.message}`, { stack: err.stack });

  if (err instanceof AppError) {
    ApiResponse.error(res, err.message, err.statusCode, err.errors);
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const field = (err.meta?.target as string[])?.join(', ') ?? 'field';
      ApiResponse.badRequest(res, `${field} ຊ້ຳກັນ ກະລຸນາກວດສອບ`);
      return;
    }
    if (err.code === 'P2025') {
      ApiResponse.notFound(res, 'ບໍ່ພົບຂໍ້ມູນ');
      return;
    }
    ApiResponse.badRequest(res, 'ເກີດຂໍ້ຜິດພາດຈາກຖານຂໍ້ມູນ ກະລຸນາລອງໃໝ່');
    return;
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    ApiResponse.badRequest(res, 'ຂໍ້ມູນ Prisma ບໍ່ຖືກຕ້ອງ');
    return;
  }

  ApiResponse.error(res, 'Internal Server Error', 500);
}
