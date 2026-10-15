import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { QcService } from './qc.service.js';
import { InspectionStatus, NgDisposition } from '@brainfactory/shared';
import type { AuthUser } from '../common/auth.js';

/**
 * Phase 1 QC tests — backend behavior protection.
 * Prisma is mocked; these tests pin the state machine / transaction rules.
 */

const admin: AuthUser = { sub: 'u-admin', name: '生管', role: 'ADMIN', lang: 'zh' };

function mockClient() {
  const tx = {
    qcInspection: { update: vi.fn() },
    ngRecord: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const client: any = {
    workOrder: { findUnique: vi.fn() },
    qcInspection: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    ngRecord: { findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
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
      client.qcInspection.create.mockResolvedValue({ id: 'qc-1', status: 'PENDING' });

      const r = await svc.createInspection(admin, { workOrderId: 'wo-1', type: 'FIRST_ARTICLE' });

      expect(r.id).toBe('qc-1');
      expect(client.qcInspection.create).toHaveBeenCalled();
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
    it('records PASS in a transaction', async () => {
      const inspection = { id: 'qc-1', status: 'PENDING', ngRecords: [] };
      client.qcInspection.findUnique.mockResolvedValue(inspection);
      client.__tx.qcInspection.update.mockResolvedValue({ ...inspection, status: 'PASS' });

      const r = await svc.recordResult(admin, 'qc-1', { status: InspectionStatus.PASS });

      expect(r.inspection.status).toBe('PASS');
      expect(r.ngRecord).toBeNull();
      expect(client.__tx.ngRecord.create).not.toHaveBeenCalled();
    });

    it('creates NgRecord automatically when NG', async () => {
      const inspection = { id: 'qc-1', status: 'PENDING', ngRecords: [] };
      client.qcInspection.findUnique.mockResolvedValue(inspection);
      client.__tx.qcInspection.update.mockResolvedValue({ ...inspection, status: 'NG' });
      client.__tx.ngRecord.create.mockResolvedValue({ id: 'ng-1', disposition: 'QUARANTINE' });

      const r = await svc.recordResult(admin, 'qc-1', {
        status: InspectionStatus.NG,
        ngQty: 10,
        ngReason: '缺料',
      });

      expect(r.ngRecord).not.toBeNull();
      expect(client.__tx.ngRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          inspectionId: 'qc-1',
          qty: 10,
          reason: '缺料',
          disposition: NgDisposition.QUARANTINE,
        }),
      });
    });

    it('rejects recording result twice', async () => {
      client.qcInspection.findUnique.mockResolvedValue({ id: 'qc-1', status: 'PASS' });
      await expect(
        svc.recordResult(admin, 'qc-1', { status: InspectionStatus.PASS }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('disposeNg', () => {
    it('transitions QUARANTINE -> REWORK', async () => {
      client.ngRecord.findUnique.mockResolvedValue({ id: 'ng-1', disposition: 'QUARANTINE' });
      client.ngRecord.update.mockResolvedValue({ id: 'ng-1', disposition: 'REWORK' });

      const r = await svc.disposeNg(admin, 'ng-1', { disposition: NgDisposition.REWORK });

      expect(r.disposition).toBe('REWORK');
    });

    it('rejects invalid disposition transition', async () => {
      client.ngRecord.findUnique.mockResolvedValue({ id: 'ng-1', disposition: 'REWORK' });
      await expect(
        svc.disposeNg(admin, 'ng-1', { disposition: NgDisposition.SCRAP }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
