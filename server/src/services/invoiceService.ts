import { InvoiceStatus, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { generateRunningNumber, buildPaginationMeta } from '../utils/runningNumber';
import { CreateInvoiceDto, CreatePaymentDto } from '../types';
import { env } from '../config/env';
import { auditLog } from './auditLogService';

class InvoiceService {

  async create(dto: CreateInvoiceDto, createdBy: number) {
    const invoice = await prisma.$transaction(async (tx) => {
      const po = await (tx as typeof prisma).purchaseOrder.findUniqueOrThrow({ where: { id: dto.po_id } });
      const tolerance  = Number(po.totalAmount) * (env.INVOICE_MATCH_TOLERANCE_PERCENT / 100);
      const variance   = Number(dto.invoice_amount) - Number(po.totalAmount);
      const isMatched  = Math.abs(variance) <= tolerance;
      const taxAmount  = dto.tax_amount ?? 0;

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
            title:   `Invoice ${dto.invoice_number} ຈຳນວນບໍ່ກົງ PO`,
            message: `ຜົນຕ່າງ ${variance.toFixed(2)} LAK (>${env.INVOICE_MATCH_TOLERANCE_PERCENT}%)`,
            refType: 'INVOICE', refId: inv.id,
          },
        });
      }
      return inv;
    });
    // audit ຫຼັງ transaction commit — ຈຶ່ງບໍ່ orphan ຖ້າ rollback
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

  // ─── ແກ້ໄຂຈຳນວນ Invoice (mismatch → re-match) ──────────────
  async updateAmount(id: number, newAmount: number, note: string | undefined, userId: number) {
    return prisma.$transaction(async (tx) => {
      const inv = await (tx as typeof prisma).invoice.findUnique({
        where: { id }, include: { purchaseOrder: { select: { totalAmount: true } } },
      });
      if (!inv) throw AppError.notFound('ບໍ່ພົບ Invoice');
      if (!['mismatch', 'received'].includes(inv.status)) throw AppError.badRequest('ແກ້ໄຂໄດ້ສະເພາະ Invoice ທີ່ mismatch/received');

      const po          = inv.purchaseOrder;
      const tolerance   = Number(po.totalAmount) * (env.INVOICE_MATCH_TOLERANCE_PERCENT / 100);
      const variance    = newAmount - Number(po.totalAmount);
      const isMatched   = Math.abs(variance) <= tolerance;
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

  // ─── Override ອະນຸມັດ (mismatch ໂດຍມີ comment) ─────────────
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

  // ─── ຍົກເລີກ Invoice ─────────────────────────────────────────
  async cancel(id: number, userId: number) {
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) throw AppError.notFound('ບໍ່ພົບ Invoice');
    if (['approved', 'paid'].includes(inv.status)) throw AppError.badRequest('ບໍ່ສາມາດຍົກເລີກ Invoice ທີ່ approved/paid ແລ້ວ');
    await prisma.invoice.delete({ where: { id } });
    auditLog(userId, 'DELETE', 'invoices', id, { status: inv.status, invoiceNumber: inv.invoiceNumber }, null);
    return { deleted: true };
  }

  async pay(invoiceId: number, dto: CreatePaymentDto, approvedBy: number) {
    return prisma.$transaction(async (tx) => {
      const invoice = await (tx as typeof prisma).invoice.findUnique({ where: { id: invoiceId } });
      if (!invoice) throw AppError.notFound('ບໍ່ພົບ Invoice');
      if (invoice.status !== 'approved') throw AppError.badRequest('Invoice ຕ້ອງ approved ກ່ອນ');

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

      await (tx as typeof prisma).invoice.update({ where: { id: invoiceId }, data: { status: 'paid' } });
      auditLog(approvedBy, 'UPDATE', 'invoices', invoiceId, { status: 'approved' }, { status: 'paid', amountPaid: dto.amount_paid });
      return payment;
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
          payments:     true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit, skip: (page - 1) * limit,
      }),
      prisma.invoice.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(total, page, limit) };
  }
}

export const invoiceService = new InvoiceService();
