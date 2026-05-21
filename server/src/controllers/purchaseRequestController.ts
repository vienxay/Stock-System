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
  async update(req: AuthRequest, res: Response) {
    ApiResponse.success(
      res,
      await purchaseRequestService.update(Number(req.params.id), req.body as CreatePrDto, req.user.id, req.user.role.code),
      'ແກ້ໄຂ PR ສຳເລັດ',
    );
  },
  async submit(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.submit(Number(req.params.id), req.user.id, req.user.role.code), 'ສົ່ງ PR ສຳເລັດ');
  },
  async resubmit(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.resubmit(Number(req.params.id), req.user.id, req.user.role.code), 'ສົ່ງ PR ໃໝ່ສຳເລັດ');
  },
  async approve(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.handleApproval(Number(req.params.id), req.user.id, req.user.role.code, req.body as ApproveDto), 'ດຳເນີນການ ສຳເລັດ');
  },
  async cancel(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseRequestService.cancel(Number(req.params.id), req.user.id, req.user.role.code), 'ຍົກເລີກ PR ສຳເລັດ');
  },
  async createPo(req: AuthRequest, res: Response) {
    const items = req.body.items as { pr_item_id: number; supplier_id: number }[] | undefined;
    const result = await purchaseRequestService.createPoFromPr(Number(req.params.id), req.user.id, items);
    const msg = result.fullyCovered
      ? `ສ້າງ PO ຄົບແລ້ວ (${result.purchaseOrders.map((p) => p.poNumber).join(', ')})`
      : `ສ້າງ PO ບາງສ່ວນແລ້ວ — ກວດລາຍການທີ່ຍັງຄ້າງ`;
    ApiResponse.created(res, result.purchaseOrders, msg);
  },
};
