/**
 * Barcode formats. Code128 everywhere, one scanner for everything:
 *   掃證登入 → 掃單選工作 → 掃件報工
 *
 * Prefixes keep the namespaces apart so a badge can never be
 * mistaken for a work order and vice versa.
 */

export const BadgePrefix = 'BF-USER-';
export const WorkOrderPrefix = 'BF-WO-';
export const MoldPrefix = 'BF-MOLD-';

export function makeBadgeCode(userId: string): string {
  return `${BadgePrefix}${userId}`;
}

export function makeWorkOrderCode(seq: string): string {
  return `${WorkOrderPrefix}${seq}`;
}

/** Returns 'badge' | 'workorder' | 'mold' | null */
export function classifyBarcode(code: string): 'badge' | 'workorder' | 'mold' | null {
  if (code.startsWith(BadgePrefix)) return 'badge';
  if (code.startsWith(WorkOrderPrefix)) return 'workorder';
  if (code.startsWith(MoldPrefix)) return 'mold';
  return null;
}

/** Strip the prefix to get the raw id. Returns null when the prefix doesn't match. */
export function stripPrefix(code: string, kind: 'badge' | 'workorder' | 'mold'): string | null {
  const prefix =
    kind === 'badge' ? BadgePrefix : kind === 'workorder' ? WorkOrderPrefix : MoldPrefix;
  return code.startsWith(prefix) ? code.slice(prefix.length) : null;
}
