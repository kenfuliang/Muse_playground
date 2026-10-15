import { z } from 'zod';

/**
 * Work order lifecycle for plastic injection molding.
 * 生管 (production control) schedules -> worker starts -> reports -> completes.
 * Single source of truth: every layer (API validation, UI labels) derives from here.
 */

export const WorkOrderStatus = {
  SCHEDULED: 'SCHEDULED', // 待生產 — 生管已排程
  IN_PROGRESS: 'IN_PROGRESS', // 生產中 — 工人已開工
  COMPLETED: 'COMPLETED', // 已完工
  CANCELLED: 'CANCELLED', // 已取消
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

/** Allowed transitions. Anything else is rejected by the API. */
const TRANSITIONS: Record<WorkOrderStatus, WorkOrderStatus[]> = {
  SCHEDULED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const createWorkOrderSchema = z.object({
  code: z.string().min(1).max(40),
  productName: z.string().min(1).max(120),
  moldId: z.string().min(1),
  machineId: z.string().min(1),
  plannedQty: z.number().int().positive(),
  assigneeBadge: z.string().min(1).optional(), // 員工證條碼，如 BF-USER-w001
  dueDate: z.string().datetime({ offset: true }).optional(),
});
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;

/**
 * A production report. Machines are NOT networked (per factory reality),
 * so shot/good/NG counts are entered manually by the worker on a tablet.
 */
export const reportProductionSchema = z.object({
  shotCount: z.number().int().min(0).describe('模次 — 本次生產的射出次數'),
  goodQty: z.number().int().min(0).describe('良品數'),
  ngQty: z.number().int().min(0).describe('不良數'),
  idempotencyKey: z.string().min(8).max(64).optional().describe('冪等鍵 — 重試/雙擊不重複計數'),
});
export type ReportProductionInput = z.infer<typeof reportProductionSchema>;

export const loginSchema = z
  .object({
    badgeCode: z.string().min(1).optional(),
    pin: z.string().regex(/^\d{4}$/).optional(),
  })
  .refine((d) => d.badgeCode || d.pin, { message: 'badgeCode or pin required' });
export type LoginInput = z.infer<typeof loginSchema>;
