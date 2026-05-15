import { Response } from 'express';
import { stockMovementService } from '../services/stockMovementService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest, StockMovementFilter, IssueOutDto, AdjustStockDto } from '../types';

export const stockMovementController = {

  async findAll(req: AuthRequest, res: Response) {
    const { rows, meta } = await stockMovementService.findAll(req.query as StockMovementFilter);
    ApiResponse.paginate(res, rows, meta);
  },

  async findByProduct(req: AuthRequest, res: Response) {
    const result = await stockMovementService.findByProduct(
      Number(req.params.productId),
      req.query as StockMovementFilter,
    );
    ApiResponse.paginate(res, result.rows, result.meta, `Stock ປັດຈຸບັນ: ${result.product.currentStock}`);
  },

  async issueOut(req: AuthRequest, res: Response) {
    const result = await stockMovementService.issueOut(req.body as IssueOutDto, req.user.id);
    ApiResponse.created(res, result, 'ເບີກສິນຄ້າອອກສຳເລັດ');
  },

  async adjust(req: AuthRequest, res: Response) {
    const result = await stockMovementService.adjust(req.body as AdjustStockDto, req.user.id);
    ApiResponse.created(res, result, 'ປັບຍອດ Stock ສຳເລັດ');
  },
};
