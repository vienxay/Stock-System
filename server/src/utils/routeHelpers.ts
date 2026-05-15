import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AuthRequest } from '../types';

export const asAuth = (fn: (r: AuthRequest, res: Response) => Promise<void>): RequestHandler =>
  (req: Request, res: Response, _n: NextFunction) => fn(req as unknown as AuthRequest, res);
