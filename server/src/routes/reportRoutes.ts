import { Router, Request, Response } from 'express';
import { authenticate }  from '../middlewares/authMiddleware';
import { reportService } from '../services/reportService';
import ExcelJS from 'exceljs';

const router = Router();
router.use(authenticate);

const sendExcel = async (wb: ExcelJS.Workbook, filename: string, res: Response) => {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
};

const q = (req: Request) => req.query as Record<string, string>;

router.get('/stock',              async (req, res) => sendExcel(await reportService.stockReport(),                         'stock-report',          res));
router.get('/purchase-requests',  async (req, res) => sendExcel(await reportService.prReport(q(req)),                     'pr-report',             res));
router.get('/purchase-orders',    async (req, res) => sendExcel(await reportService.poReport(q(req)),                     'po-report',             res));
router.get('/invoices',           async (req, res) => sendExcel(await reportService.invoiceReport(q(req)),                'invoice-report',        res));
router.get('/stock-movements',    async (req, res) => sendExcel(await reportService.stockMovementReport(q(req)),          'stock-movement-report', res));

export default router;
