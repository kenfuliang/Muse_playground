import { describe, expect, it } from 'vitest';
import { canTransition, reportProductionSchema } from './work-order.js';
import { classifyBarcode, makeBadgeCode, stripPrefix } from './barcode.js';
import { isMaintenanceDue, shotsSinceMaintenance, shotsUntilMaintenance } from './maintenance.js';
import { hashPin, verifyPin } from './pin.js';
import { t } from './i18n.js';
import {
  canTransitionInspection,
  canTransitionDisposition,
  createInspectionSchema,
  recordResultSchema,
  disposeNgSchema,
} from './qc.js';

describe('work order state machine', () => {
  it('allows SCHEDULED -> IN_PROGRESS -> COMPLETED', () => {
    expect(canTransition('SCHEDULED', 'IN_PROGRESS')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
  });
  it('rejects skipping states and going backwards', () => {
    expect(canTransition('SCHEDULED', 'COMPLETED')).toBe(false);
    expect(canTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
  });
  it('allows cancellation from open states only', () => {
    expect(canTransition('SCHEDULED', 'CANCELLED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    expect(canTransition('COMPLETED', 'CANCELLED')).toBe(false);
  });
});

describe('barcode', () => {
  it('classifies and strips prefixes', () => {
    const code = makeBadgeCode('u123');
    expect(classifyBarcode(code)).toBe('badge');
    expect(stripPrefix(code, 'badge')).toBe('u123');
    expect(stripPrefix(code, 'workorder')).toBeNull();
    expect(classifyBarcode('nope')).toBeNull();
  });
});

describe('mold maintenance', () => {
  it('computes shots since maintenance', () => {
    expect(shotsSinceMaintenance({ totalShots: 52000, lastMaintenanceShots: 50000, maintenanceIntervalShots: 5000 })).toBe(2000);
  });
  it('flags due maintenance', () => {
    expect(isMaintenanceDue({ totalShots: 55000, lastMaintenanceShots: 50000, maintenanceIntervalShots: 5000 })).toBe(true);
    expect(isMaintenanceDue({ totalShots: 52000, lastMaintenanceShots: 50000, maintenanceIntervalShots: 5000 })).toBe(false);
  });
  it('stays silent when no interval is configured', () => {
    const m = { totalShots: 999999, lastMaintenanceShots: 0, maintenanceIntervalShots: null };
    expect(isMaintenanceDue(m)).toBe(false);
    expect(shotsUntilMaintenance(m)).toBeNull();
  });
});

describe('i18n', () => {
  it('has Vietnamese for every key', () => {
    const zhKeys = JSON.stringify(Object.keys(t('zh')));
    const viKeys = JSON.stringify(Object.keys(t('vi')));
    expect(viKeys).toBe(zhKeys);
    expect(t('vi').job.start).toBe('Bắt đầu');
  });
});

describe('pin hashing (Phase 0)', () => {
  it('hashes and verifies with salt', async () => {
    const h1 = await hashPin('1234');
    const h2 = await hashPin('1234');
    expect(h1).not.toBe(h2); // salted — same PIN, different hash
    expect(h1.startsWith('scrypt$')).toBe(true);
    expect(await verifyPin(h1, '1234')).toBe('ok');
    expect(await verifyPin(h1, '0000')).toBe('no');
  });
  it('accepts legacy sha256 and flags it for upgrade', async () => {
    const { createHash } = await import('node:crypto');
    const legacy = createHash('sha256').update('1234').digest('hex');
    expect(await verifyPin(legacy, '1234')).toBe('legacy');
    expect(await verifyPin(legacy, '0000')).toBe('no');
  });
  it('rejects malformed hashes', async () => {
    expect(await verifyPin('scrypt$broken', '1234')).toBe('no');
    expect(await verifyPin('', '1234')).toBe('no');
  });
});

describe('report idempotency schema (Phase 0)', () => {
  it('accepts an optional idempotency key', () => {
    const r = reportProductionSchema.parse({ shotCount: 10, goodQty: 9, ngQty: 1 });
    expect(r.idempotencyKey).toBeUndefined();
    const r2 = reportProductionSchema.parse({
      shotCount: 10, goodQty: 9, ngQty: 1, idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(r2.idempotencyKey).toBe('550e8400-e29b-41d4-a716-446655440000');
  });
  it('rejects a too-short key', () => {
    expect(() =>
      reportProductionSchema.parse({ shotCount: 10, goodQty: 9, ngQty: 1, idempotencyKey: 'abc' }),
    ).toThrow();
  });
});

describe('QC inspection state machine', () => {
  it('allows PENDING -> PASS and PENDING -> NG', () => {
    expect(canTransitionInspection('PENDING', 'PASS')).toBe(true);
    expect(canTransitionInspection('PENDING', 'NG')).toBe(true);
  });
  it('rejects transitions from terminal states', () => {
    expect(canTransitionInspection('PASS', 'NG')).toBe(false);
    expect(canTransitionInspection('NG', 'PASS')).toBe(false);
    expect(canTransitionInspection('PASS', 'PENDING')).toBe(false);
  });
});

describe('NG disposition state machine', () => {
  it('allows QUARANTINE -> REWORK/SCRAP/CONCESSION', () => {
    expect(canTransitionDisposition('QUARANTINE', 'REWORK')).toBe(true);
    expect(canTransitionDisposition('QUARANTINE', 'SCRAP')).toBe(true);
    expect(canTransitionDisposition('QUARANTINE', 'CONCESSION')).toBe(true);
  });
  it('rejects transitions from terminal dispositions', () => {
    expect(canTransitionDisposition('REWORK', 'SCRAP')).toBe(false);
    expect(canTransitionDisposition('SCRAP', 'QUARANTINE')).toBe(false);
  });
});

describe('QC schemas', () => {
  it('accepts a valid inspection creation', () => {
    const r = createInspectionSchema.parse({ workOrderId: 'wo1', type: 'FIRST_ARTICLE' });
    expect(r.type).toBe('FIRST_ARTICLE');
  });
  it('accepts PASS without NG fields', () => {
    const r = recordResultSchema.parse({ status: 'PASS' });
    expect(r.status).toBe('PASS');
  });
  it('requires ngQty and ngReason when NG', () => {
    expect(() => recordResultSchema.parse({ status: 'NG' })).toThrow();
    const r = recordResultSchema.parse({ status: 'NG', ngQty: 5, ngReason: '缺料' });
    expect(r.ngQty).toBe(5);
  });
  it('accepts valid dispositions', () => {
    const r = disposeNgSchema.parse({ disposition: 'REWORK' });
    expect(r.disposition).toBe('REWORK');
  });
});

describe('QC i18n', () => {
  it('has zh and vi for all QC keys', () => {
    const zhQc = t('zh').qc;
    const viQc = t('vi').qc;
    for (const k of Object.keys(zhQc) as (keyof typeof zhQc)[]) {
      expect(viQc[k]).toBeTruthy();
    }
  });
});
