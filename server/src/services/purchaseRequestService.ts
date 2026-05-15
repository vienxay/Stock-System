import { PrStatus, RoleCode, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { generateRunningNumber, buildPaginationMeta } from '../utils/runningNumber';
import { CreatePrDto, ApproveDto, PrFilter } from '../types';
import { purchaseOrderService } from './purchaseOrderService';
import { auditLog } from './auditLogService';

const isAdmin = (role: RoleCode) => role === RoleCode.admin;

class PurchaseRequestService {

  // ─── Create ────────────────────────────────────────────────
  async create(dto: CreatePrDto, requesterId: number) {
    return prisma.$transaction(async (tx) => {
      const prNumber = await generateRunningNumber('purchase_requests', 'PR', tx);

      // ກວດ products ທັງໝົດ
      const productIds = dto.items.map((i) => i.product_id);
      const products   = await tx.product.findMany({ where: { id: { in: productIds }, isActive: true } });
      if (products.length !== productIds.length) {
        throw AppError.badRequest('ມີສິນຄ້າທີ່ບໍ່ພົບໃນລະບົບ');
      }

      const productMap = new Map(products.map((p) => [p.id, p]));
      let totalAmount  = 0;
      const itemsData  = dto.items.map((item) => {
        const product  = productMap.get(item.product_id)!;
        const price    = item.unit_price ?? Number(product.standardPrice);
        totalAmount   += item.quantity * price;
        return {
          productId:  item.product_id,
          supplierId: item.supplier_id ?? null,
          quantity:   item.quantity,
          unitPrice:  price,
          note:       item.note ?? null,
        };
      });

      return tx.purchaseRequest.create({
        data: {
          prNumber,
          requesterId,
          department:  dto.department ?? null,
          purpose:     dto.purpose ?? null,
          priority:    dto.priority ?? 'normal',
          requiredDate: dto.required_date ? new Date(dto.required_date) : null,
          note:        dto.note ?? null,
          totalAmount,
          items:       { create: itemsData },
        },
        include: { items: { include: { product: true } }, requester: { select: { fullName: true } } },
      });
    });
  }

  // ─── Submit (draft → finance_review) ───────────────────────
  async submit(prId: number, userId: number, userRole: RoleCode) {
    const pr = await this.findOneOrThrow(prId);
    if (!isAdmin(userRole) && pr.requesterId !== userId)
      throw AppError.forbidden('ທ່ານບໍ່ແມ່ນເຈົ້າຂອງ PR');
    if (pr.status !== 'draft')    throw AppError.badRequest('PR ນີ້ບໍ່ສາມາດສົ່ງໄດ້ (status: ' + pr.status + ')');

    // ຫາ Finance ແລະ MD users ຄົນທຳອິດ
    const [financeUser, mdUser] = await Promise.all([
      prisma.user.findFirst({ where: { role: { code: RoleCode.finance }, isActive: true } }),
      prisma.user.findFirst({ where: { role: { code: RoleCode.md },      isActive: true } }),
    ]);
    if (!financeUser) throw AppError.badRequest('ບໍ່ພົບ Finance user ໃນລະບົບ');
    if (!mdUser)      throw AppError.badRequest('ບໍ່ພົບ MD user ໃນລະບົບ');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.purchaseRequest.update({
        where: { id: prId },
        data:  { status: PrStatus.finance_review },
      });

      await tx.prApproval.createMany({
        data: [
          { prId, approverId: financeUser.id, level: 1, decision: 'pending' },
          { prId, approverId: mdUser.id,      level: 2, decision: 'pending' },
        ],
      });

      await tx.notification.create({
        data: {
          userId:  financeUser.id,
          type:    'pr_submitted',
          title:   `PR ໃໝ່ລໍຖ້າກວດສອບ: ${pr.prNumber}`,
          message: `ຈຳນວນ ${pr.totalAmount} LAK`,
          refType: 'PR',
          refId:   prId,
        },
      });
      return updated;
    });
  }

  // ─── Approve / Reject ──────────────────────────────────────
  async handleApproval(prId: number, approverId: number, callerRole: RoleCode, dto: ApproveDto) {
    const isAdmin = callerRole === RoleCode.admin;
    return prisma.$transaction(async (tx) => {
      const pr = await this.findOneOrThrow(prId, tx);

      let approval = await tx.prApproval.findFirst({
        where: { prId, approverId, decision: 'pending' },
      });

      // ─── Role-based fallback — finance / md / admin ────────
      if (!approval) {
        const level = pr.status === 'finance_review' ? 1
                    : pr.status === 'md_review'      ? 2
                    : null;

        const roleCanApprove =
          (level === 1 && callerRole === RoleCode.finance) ||
          (level === 2 && callerRole === RoleCode.md)      ||
          isAdmin;

        if (!level)           throw AppError.badRequest(`PR ນີ້ບໍ່ສາມາດອະນຸມັດໄດ້ (status: ${pr.status})`);
        if (!roleCanApprove)  throw AppError.forbidden('ທ່ານບໍ່ມີສິດອະນຸມັດ PR ນີ້');

        // ຊອກ pending approval ຂອງລະດັບນີ້ (ໂດຍ user ໃດກໍໄດ້ໃນ role)
        approval = await tx.prApproval.findFirst({ where: { prId, level, decision: 'pending' } });
        if (!approval) {
          // ບໍ່ມີ record → ສ້າງໃໝ່ (edge case: admin ຫຼື PR ເກົ່າ)
          approval = await tx.prApproval.create({
            data: { prId, approverId, level, decision: 'pending' },
          });
        } else {
          // ອັບເດດ approverId ໃຫ້ເປັນ user ທີ່ຕົວຈິງ approve
          await tx.prApproval.update({ where: { id: approval.id }, data: { approverId } });
          approval = { ...approval, approverId };
        }
      }

      if (!approval) throw AppError.forbidden('ທ່ານບໍ່ມີສິດອະນຸມັດ ຫຼື ໄດ້ອະນຸມັດແລ້ວ');

      await tx.prApproval.update({
        where: { id: approval.id },
        data:  { decision: dto.decision, comment: dto.comment ?? null, actedAt: new Date() },
      });

      let newStatus: PrStatus;
      if (dto.decision === 'rejected') {
        newStatus = approval.level === 1 ? PrStatus.finance_rejected : PrStatus.md_rejected;
        await tx.purchaseRequest.update({ where: { id: prId }, data: { status: newStatus } });
        await tx.notification.create({
          data: {
            userId:  pr.requesterId,
            type:    'pr_rejected',
            title:   `PR ${pr.prNumber} ຖືກປະຕິເສດ`,
            message: dto.comment ?? '',
            refType: 'PR', refId: prId,
          },
        });
      } else {
        // approved
        if (approval.level === 1) {
          newStatus = PrStatus.md_review;
          await tx.purchaseRequest.update({ where: { id: prId }, data: { status: newStatus } });
          // ແຈ້ງ MD
          const mdUser = await tx.user.findFirst({ where: { role: { code: RoleCode.md }, isActive: true } });
          if (mdUser) {
            await tx.notification.create({
              data: { userId: mdUser.id, type: 'pr_md_review', title: `PR ${pr.prNumber} ລໍ MD ອະນຸມັດ`, refType: 'PR', refId: prId },
            });
          }
        } else {
          // Level 2 (MD) approved → auto-create PO
          await tx.purchaseRequest.update({ where: { id: prId }, data: { status: PrStatus.md_approved } });
          const po = await purchaseOrderService.createFromPR(prId, approverId, tx);

          if (po) {
            // ມີ supplier ຢ່າງໜ້ອຍ 1 item → PO ສ້າງສຳເລັດ
            await tx.purchaseRequest.update({ where: { id: prId }, data: { status: PrStatus.po_created } });
            auditLog(approverId, 'CREATE', 'purchase_orders', po.id, null, { poNumber: po.poNumber, status: po.status });
            await tx.notification.create({
              data: {
                userId:  pr.requesterId,
                type:    'pr_approved_po_created',
                title:   `PR ${pr.prNumber} ອະນຸມັດ — PO ${po.poNumber} ສ້າງແລ້ວ`,
                refType: 'PO', refId: po.id,
              },
            });
            // ແຈ້ງ purchasing ໃຫ້ດຳເນີນການ PO
            const purchasingUsers = await tx.user.findMany({
              where: { role: { code: RoleCode.purchasing }, isActive: true },
            });
            if (purchasingUsers.length > 0) {
              await tx.notification.createMany({
                data: purchasingUsers.map((u) => ({
                  userId:  u.id,
                  type:    'po_created',
                  title:   `PO ໃໝ່ ${po.poNumber} ລໍການດຳເນີນການ`,
                  message: `ກະລຸນາຢືນຢັນ ແລະ ສົ່ງໃຫ້ Supplier`,
                  refType: 'PO',
                  refId:   po.id,
                })),
              });
            }
          } else {
            // ທຸກ items ບໍ່ມີ supplier → ຄ້າງທີ່ md_approved, ລໍ purchasing assign supplier
            await tx.notification.create({
              data: {
                userId:  pr.requesterId,
                type:    'pr_approved_no_supplier',
                title:   `PR ${pr.prNumber} ອະນຸມັດແລ້ວ — ກະລຸນາລະບຸ Supplier ໃຫ້ທຸກລາຍການ`,
                message: 'ຝ່າຍຈັດຊື້ຈະຕ້ອງລະບຸ Supplier ກ່ອນທີ່ຈະສ້າງ PO',
                refType: 'PR', refId: prId,
              },
            });
          }
        }
      }
      return pr;
    });
  }

  // ─── Cancel ────────────────────────────────────────────────
  async cancel(prId: number, userId: number, userRole: RoleCode) {
    const pr = await this.findOneOrThrow(prId);
    if (!isAdmin(userRole) && pr.requesterId !== userId)
      throw AppError.forbidden('ທ່ານບໍ່ແມ່ນເຈົ້າຂອງ PR ນີ້');
    if (['po_created', 'cancelled'].includes(pr.status))
      throw AppError.badRequest('ບໍ່ສາມາດຍົກເລີກ PR ນີ້ໄດ້');
    return prisma.purchaseRequest.update({ where: { id: prId }, data: { status: PrStatus.cancelled } });
  }

  // ─── List ──────────────────────────────────────────────────
  async findAll(filter: PrFilter, callerRole: RoleCode, callerId: number) {
    const page  = Number(filter.page  ?? 1);
    const limit = Number(filter.limit ?? 20);

    const where: Record<string, unknown> = {};
    // ຜູ້ໃຊ້ທົ່ວໄປ ເຫັນໄດ້ຕ່ຳ PR ຂອງຕົນ
    if (callerRole === RoleCode.user) where.requesterId = callerId;
    else if (filter.requester_id)    where.requesterId = Number(filter.requester_id);

    if (filter.status)    where.status = filter.status;
    if (filter.from_date || filter.to_date) {
      where.createdAt = {
        ...(filter.from_date && { gte: new Date(filter.from_date) }),
        ...(filter.to_date   && { lte: new Date(filter.to_date + 'T23:59:59') }),
      };
    }

    const [rows, total] = await prisma.$transaction([
      prisma.purchaseRequest.findMany({
        where,
        include: {
          requester: { select: { fullName: true, department: true } },
          approvals: { include: { approver: { select: { fullName: true } } } },
          _count:    { select: { items: true } },
        },
        orderBy: { createdAt: 'desc' },
        take:    limit,
        skip:    (page - 1) * limit,
      }),
      prisma.purchaseRequest.count({ where }),
    ]);

    return { rows, meta: buildPaginationMeta(total, page, limit) };
  }

  async findById(id: number) {
    const pr = await prisma.purchaseRequest.findUnique({
      where:   { id },
      include: {
        requester:    { select: { fullName: true, department: true } },
        items:        { include: { product: { include: { unit: true } }, supplier: true } },
        approvals:    { include: { approver: { select: { fullName: true } } }, orderBy: { level: 'asc' } },
        purchaseOrder: { select: { id: true, poNumber: true, status: true } },
      },
    });
    if (!pr) throw AppError.notFound('ບໍ່ພົບ PR');
    return pr;
  }

  private async findOneOrThrow(id: number, tx?: Prisma.TransactionClient) {
    const db = tx ?? prisma;
    const pr = await db.purchaseRequest.findUnique({ where: { id } });
    if (!pr) throw AppError.notFound('ບໍ່ພົບ PR');
    return pr;
  }
}

export const purchaseRequestService = new PurchaseRequestService();
