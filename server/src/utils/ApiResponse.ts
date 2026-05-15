import { Response } from 'express';
import { PaginationMeta } from '../types';

export class ApiResponse {
  static success<T>(res: Response, data: T | null = null, message = 'Success', statusCode = 200) {
    return res.status(statusCode).json({ success: true, message, data });
  }

  static created<T>(res: Response, data: T, message = 'Created successfully') {
    return ApiResponse.success(res, data, message, 201);
  }

  static paginate<T>(
    res:     Response,
    data:    T[],
    meta:    PaginationMeta,
    message = 'Success',
  ) {
    return res.status(200).json({ success: true, message, data, pagination: meta });
  }

  static error(res: Response, message = 'Internal Server Error', statusCode = 500, errors?: unknown) {
    return res.status(statusCode).json({ success: false, message, ...(errors ? { errors } : {}) });
  }

  static notFound(res: Response, message = 'ບໍ່ພົບຂໍ້ມູນ') {
    return ApiResponse.error(res, message, 404);
  }

  static unauthorized(res: Response, message = 'ກະລຸນາ Login ກ່ອນ') {
    return ApiResponse.error(res, message, 401);
  }

  static forbidden(res: Response, message = 'ທ່ານບໍ່ມີສິດໃຊ້ງານ') {
    return ApiResponse.error(res, message, 403);
  }

  static badRequest(res: Response, message = 'ຂໍ້ມູນບໍ່ຖືກຕ້ອງ', errors?: unknown) {
    return ApiResponse.error(res, message, 400, errors);
  }
}
