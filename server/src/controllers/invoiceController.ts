import { Response } from 'express';
import { invoiceService } from '../services/invoiceService';
import { ApiResponse } from '../utils/ApiResponse';
import { AuthRequest, CreateInvoiceDto, CreatePaymentDto } from '../types';

export const invoiceController = {
  async create(req: AuthRequest, res: Response) {
    ApiResponse.created(res, await invoiceService.create(req.body as CreateInvoiceDto, req.user.id), 'ຮັບ Invoice ສຳເລັດ');
  },
  async findAll(req: AuthRequest, res: Response) {
    const { page, limit, status } = req.query as { page?: string; limit?: string; status?: string };
    const { rows, meta } = await invoiceService.findAll(Number(page ?? 1), Number(limit ?? 20), status);
    ApiResponse.paginate(res, rows, meta);
  },
  async approve(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await invoiceService.approve(Number(req.params.id), req.user.id), 'ອະນຸມັດ Invoice ສຳເລັດ');
  },
  async pay(req: AuthRequest, res: Response) {
    ApiResponse.created(res, await invoiceService.pay(Number(req.params.id), req.body as CreatePaymentDto, req.user.id), 'ຈ່າຍເງິນສຳເລັດ');
  },
  async updateAmount(req: AuthRequest, res: Response) {
    const { invoice_amount, note } = req.body as { invoice_amount: number; note?: string };
    ApiResponse.success(res, await invoiceService.updateAmount(Number(req.params.id), invoice_amount, note, req.user.id), 'ແກ້ໄຂຈຳນວນ Invoice ສຳເລັດ');
  },
  async overrideApprove(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await invoiceService.overrideApprove(Number(req.params.id), req.body.comment, req.user.id), 'Override ອະນຸມັດ Invoice ສຳເລັດ');
  },
  async cancel(req: AuthRequest, res: Response) {
    ApiResponse.success(res, await invoiceService.cancel(Number(req.params.id), req.user.id), 'ຍົກເລີກ Invoice ສຳເລັດ');
  },
};
