import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';
import { ApiResponse } from '../utils/ApiResponse';

export function validate(req: Request, res: Response, next: NextFunction): void {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({ field: (e as { path: string }).path, message: e.msg }));
    ApiResponse.badRequest(res, 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ', formatted);
    return;
  }
  next();
}
