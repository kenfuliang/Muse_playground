import { z } from 'zod';

/**
 * QC inspection for plastic injection molding.
 * 首件檢驗 (first article) → 量產巡檢 (patrol) → NG 處置.
 * Single source of truth: every layer derives from here.
 */

export const InspectionType = {
  FIRST_ARTICLE: 'FIRST_ARTICLE', // 首件 — 試模/開工後的第一件確認
  PATROL: 'PATROL', // 巡檢 — 量產中的定時抽檢
} as const;
export type InspectionType = (typeof InspectionType)[keyof typeof InspectionType];

export const InspectionStatus = {
  PENDING: 'PENDING', // 待檢
  PASS: 'PASS', // 合格
  NG: 'NG', // 不合格
} as const;
export type InspectionStatus = (typeof InspectionStatus)[keyof typeof InspectionStatus];

/** Allowed transitions. Anything else is rejected by the API. */
const INSPECTION_TRANSITIONS: Record<InspectionStatus, InspectionStatus[]> = {
  PENDING: ['PASS', 'NG'],
  PASS: [],
  NG: [],
};

export function canTransitionInspection(from: InspectionStatus, to: InspectionStatus): boolean {
  return INSPECTION_TRANSITIONS[from]?.includes(to) ?? false;
}

export const NgDisposition = {
  QUARANTINE: 'QUARANTINE', // 隔離 — 待判定
  REWORK: 'REWORK', // 重工
  SCRAP: 'SCRAP', // 報廢
  CONCESSION: 'CONCESSION', // 特採 — 讓步接收
} as const;
export type NgDisposition = (typeof NgDisposition)[keyof typeof NgDisposition];

/** NG 處置只能從隔離開始。 */
const DISPOSITION_TRANSITIONS: Record<NgDisposition, NgDisposition[]> = {
  QUARANTINE: ['REWORK', 'SCRAP', 'CONCESSION'],
  REWORK: [],
  SCRAP: [],
  CONCESSION: [],
};

export function canTransitionDisposition(from: NgDisposition, to: NgDisposition): boolean {
  return DISPOSITION_TRANSITIONS[from]?.includes(to) ?? false;
}

export const createInspectionSchema = z.object({
  workOrderId: z.string().min(1),
  type: z.enum([InspectionType.FIRST_ARTICLE, InspectionType.PATROL]),
  note: z.string().max(500).optional(),
});
export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;

export const recordResultSchema = z.object({
  status: z.enum([InspectionStatus.PASS, InspectionStatus.NG]),
  note: z.string().max(500).optional(),
  // NG 時必填
  ngQty: z.number().int().min(1).optional(),
  ngReason: z.string().max(500).optional(),
}).refine(
  (d) => d.status === InspectionStatus.PASS || (d.ngQty !== undefined && d.ngReason),
  { message: 'ngQty and ngReason required when NG' },
);
export type RecordResultInput = z.infer<typeof recordResultSchema>;

export const disposeNgSchema = z.object({
  disposition: z.enum([NgDisposition.REWORK, NgDisposition.SCRAP, NgDisposition.CONCESSION]),
  note: z.string().max(500).optional(),
});
export type DisposeNgInput = z.infer<typeof disposeNgSchema>;
