import { describe, expect, it } from 'vitest';
import { canTransition } from './work-order.js';
import { classifyBarcode, makeBadgeCode, stripPrefix } from './barcode.js';
import { isMaintenanceDue, shotsSinceMaintenance, shotsUntilMaintenance } from './maintenance.js';
import { t } from './i18n.js';

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
