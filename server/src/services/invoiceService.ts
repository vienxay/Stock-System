import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { generateRunningNumber, buildPaginationMeta } from '../utils/runningNumber';
import { CreateInvoiceDto, CreatePaymentDto } from '../types';
import { env } from '../config/env';
import { auditLog } from './auditLogService';
import { computeGrAmount, evaluateInvoiceMatch } from '../utils/invoiceMatch';

type Tx = Prisma.TransactionClient;

class InvoiceService {

  private async loadMatchAmounts(poId: number, grId: number, tx: Tx) {
    const po = await (tx as typeof prisma).purchaseOrder.findUniqueOrThrow({ where: { id: poId } });
    const gr = await (tx as typeof prisma).goodsReceipt.findUniqueOrThrow({
      where:   { id: grId },
      include: { items: { include: { poItem: true } } },
    });
    if (gr.poId !== poId) throw AppError.badRequest('GR ບໍ່ກັບ PO ນີ້');

    const poAmount = Number(po.totalAmount);
    const grAmount = computeGrAmount(gr.items);
    return { poAmount, grAmount };
  }

  async create(dto: CreateInvoiceDto, createdBy: number) {
    const invoice = await prisma.$transaction(async (tx) => {
      const { poAmount, grAmount } = await this.loadMatchAmounts(dto.po_id, dto.gr_id, tx);
      const { isMatched, variance } = evaluateInvoiceMatch(
        Number(dto.invoice_amount),
        poAmount,
        grAmount,
        env.INVOICE_MATCH_TOLERANCE_PERCENT,
      );
      const taxAmount = dto.tax_amount ?? 0;
      const po        = await (tx as typeof prisma).purchaseOrder.findUniqueOrThrow({ where: { id: dto.po_id } });

      const inv = await (tx as typeof prisma).invoice.create({
        data: {
          grId: dto.gr_id, poId: dto.po_id, supplierId: po.supplierId, createdBy,
          invoiceNumber: dto.invoice_number,
          invoiceDate:   new Date(dto.invoice_date),
          dueDate:       dto.due_date ? new Date(dto.due_date) : null,
          invoiceAmount: dto.invoice_amount,
          taxAmount,
          totalAmount:   dto.invoice_amount + taxAmount,
          status:        isMatched ? 'matched' : 'mismatch',
          matchVariance: variance,
          note:          dto.note ?? null,
        },
      });

      if (!isMatched) {
        await (tx as typeof prisma).notification.create({
          data: {
            userId:  createdBy, type: 'invoice_mismatch',
            title:   `Invoice ${dto.invoice_number} ຈຳນວນບໍ່ກົງ PO/GR`,
            message: `PO ${poAmount.toLocaleString()} / GR ${grAmount.toLocaleString()} / Invoice ${Number(dto.invoice_amount).toLocaleString()} LAK (±${env.INVOICE_MATCH_TOLERANCE_PERCENT}%)`,
            refType: 'INVOICE', refId: inv.id,
          },
        });
      }
      return inv;
    });
    auditLog(createdBy, 'CREATE', 'invoices', invoice.id, null, {
      invoiceNumber: invoice.invoiceNumber,
      invoiceAmount: Number(invoice.invoiceAmount),
      status: invoice.status,
    });
    return invoice;
  }

  async approve(id: number, approverId = 0) {
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw AppError.notFound('ບໍ່ພົບ Invoice');
    if (invoice.status !== 'matched') throw AppError.badRequest('Invoice ຕ້ອງ matched ກ່ອນຈຶ່ງອະນຸມັດໄດ້');
    const updated = await prisma.invoice.update({ where: { id }, data: { status: 'approved' } });
    auditLog(approverId, 'UPDATE', 'invoices', id, { status: 'matched' }, { status: 'approved' });
    return updated;
  }

  async updateAmount(id: number, newAmount: number, note: string | undefined, userId: number) {
    return prisma.$transaction(async (tx) => {
      const inv = await (tx as typeof prisma).invoice.findUnique({
        where: { id },
      });
      if (!inv) throw AppError.notFound('ບໍ່ພົບ Invoice');
      if (!['mismatch', 'received'].includes(inv.status)) {
        throw AppError.badRequest('ແກ້ໄຂໄດ້ສະເພາະ Invoice ທີ່ mismatch/received');
      }

      const { poAmount, grAmount } = await this.loadMatchAmounts(inv.poId, inv.grId, tx);
      const { isMatched, variance } = evaluateInvoiceMatch(
        newAmount,
        poAmount,
        grAmount,
        env.INVOICE_MATCH_TOLERANCE_PERCENT,
      );
      const taxAmount   = Number(inv.taxAmount);
      const totalAmount = newAmount + taxAmount;

      const updated = await (tx as typeof prisma).invoice.update({
        where: { id },
        data: {
          invoiceAmount: newAmount,
          totalAmount,
          matchVariance: variance,
          status:        isMatched ? 'matched' : 'mismatch',
          note:          note ?? inv.note,
        },
      });
      auditLog(userId, 'UPDATE', 'invoices', id,
        { invoiceAmount: inv.invoiceAmount, status: inv.status },
        { invoiceAmount: newAmount, status: updated.status });
      return updated;
    });
  }

