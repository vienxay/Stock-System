import { Response } from 'express';
import { purchaseRequestService } from '../services/purchaseRequestService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest, PrFilter, ApproveDto, CreatePrDto } from '../types';

export const purchaseRequestController = {
  async create(req: AuthRequest, res: Response) {
    ApiResponse.created(res, await purchaseRequestService.create(req.body as CreatePrDto, req.user.id), 'ສ້າງ PR ສຳເລັດ');
  },
  async findAll(req: AuthRequest, res: Response) {
    const { rows, meta } = await purchaseRequestService.findAll(req.query as PrFilter, req.user.role.code, req.user.id);
    ApiResponse.paginate(res, rows, meta);
  },
  async findById(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.findById(Number(req.params.id)));
  },
  async submit(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.submit(Number(req.params.id), req.user.id, req.user.role.code), 'ສົ່ງ PR ສຳເລັດ');
  },
  async approve(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.handleApproval(Number(req.params.id), req.user.id, req.user.role.code, req.body as ApproveDto), 'ດຳເນີນການ ສຳເລັດ');
  },
  async cancel(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.cancel(Number(req.params.id), req.user.id, req.user.role.code), 'ຍົກເລີກ PR ສຳເລັດ');
  },
};
