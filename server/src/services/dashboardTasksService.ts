import { RoleCode } from '@prisma/client';
import { prisma } from '../config/prisma';
export interface PendingTask {
  type:        string;
  title:       string;
  message:     string;
  count:       number;
  refType:     string;
  refId:       number;
  href:        string;
  priority:    'high' | 'normal';
}

class DashboardTasksService {

  async getPendingTasks(role: RoleCode, userId: number): Promise<PendingTask[]> {
    const tasks: PendingTask[] = [];
    const push = (t: PendingTask) => tasks.push(t);

    if (role === RoleCode.finance || role === RoleCode.admin) {
      const prs = await prisma.purchaseRequest.findMany({
        where:  { status: 'finance_review' },
        select: { id: true, prNumber: true, totalAmount: true },
        take:   10,
        orderBy: { createdAt: 'asc' },
      });
      if (prs.length > 0) {
        push({
          type: 'pr_finance_review', title: 'PR ລໍ Finance ອະນຸມັດ',
          message: prs.map((p) => p.prNumber).join(', '),
          count: prs.length, refType: 'PR', refId: prs[0]!.id,
          href: '/purchase-requests?status=finance_review', priority: 'high',
        });
      }
    }

    if (role === RoleCode.md || role === RoleCode.admin) {
      const prs = await prisma.purchaseRequest.findMany({
        where:  { status: 'md_review' },
        select: { id: true, prNumber: true },
        take:   10,
        orderBy: { createdAt: 'asc' },
      });
      if (prs.length > 0) {
        push({
          type: 'pr_md_review', title: 'PR ລໍ MD ອະນຸມັດ',
          message: prs.map((p) => p.prNumber).join(', '),
          count: prs.length, refType: 'PR', refId: prs[0]!.id,
          href: '/purchase-requests?status=md_review', priority: 'high',
        });
      }
    }

    if (role === RoleCode.user || role === RoleCode.admin) {
      const where = role === RoleCode.user
        ? { requesterId: userId, status: { in: ['finance_rejected' as const, 'md_rejected' as const] } }
        : { status: { in: ['finance_rejected' as const, 'md_rejected' as const] } };
      const rejected = await prisma.purchaseRequest.count({ where });
      if (rejected > 0) {
        const first = await prisma.purchaseRequest.findFirst({
          where, select: { id: true }, orderBy: { updatedAt: 'desc' },
        });
        push({
          type: 'pr_rejected', title: 'PR ຖືກປະຕິເສດ — ຕ້ອງແກ້ໄຂ',
          message: `${rejected} ລາຍການ`,
          count: rejected, refType: 'PR', refId: first!.id,
          href: '/purchase-requests', priority: 'high',
        });
      }
    }

    if (role === RoleCode.purchasing || role === RoleCode.admin) {
      const needsPo = await prisma.purchaseRequest.findMany({
        where:  { status: 'md_approved' },
        select: { id: true, prNumber: true },
        take:   10,
      });
      if (needsPo.length > 0) {
        push({
          type: 'pr_needs_po', title: 'PR ລໍສ້າງ PO',
          message: needsPo.map((p) => p.prNumber).join(', '),
          count: needsPo.length, refType: 'PR', refId: needsPo[0]!.id,
          href: '/purchase-requests?status=md_approved', priority: 'high',
        });
      }

      const openPos = await prisma.purchaseOrder.count({ where: { status: 'open' } });
      if (openPos > 0) {
        const first = await prisma.purchaseOrder.findFirst({
          where: { status: 'open' }, select: { id: true }, orderBy: { createdAt: 'asc' },
        });
        push({
          type: 'po_open', title: 'PO ລໍສົ່ງໃຫ້ Supplier',
          message: `${openPos} ລາຍການ`,
          count: openPos, refType: 'PO', refId: first!.id,
          href: '/purchase-orders?status=open', priority: 'normal',
        });
      }
    }

    if (role === RoleCode.stock || role === RoleCode.admin) {
      const toReceive = await prisma.purchaseOrder.count({
        where: { status: { in: ['sent', 'partial_received'] } },
      });
      if (toReceive > 0) {
        const first = await prisma.purchaseOrder.findFirst({
          where: { status: { in: ['sent', 'partial_received'] } },
          select: { id: true }, orderBy: { sentAt: 'asc' },
        });
        push({
          type: 'po_receive', title: 'PO ລໍຮັບສິນຄ້າ',
          message: `${toReceive} ລາຍການ`,
          count: toReceive, refType: 'PO', refId: first!.id,
          href: '/purchase-orders?status=sent', priority: 'high',
        });
      }

      const lowProducts = await prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM products
        WHERE is_active = true AND current_stock <= min_stock`;
      const low = Number(lowProducts[0]?.count ?? 0);
      if (low > 0) {
        push({
          type: 'low_stock', title: 'ສິນຄ້າ Stock ນ້ອຍ',
          message: `${low} ລາຍການ`,
          count: low, refType: 'PRODUCT', refId: 0,
          href: '/products', priority: 'normal',
        });
      }
    }

    if (role === RoleCode.ap || role === RoleCode.admin) {
      const [mismatch, needApprove, needPay, needsInv] = await Promise.all([
        prisma.invoice.count({ where: { status: 'mismatch' } }),
        prisma.invoice.count({ where: { status: 'matched' } }),
        prisma.invoice.findMany({
          where:  { status: 'approved' },
          include: { payments: true },
          take:   50,
        }),
        prisma.purchaseOrder.count({
          where: {
            status:   { in: ['partial_received', 'received'] },
            invoices: { none: {} },
          },
        }),
      ]);

      const partialPay = needPay.filter((inv) => {
        const paid = inv.payments.reduce((s, p) => s + Number(p.amountPaid), 0);
        return paid < Number(inv.totalAmount);
      }).length;

      if (needsInv > 0) {
        push({
          type: 'po_needs_invoice', title: 'PO ຮັບແລ້ວ — ຍັງບໍ່ມີ Invoice',
          message: `${needsInv} ລາຍການ`,
          count: needsInv, refType: 'PO', refId: 0,
          href: '/invoices', priority: 'high',
        });
      }
      if (mismatch > 0) {
        const first = await prisma.invoice.findFirst({
          where: { status: 'mismatch' }, select: { id: true },
        });
        push({
          type: 'invoice_mismatch', title: 'Invoice ຈຳນວນບໍ່ກົງ',
          message: `${mismatch} ລາຍການ`,
          count: mismatch, refType: 'INVOICE', refId: first!.id,
          href: '/invoices?status=mismatch', priority: 'high',
        });
      }
      if (needApprove > 0) {
        const first = await prisma.invoice.findFirst({
          where: { status: 'matched' }, select: { id: true },
        });
        push({
          type: 'invoice_approve', title: 'Invoice ລໍອະນຸມັດ',
          message: `${needApprove} ລາຍການ`,
          count: needApprove, refType: 'INVOICE', refId: first!.id,
          href: '/invoices?status=matched', priority: 'normal',
        });
      }
      if (partialPay > 0) {
        const first = await prisma.invoice.findFirst({
          where: { status: 'approved' },
          include: { payments: true },
        });
        push({
          type: 'invoice_pay', title: 'Invoice ລໍຊຳລະ',
          message: `${partialPay} ລາຍການ`,
          count: partialPay, refType: 'INVOICE', refId: first!.id,
          href: '/invoices?status=approved', priority: 'high',
        });
      }
    }

    return tasks;
  }
}

export const dashboardTasksService = new DashboardTasksService();
