import { AuditAction } from '@prisma/client';
import { prisma } from '../config/prisma';

// ─── Safe JSON serialise (ຮອງຮັບ Decimal, Date, BigInt) ────
const toJson = (val: unknown) => {
  if (val == null) return undefined;
  try {
    return JSON.parse(JSON.stringify(val, (_k, v) =>
      typeof v === 'bigint' ? Number(v) : v,
    ));
  } catch {
    return undefined;
  }
};

export const auditLog = (
  userId:    number,
  action:    AuditAction,
  tableName: string,
  recordId:  number,
  oldValues?: unknown,
  newValues?: unknown,
  ipAddress?: string,
): void => {
  // fire-and-forget — ບໍ່ block main operation
  prisma.auditLog.create({
    data: {
      userId,
      action,
      tableName,
      recordId,
      oldValues: toJson(oldValues),
      newValues: toJson(newValues),
      ipAddress: ipAddress ?? null,
    },
  }).catch((err) => {
    console.error('[AuditLog] Failed:', tableName, action, recordId, err?.message ?? err);
  });
};

export const getIp = (req: { ip?: string; headers: Record<string, string | string[] | undefined> }): string =>
  (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.ip ?? '';
