import { Prisma, PurchaseOrder } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { generateRunningNumber, buildPaginationMeta } from '../utils/runningNumber';
import { ReceiveGoodsDto, PoFilter } from '../types';
import { auditLog } from './auditLogService';

export interface CreateFromPRResult {
  purchaseOrders: PurchaseOrder[];
  newlyCreated:   PurchaseOrder[];
  fullyCovered:   boolean;
}

type Tx = Prisma.TransactionClient;

class PurchaseOrderService {

  /** ທຸກ PR item ມີ supplier ແລະ ຢູ່ໃນ PO item ແລ້ວ */
  async isPrFullyCovered(prId: number, tx: Tx): Promise<boolean> {
    const items = await (tx as typeof prisma).purchaseRequestItem.findMany({ where: { prId } });
    if (items.length === 0) return false;

    for (const item of items) {
      if (!item.supplierId) return false;
      const poItem = await (tx as typeof prisma).purchaseOrderItem.findFirst({
        where: { prItemId: item.id },
      });
      if (!poItem) return false;
    }
    return true;
  }

  // ─── Create PO(s) from approved PR (grouped by supplier) ───
  async createFromPR(
    prId:   number,
    userId: number,
    tx:     Tx,
  ): Promise<CreateFromPRResult> {
    const pr = await (tx as typeof prisma).purchaseRequest.findUniqueOrThrow({
      where:   { id: prId },
      include: { items: true },
    });

    const existingPos = await (tx as typeof prisma).purchaseOrder.findMany({ where: { prId } });
    const existingBySupplier = new Set(existingPos.map((p) => p.supplierId));
    const newlyCreated: PurchaseOrder[] = [];

    const grouped = new Map<number, typeof pr.items>();
    for (const item of pr.items) {
      const sid = item.supplierId ?? 0;
      if (!grouped.has(sid)) grouped.set(sid, []);
      grouped.get(sid)!.push(item);
    }

    for (const [supplierId, items] of grouped.entries()) {
      if (supplierId === 0) continue;
      if (existingBySupplier.has(supplierId)) continue;

      const itemsToAdd: typeof pr.items = [];
      for (const item of items) {
        const alreadyInPo = await (tx as typeof prisma).purchaseOrderItem.findFirst({
          where: { prItemId: item.id },
        });
        if (!alreadyInPo) itemsToAdd.push(item);
      }
      if (itemsToAdd.length === 0) continue;

      const poNumber = await generateRunningNumber('purchase_orders', 'PO', tx);
      const total      = itemsToAdd.reduce((s, i) => s + i.quantity * Number(i.unitPrice), 0);

      const po = await (tx as typeof prisma).purchaseOrder.create({
        data: {
          poNumber,
          prId,
          supplierId,
          createdBy:   userId,
          totalAmount: total,
          status:      'open',
          items: {
            create: itemsToAdd.map((item) => ({
              prItemId:  item.id,
              productId: item.productId,
              quantity:  item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });
      newlyCreated.push(po);
      existingBySupplier.add(supplierId);
    }

    const purchaseOrders = await (tx as typeof prisma).purchaseOrder.findMany({
      where: { prId },
      orderBy: { createdAt: 'asc' },
    });
    const fullyCovered = await this.isPrFullyCovered(prId, tx);

    return { purchaseOrders, newlyCreated, fullyCovered };
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

  // ─── Receive Goods (GR) — ຕ້ອງສົ່ງ PO (sent) ກ່ອນ ───────────
  async receiveGoods(poId: number, dto: ReceiveGoodsDto, receivedBy: number) {
    return prisma.$transaction(async (tx) => {
      const po = await (tx as typeof prisma).purchaseOrder.findUnique({
        where:   { id: poId },
        include: { items: true },
      });
      if (!po) throw AppError.notFound('ບໍ່ພົບ PO');
      if (po.status === 'received') throw AppError.badRequest('PO ຮັບຂອງຄົບແລ້ວ');
      if (!['sent', 'partial_received'].includes(po.status)) {
        throw AppError.badRequest('ຕ້ອງສົ່ງ PO ໃຫ້ Supplier ກ່ອນ (status: sent)');
      }

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

        await (tx as typeof prisma).purchaseOrderItem.update({
          where: { id: grItem.poItemId },
          data:  { receivedQty: { increment: grItem.receivedQty } },
        });
      }

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

  // ─── Cancel PO ─────────────────────────────────────────────
  async cancelPo(poId: number, userId: number) {
    const po = await prisma.purchaseOrder.findUnique({
      where:   { id: poId },
      include: { goodsReceipts: { select: { id: true } } },
    });
    if (!po) throw AppError.notFound('ບໍ່ພົບ PO');
    if (po.status === 'cancelled') throw AppError.badRequest('PO ຖືກຍົກເລີກແລ້ວ');
    if (po.status === 'received') throw AppError.badRequest('PO ຮັບຄົບແລ້ວ — ບໍ່ສາມາດຍົກເລີກ');
    if (po.goodsReceipts.length > 0) {
      throw AppError.badRequest('ມີ GR ແລ້ວ — ກະລຸນາຍົກເລີກ GR ກ່ອນ');
    }

    const updated = await prisma.purchaseOrder.update({
      where: { id: poId },
      data:  { status: 'cancelled' },
    });
    auditLog(userId, 'CANCEL', 'purchase_orders', poId, { status: po.status }, { status: 'cancelled' });
    return updated;
  }

  // ─── Cancel GR (reverse stock) ─────────────────────────────
  async cancelGoodsReceipt(grId: number, userId: number) {
    return prisma.$transaction(async (tx) => {
      const gr = await (tx as typeof prisma).goodsReceipt.findUnique({
        where:   { id: grId },
        include: { items: true, purchaseOrder: { include: { items: true } } },
      });
      if (!gr) throw AppError.notFound('ບໍ່ພົບ GR');
      if (gr.status === 'rejected') throw AppError.badRequest('GR ຖືກຍົກເລີກແລ້ວ');

      const poId = gr.poId;

      for (const grItem of gr.items) {
        const product = await (tx as typeof prisma).product.findUniqueOrThrow({
          where: { id: grItem.productId },
        });
        const before = product.currentStock;
        const after  = before - grItem.receivedQty;
        if (after < 0) {
          throw AppError.badRequest(
            `ບໍ່ສາມາດຍົກເລີກ GR: Stock ${product.nameLo} ບໍ່ພໍ (ມີ ${before}, ຕ້ອງຫັກ ${grItem.receivedQty})`,
          );
        }

        await (tx as typeof prisma).product.update({
          where: { id: grItem.productId },
          data:  { currentStock: after },
        });
        await (tx as typeof prisma).stockMovement.create({
          data: {
            productId:    grItem.productId,
            createdBy:    userId,
            movementType: 'adjust_out',
            quantity:     grItem.receivedQty,
            beforeQty:    before,
            afterQty:     after,
            refType:      'GR_CANCEL',
            refId:        grId,
            note:         `ຍົກເລີກ GR ${gr.grNumber}`,
          },
        });

        await (tx as typeof prisma).purchaseOrderItem.update({
          where: { id: grItem.poItemId },
          data:  { receivedQty: { decrement: grItem.receivedQty } },
        });
      }

      await (tx as typeof prisma).goodsReceipt.update({
        where: { id: grId },
        data:  { status: 'rejected', note: gr.note ? `${gr.note} [ຍົກເລີກ]` : '[ຍົກເລີກ]' },
      });

      const poItems = await (tx as typeof prisma).purchaseOrderItem.findMany({ where: { poId } });
      const hasReceived = poItems.some((i) => i.receivedQty > 0);
      const allReceived = poItems.every((i) => i.receivedQty >= i.quantity);
      const po = gr.purchaseOrder;

      let newPoStatus = po.status;
      if (!hasReceived) {
        newPoStatus = po.sentAt ? 'sent' : 'open';
      } else if (allReceived) {
        newPoStatus = 'received';
      } else {
        newPoStatus = 'partial_received';
      }

      if (newPoStatus !== po.status) {
        await (tx as typeof prisma).purchaseOrder.update({
          where: { id: poId },
          data:  { status: newPoStatus },
        });
      }

      auditLog(userId, 'CANCEL', 'goods_receipts', grId,
        { grNumber: gr.grNumber, status: 'completed' },
        { status: 'rejected' });

      return { cancelled: true, grId, poId };
    });
  }
}

export const purchaseOrderService = new PurchaseOrderService();