  async overrideApprove(id: number, comment: string, userId: number) {
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw AppError.notFound('ບໍ່ພົບ Invoice');
    if (!['mismatch', 'matched'].includes(inv.status)) throw AppError.badRequest('ອະນຸມັດໄດ້ສະເພາະ matched/mismatch');
    const updated = await prisma.invoice.update({
      where: { id },
      data:  { status: 'approved', note: `[Override] ${comment}` },
    });
    auditLog(userId, 'UPDATE', 'invoices', id, { status: inv.status }, { status: 'approved', note: updated.note });
    return updated;
  }

  async cancel(id: number, userId: number) {
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw AppError.notFound('ບໍ່ພົບ Invoice');
    if (inv.status === 'paid') throw AppError.badRequest('ບໍ່ສາມາດຍົກເລີກ Invoice ທີ່ຊຳລະຄົບແລ້ວ');
    const payCount = await prisma.payment.count({ where: { invoiceId: id } });
    if (payCount > 0) throw AppError.badRequest('ມີການຊຳລະແລ້ວ — ບໍ່ສາມາດຍົກເລີກ');
    await prisma.invoice.delete({ where: { id } });
    auditLog(userId, 'DELETE', 'invoices', id, { status: inv.status, invoiceNumber: inv.invoiceNumber }, null);
    return { deleted: true };
  }

  async pay(invoiceId: number, dto: CreatePaymentDto, approvedBy: number) {
    return prisma.$transaction(async (tx) => {
      const invoice = await (tx as typeof prisma).invoice.findUnique({
        where:   { id: invoiceId },
        include: { payments: true },
      });
      if (!invoice) throw AppError.notFound('ບໍ່ພົບ Invoice');
      if (!['approved', 'paid'].includes(invoice.status)) {
        throw AppError.badRequest('Invoice ຕ້ອງ approved ກ່ອນຈ່າຍ');
      }
      if (invoice.status === 'paid') {
        throw AppError.badRequest('Invoice ຊຳລະຄົບແລ້ວ');
      }

      const totalDue   = Number(invoice.totalAmount);
      const paidSoFar  = invoice.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
      const remaining  = totalDue - paidSoFar;

      if (remaining <= 0) {
        throw AppError.badRequest('Invoice ຊຳລະຄົບແລ້ວ');
      }
      if (dto.amount_paid <= 0) {
        throw AppError.badRequest('ຈຳນວນຊຳລະຕ້ອງ > 0');
      }
      if (dto.amount_paid > remaining + 0.01) {
        throw AppError.badRequest(`ຈຳນວນເກີນຍອດຄ້າງ (${remaining.toLocaleString()} LAK)`);
      }

      const paymentNumber = await generateRunningNumber('payments', 'PAY', tx);

      const payment = await (tx as typeof prisma).payment.create({
        data: {
          invoiceId,
          approvedBy,
          paymentNumber,
          paymentDate:   new Date(dto.payment_date),
          paymentMethod: dto.payment_method ?? 'bank_transfer',
          amountPaid:    dto.amount_paid,
          bankRef:       dto.bank_ref ?? null,
          note:          dto.note ?? null,
        },
      });

      const newPaidTotal = paidSoFar + dto.amount_paid;
      const fullyPaid    = newPaidTotal >= totalDue - 0.01;

      if (fullyPaid) {
        await (tx as typeof prisma).invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
      }

      auditLog(approvedBy, 'UPDATE', 'invoices', invoiceId,
        { status: invoice.status, paidSoFar },
        { status: fullyPaid ? 'paid' : 'approved', amountPaid: dto.amount_paid, paidTotal: newPaidTotal });

      return {
        payment,
        paidTotal:    newPaidTotal,
        remaining:    Math.max(0, totalDue - newPaidTotal),
        fullyPaid,
      };
    });
  }

  async findAll(page = 1, limit = 20, status?: string) {
    const where: Prisma.InvoiceWhereInput = status ? { status: status as InvoiceStatus } : {};
    const [rows, total] = await prisma.$transaction([
      prisma.invoice.findMany({
        where,
        include: {
          supplier:     { select: { name: true } },
          purchaseOrder: { select: { poNumber: true } },
          goodsReceipt: { select: { grNumber: true } },
          payments:     { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit, skip: (page - 1) * limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    const rowsWithPaid = rows.map((inv) => {
      const amountPaid = inv.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
      return {
        ...inv,
        amountPaid,
        amountRemaining: Math.max(0, Number(inv.totalAmount) - amountPaid),
      };
    });

    return { rows: rowsWithPaid, meta: buildPaginationMeta(total, page, limit) };
  }
}

export const invoiceService = new InvoiceService();
