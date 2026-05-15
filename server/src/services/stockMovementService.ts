import { MovementType, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/AppError';
import { buildPaginationMeta } from '../utils/runningNumber';
import { IssueOutDto, AdjustStockDto, StockMovementFilter } from '../types';

const movementInclude = {
  product: { select: { nameLo: true, code: true, unit: { select: { nameLo: true } } } },
  creator: { select: { fullName: true } },
};

class StockMovementService {

  // ─── ເບີກສິນຄ້າອອກ ────────────────────────────────────────
  async issueOut(dto: IssueOutDto, userId: number) {
    const movement = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.product_id } });
      if (!product)          throw AppError.notFound('ບໍ່ພົບສິນຄ້າ');
      if (!product.isActive) throw AppError.badRequest('ສິນຄ້ານີ້ຖືກປິດໃຊ້ງານ');
      if (product.currentStock < dto.quantity) {
        throw AppError.badRequest(
          `Stock ບໍ່ພໍ: ມີ ${product.currentStock} ຫົວໜ່ວຍ ແຕ່ຕ້ອງການ ${dto.quantity}`,
        );
      }

      const before = product.currentStock;
      const after  = before - dto.quantity;

      await tx.product.update({ where: { id: dto.product_id }, data: { currentStock: after } });

      // ─── ແຈ້ງເຕືອນ stock ນ້ອຍ ───────────────────────────────
      if (after <= product.minStock) {
        const stockUsers = await tx.user.findMany({
          where: { role: { code: 'stock' }, isActive: true },
        });
        if (stockUsers.length > 0) {
          await tx.notification.createMany({
            data: stockUsers.map((u) => ({
              userId:  u.id,
              type:    'low_stock',
              title:   `⚠ Stock ນ້ອຍ: ${product.nameLo}`,
              message: `Stock ເຫຼືອ ${after} ໜ່ວຍ (ໜ້ອຍສຸດ: ${product.minStock})`,
              refType: 'PRODUCT',
              refId:   product.id,
            })),
          });
        }
      }

      return tx.stockMovement.create({
        data: {
          productId:    dto.product_id,
          createdBy:    userId,
          movementType: MovementType.issue_out,
          quantity:     dto.quantity,
          beforeQty:    before,
          afterQty:     after,
          refType:      dto.ref_type ?? null,
          refId:        dto.ref_id  ?? null,
          note:         dto.note    ?? null,
        },
        include: movementInclude,
      });
    });
    return movement;
  }

  // ─── ປັບຍອດ Stock ──────────────────────────────────────────
  async adjust(dto: AdjustStockDto, userId: number) {
    return prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.product_id } });
      if (!product) throw AppError.notFound('ບໍ່ພົບສິນຄ້າ');

      const before = product.currentStock;
      let   after: number;

      if (dto.movement_type === 'adjust_in') {
        after = before + dto.quantity;
      } else {
        if (before < dto.quantity) {
          throw AppError.badRequest(
            `Stock ບໍ່ພໍສຳລັບການປັບຫຼຸດ: ມີ ${before} ຫົວໜ່ວຍ ແຕ່ຕ້ອງການຫຼຸດ ${dto.quantity}`,
          );
        }
        after = before - dto.quantity;
      }

      await tx.product.update({ where: { id: dto.product_id }, data: { currentStock: after } });

      return tx.stockMovement.create({
        data: {
          productId:    dto.product_id,
          createdBy:    userId,
          movementType: dto.movement_type as MovementType,
          quantity:     dto.quantity,
          beforeQty:    before,
          afterQty:     after,
          note:         dto.note ?? null,
        },
        include: movementInclude,
      });
    });
  }

  // ─── ດູ History ທັງໝົດ ──────────────────────────────────────
  async findAll(filter: StockMovementFilter) {
    const page  = Number(filter.page  ?? 1);
    const limit = Number(filter.limit ?? 20);

    const where: Prisma.StockMovementWhereInput = {};
    if (filter.product_id)    where.productId    = Number(filter.product_id);
    if (filter.movement_type) where.movementType = filter.movement_type as MovementType;
    if (filter.from_date || filter.to_date) {
      where.createdAt = {
        ...(filter.from_date && { gte: new Date(filter.from_date) }),
        ...(filter.to_date   && { lte: new Date(filter.to_date + 'T23:59:59') }),
      };
    }

    const [rows, total] = await prisma.$transaction([
      prisma.stockMovement.findMany({
        where,
        include:  movementInclude,
        orderBy:  { createdAt: 'desc' },
        take:     limit,
        skip:     (page - 1) * limit,
      }),
      prisma.stockMovement.count({ where }),
    ]);

    return { rows, meta: buildPaginationMeta(total, page, limit) };
  }

  // ─── ດູ History ຂອງສິນຄ້າໜຶ່ງ ──────────────────────────────
  async findByProduct(productId: number, filter: StockMovementFilter) {
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw AppError.notFound('ບໍ່ພົບສິນຄ້າ');

    const data = await this.findAll({ ...filter, product_id: String(productId) });

    return {
      product: {
        id:           product.id,
        code:         product.code,
        nameLo:       product.nameLo,
        currentStock: product.currentStock,
        minStock:     product.minStock,
      },
      ...data,
    };
  }
}

export const stockMovementService = new StockMovementService();
