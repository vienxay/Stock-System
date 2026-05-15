import { Prisma, PurchaseOrder } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { generateRunningNumber, buildPaginationMeta } from '../utils/runningNumber';
import { ReceiveGoodsDto, PoFilter } from '../types';
import { auditLog } from './auditLogService';

class PurchaseOrderService {

  // ─── Auto-create PO from approved PR ───────────────────────
  async createFromPR(
    prId:     number,
    userId:   number,
    tx:       Prisma.TransactionClient,
  ) {
    const pr = await (tx as typeof prisma).purchaseRequest.findUniqueOrThrow({
      where:   { id: prId },
      include: { items: true },
    });

    // ກຸ່ມ items ຕາມ supplierId
    const grouped = new Map<number, typeof pr.items>();
    for (const item of pr.items) {
      const sid = item.supplierId ?? 0;
      if (!grouped.has(sid)) grouped.set(sid, []);
      grouped.get(sid)!.push(item);
    }

    let firstPO: PurchaseOrder | null = null;

    for (const [supplierId, items] of grouped.entries()) {
      // ລາຍການທີ່ບໍ່ມີ supplier → ຂ້າມ, ບໍ່ throw error
      if (supplierId === 0) continue;

      const poNumber = await generateRunningNumber('purchase_orders', 'PO', tx);
      const total    = items.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);

      const po = await (tx as typeof prisma).purchaseOrder.create({
        data: {
          poNumber,
          prId,
          supplierId,
          createdBy:   userId,
          totalAmount: total,
          status:      'open',
          items: {
            create: items.map((item) => ({
              prItemId:  item.id,
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });
      if (!firstPO) firstPO = po;
    }

    // null = ທຸກ items ບໍ່ມີ supplier → ຜູ້ຂໍຊື້ຕ້ອງເພີ່ມ supplier ກ່ອນ
    return firstPO;
  }

  // ─── List ──────────────────────────────────────────────────
  async findAll(filter: PoFilter) {
    const page  = Number(filter.page  ?? 1);
    const limit = Number(filter.limit ?? 20);
    const where: Prisma.PurchaseOrderWhereInput = {};
    if (filter.status)      where.status     = filter.status as Prisma.EnumPoStatusFilter;
    if (filter.supplier_id) where.supplierId = Number(filter.supplier_id);

    const [rows, total] = await prisma.$transaction([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { name: true, phone: true } },
          creator:  { select: { fullName: true } },
          items:    { include: { product: { include: { unit: true } } } },
          _count:   { select: { goodsReceipts: true } },
        },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    (page - 1) * limit,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return { rows, meta: buildPaginationMeta(total, page, limit) };
  }

  async findById(id: number) {
    const po = await prisma.purchaseOrder.findUnique({
      where:   { id },
      include: {
        supplier:       true,
        creator:        { select: { fullName: true } },
        purchaseRequest: { select: { prNumber: true, purpose: true } },
        items:          { include: { product: { include: { unit: true } } } },
        goodsReceipts:  { include: { receiver: { select: { fullName: true } }, items: true } },
        invoices:       { select: { id: true, invoiceNumber: true, status: true, totalAmount: true } },
      },
    });
    if (!po) throw AppError.notFound('ບໍ່ພົບ PO');
    return po;
  }

  async markSent(id: number, userId = 0) {
    const po = await prisma.purchaseOrder.findUnique({
      where:   { id },
      include: { supplier: { select: { name: true } } },
    });
    if (!po) throw AppError.notFound('ບໍ່ພົບ PO');
    if (po.status !== 'open') throw AppError.badRequest('PO status ຕ້ອງເປັນ open');

    const [updated, stockUsers] = await Promise.all([
      prisma.purchaseOrder.update({ where: { id }, data: { status: 'sent', sentAt: new Date() } }),
      prisma.user.findMany({ where: { role: { code: 'stock' }, isActive: true } }),
    ]);

    if (stockUsers.length > 0) {
      await prisma.notification.createMany({
        data: stockUsers.map((u) => ({
          userId:  u.id,
          type:    'po_sent',
          title:   `PO ${po.poNumber} ສົ່ງໃຫ້ Supplier ແລ້ວ — ກຽມຮັບສິນຄ້າ`,
          message: `Supplier: ${po.supplier?.name ?? ''}`,
          refType: 'PO',
          refId:   id,
        })),
      });
    }

    auditLog(userId, 'UPDATE', 'purchase_orders', id, { status: 'open' }, { status: 'sent' });
    return updated;
  }

  // ─── Receive Goods (GR) ─────────────────────────────────────
  async receiveGoods(poId: number, dto: ReceiveGoodsDto, receivedBy: number) {
    return prisma.$transaction(async (tx) => {
      const po = await (tx as typeof prisma).purchaseOrder.findUnique({
        where:   { id: poId },
        include: { items: true },
      });
      if (!po) throw AppError.notFound('ບໍ່ພົບ PO');
      if (po.status === 'received') throw AppError.badRequest('PO ຮັບຂອງຄົບແລ້ວ');

      const grNumber = await generateRunningNumber('goods_receipts', 'GR', tx);

      const gr = await (tx as typeof prisma).goodsReceipt.create({
        data: {
          grNumber,
          poId,
          receivedBy,
          receivedDate: dto.received_date ? new Date(dto.received_date) : new Date(),
          status:       'completed',
          note:         dto.note ?? null,
          items: {
            create: await Promise.all(dto.items.map(async (item) => {
              const poItem = po.items.find((i) => i.id === item.po_item_id);
              if (!poItem) throw AppError.badRequest(`ບໍ່ພົບ PO item ID: ${item.po_item_id}`);
              return {
                poItemId:    item.po_item_id,
                productId:   poItem.productId,
                orderedQty:  poItem.quantity,
                receivedQty: item.received_qty,
                rejectedQty: item.rejected_qty ?? 0,
                note:        item.note ?? null,
              };
            })),
          },
        },
        include: { items: true },
      });

      // ─── Update Stock ───────────────────────────────────────
      for (const grItem of gr.items) {
        const product = await (tx as typeof prisma).product.findUniqueOrThrow({
          where: { id: grItem.productId },
        });
        const before = product.currentStock;
        const after  = before + grItem.receivedQty;

        await (tx as typeof prisma).product.update({
          where: { id: grItem.productId },
          data:  { currentStock: after },
        });
        await (tx as typeof prisma).stockMovement.create({
          data: {
            productId:    grItem.productId,
            createdBy:    receivedBy,
            movementType: 'gr_in',
            quantity:     grItem.receivedQty,
            beforeQty:    before,
            afterQty:     after,
            refType:      'GR',
            refId:        gr.id,
          },
        });

        // ອັບ receivedQty ໃນ PO item
        await (tx as typeof prisma).purchaseOrderItem.update({
          where: { id: grItem.poItemId },
          data:  { receivedQty: { increment: grItem.receivedQty } },
        });
      }

      // ─── Check if PO fully received ─────────────────────────
      const refreshedItems = await (tx as typeof prisma).purchaseOrderItem.findMany({ where: { poId } });
      const allReceived    = refreshedItems.every((i) => i.receivedQty >= i.quantity);
      await (tx as typeof prisma).purchaseOrder.update({
        where: { id: poId },
        data:  { status: allReceived ? 'received' : 'partial_received' },
      });

      auditLog(receivedBy, 'CREATE', 'goods_receipts', gr.id, null, { grNumber: gr.grNumber, poId, status: gr.status });
      return gr;
    });
  }
}

export const purchaseOrderService = new PurchaseOrderService();
