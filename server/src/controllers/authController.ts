import { Request, Response } from 'express';
import { authService } from '../services/authService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest } from '../types';

export const authController = {
  async login(req: Request, res: Response) {
    const { username, password } = req.body as { username: string; password: string };
    ApiResponse.success(res, await authService.login(username, password), 'Login ສຳເລັດ');
  },
  async refresh(req: Request, res: Response) {
    ApiResponse.success(res, await authService.refresh((req.body as { refresh_token: string }).refresh_token));
  },
  async me(req: Request, res: Response) {
    ApiResponse.success(res, (req as AuthRequest).user);
  },
  async changePassword(req: Request, res: Response) {
    const { old_password, new_password } = req.body as { old_password: string; new_password: string };
    await authService.changePassword((req as AuthRequest).user.id, old_password, new_password);
    ApiResponse.success(res, null, 'ປ່ຽນລະຫັດຜ່ານສຳເລັດ');
  },
  async logout(_req: Request, res: Response) {
    ApiResponse.success(res, null, 'Logout ສຳເລັດ');
  },
};
