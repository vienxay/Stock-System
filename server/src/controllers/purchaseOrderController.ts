import { Response } from 'express';
import { purchaseOrderService } from '../services/purchaseOrderService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest, PoFilter, ReceiveGoodsDto } from '../types';

export const purchaseOrderController = {
  async findAll(req: AuthRequest, res: Response) {
    const { rows, meta } = await purchaseOrderService.findAll(req.query as PoFilter);
    ApiResponse.paginate(res, rows, meta);
  },
  async findById(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseOrderService.findById(Number(req.params.id)));
  },
  async markSent(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseOrderService.markSent(Number(req.params.id), req.user.id), 'ສົ່ງ PO ສຳເລັດ');
  },
  async receiveGoods(req: AuthRequest, res: Response) {
    ApiResponse.created(res, await purchaseOrderService.receiveGoods(Number(req.params.id), req.body as ReceiveGoodsDto, req.user.id), 'ຮັບຂອງ GR ສຳເລັດ');
  },
  async cancelPo(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseOrderService.cancelPo(Number(req.params.id), req.user.id), 'ຍົກເລີກ PO ສຳເລັດ');
  },
  async cancelGr(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await purchaseOrderService.cancelGoodsReceipt(Number(req.params.grId), req.user.id), 'ຍົກເລີກ GR ສຳເລັດ');
  },
};
