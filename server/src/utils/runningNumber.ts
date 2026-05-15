import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';

type TableWithCreatedAt =
  | 'purchase_requests'
  | 'purchase_orders'
  | 'goods_receipts'
  | 'payments';

/**
 * ສ້າງ Running Number: PREFIX-YYYY-NNNN (e.g. PR-2024-0001)
 * ໃຊ້ raw SQL ເພື່ອຄວາມປອດໄພໃນ concurrent requests
 */
export async function generateRunningNumber(
  table:  TableWithCreatedAt,
  prefix: string,
  tx?:    Prisma.TransactionClient,
): Promise<string> {
  const db   = tx ?? prisma;
  const year = new Date().getFullYear();

  const result = await (db as typeof prisma).$queryRawUnsafe<{ cnt: bigint }[]>(
    `SELECT COUNT(*)::bigint AS cnt FROM ${table} WHERE EXTRACT(YEAR FROM created_at) = $1`,
    year,
  );

  const next = (Number(result[0]?.cnt ?? 0) + 1).toString().padStart(4, '0');
  return `${prefix}-${year}-${next}`;
}

export function buildPaginationMeta(total: number, page: number, limit: number) {
  return {
    total,
    page,
    limit,
    totalPages:  Math.ceil(total / limit),
    hasNextPage: page * limit < total,
    hasPrevPage: page > 1,
  };
}
