import { Request, Response, NextFunction, RequestHandler } from 'express';
import { RoleCode } from '@prisma/client';
import { AuthRequest } from '../types';
import { ApiResponse } from '../utils/ApiResponse';

export function authorize(...roles: RoleCode[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = (req as AuthRequest).user?.role?.code;
    if (!userRole || !roles.includes(userRole)) {
      ApiResponse.forbidden(res);
      return;
    }
    next();
  };
}
