import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { QcService } from './qc.service.js';
import { InspectionStatus, NgDisposition } from '@brainfactory/shared';
import type { AuthUser } from '../common/auth.js';

/**
 * Phase 1 QC tests — backend behavior protection.
 * Uses raw SQL ($queryRaw/$executeRaw); Prisma is mocked.
 */

const admin: AuthUser = { sub: 'u-admin', name: '生管', role: 'ADMIN', lang: 'zh' };

function mockClient() {
  const client: any = {
    workOrder: { findUnique: vi.fn() },
    auditLog: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return client;
}

describe('QcService', () => {
  let client: any;
  let svc: QcService;

  beforeEach(() => {
    client = mockClient();
    svc = new QcService({ client } as any);
  });

  describe('createInspection', () => {
    it('creates an inspection for a work order', async () => {
      client.workOrder.findUnique.mockResolvedValue({ id: 'wo-1' });
      client.$executeRaw.mockResolvedValue(1);
      client.$queryRaw.mockResolvedValue([{ id: 'qc-1', status: 'PENDING' }]);

      const r = await svc.createInspection(admin, { workOrderId: 'wo-1', type: 'FIRST_ARTICLE' });

      expect(r.id).toBe('qc-1');
      expect(client.$executeRaw).toHaveBeenCalled();
      expect(client.auditLog.create).toHaveBeenCalled();
    });

    it('throws when work order not found', async () => {
      client.workOrder.findUnique.mockResolvedValue(null);
      await expect(
        svc.createInspection(admin, { workOrderId: 'nope', type: 'PATROL' }),
      ).rejects.toThrow();
    });
  });

  describe('recordResult', () => {
    it('records PASS', async () => {
      client.$queryRaw
        .mockResolvedValueOnce([{ id: 'qc-1', status: 'PENDING' }])
        .mockResolvedValueOnce([{ id: 'qc-1', status: 'PASS' }]);
      client.$executeRaw.mockResolvedValue(1);

      const r = await svc.recordResult(admin, 'qc-1', { status: InspectionStatus.PASS });

      expect(r.inspection.status).toBe('PASS');
      expect(r.ngRecord).toBeNull();
    });

    it('creates NgRecord automatically when NG', async () => {
      client.$queryRaw
        .mockResolvedValueOnce([{ id: 'qc-1', status: 'PENDING' }])
        .mockResolvedValueOnce([{ id: 'ng-1', disposition: 'QUARANTINE' }])
        .mockResolvedValueOnce([{ id: 'qc-1', status: 'NG' }]);
      client.$executeRaw.mockResolvedValue(1);

      const r = await svc.recordResult(admin, 'qc-1', {
        status: InspectionStatus.NG,
        ngQty: 10,
        ngReason: '缺料',
      });

      expect(r.ngRecord).not.toBeNull();
      expect(r.ngRecord.disposition).toBe('QUARANTINE');
    });

    it('rejects recording result twice', async () => {
      client.$queryRaw.mockResolvedValue([{ id: 'qc-1', status: 'PASS' }]);
      await expect(
        svc.recordResult(admin, 'qc-1', { status: InspectionStatus.PASS }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disposeNg', () => {
    it('transitions QUARANTINE -> REWORK', async () => {
      client.$queryRaw
        .mockResolvedValueOnce([{ id: 'ng-1', disposition: 'QUARANTINE' }])
        .mockResolvedValueOnce([{ id: 'ng-1', disposition: 'REWORK' }]);
      client.$executeRaw.mockResolvedValue(1);

      const r = await svc.disposeNg(admin, 'ng-1', { disposition: NgDisposition.REWORK });

      expect(r.disposition).toBe('REWORK');
    });

    it('rejects invalid disposition transition', async () => {
      client.$queryRaw.mockResolvedValue([{ id: 'ng-1', disposition: 'REWORK' }]);
      await expect(
        svc.disposeNg(admin, 'ng-1', { disposition: NgDisposition.SCRAP }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
