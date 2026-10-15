import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { MesService } from './mes.service.js';
import { WorkOrderStatus } from '@brainfactory/shared';
import type { AuthUser } from '../common/auth.js';

/**
 * Phase 0 hardening tests — backend behavior protection.
 * Prisma is mocked; these tests pin the permission / transaction / idempotency rules.
 */

const worker: AuthUser = { sub: 'u-worker', name: '阿明', role: 'WORKER', lang: 'vi' };
const otherWorker: AuthUser = { sub: 'u-other', name: '小華', role: 'WORKER', lang: 'zh' };
const admin: AuthUser = { sub: 'u-admin', name: '生管', role: 'ADMIN', lang: 'zh' };

function mockClient() {
  const tx = {
    workReport: { create: vi.fn() },
    mold: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  const client: any = {
    workOrder: { findUnique: vi.fn(), update: vi.fn() },
    workReport: { findUnique: vi.fn() },
    mold: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(async (fn: any) => fn(tx)),
    __tx: tx,
  };
  return client;
}

const wo = (over: any = {}) => ({
  id: 'wo-1',
  status: WorkOrderStatus.IN_PROGRESS,
  assigneeId: 'u-worker',
  moldId: 'mold-1',
  mold: { id: 'mold-1', totalShots: 100, lastMaintenanceShots: 0, maintenanceIntervalShots: 5000 },
  machine: { id: 'mc-1' },
  ...over,
});

describe('work order permissions (Phase 0)', () => {
  let client: ReturnType<typeof mockClient>;
  let svc: MesService;
  beforeEach(() => {
    client = mockClient();
    svc = new MesService({ client } as any);
  });

  it('worker cannot start another worker\'s order', async () => {
    client.workOrder.findUnique.mockResolvedValue(wo({ status: WorkOrderStatus.SCHEDULED }));
    await expect(svc.start(otherWorker, 'wo-1')).rejects.toThrow(ForbiddenException);
    expect(client.workOrder.update).not.toHaveBeenCalled();
  });

  it('worker can start their own order', async () => {
    client.workOrder.findUnique.mockResolvedValue(wo({ status: WorkOrderStatus.SCHEDULED }));
    client.workOrder.update.mockResolvedValue(wo({ status: WorkOrderStatus.IN_PROGRESS }));
    await svc.start(worker, 'wo-1');
    expect(client.workOrder.update).toHaveBeenCalled();
  });

  it('admin can operate any order', async () => {
    client.workOrder.findUnique.mockResolvedValue(wo({ status: WorkOrderStatus.SCHEDULED }));
    client.workOrder.update.mockResolvedValue(wo({ status: WorkOrderStatus.IN_PROGRESS }));
    await svc.start(admin, 'wo-1');
    expect(client.workOrder.update).toHaveBeenCalled();
  });

  it('worker cannot read another worker\'s order', async () => {
    client.workOrder.findUnique.mockResolvedValue(wo());
    await expect(svc.getWorkOrder(otherWorker, 'wo-1')).rejects.toThrow(ForbiddenException);
  });
});

describe('report idempotency + transaction (Phase 0)', () => {
  let client: ReturnType<typeof mockClient>;
  let svc: MesService;
  beforeEach(() => {
    client = mockClient();
    svc = new MesService({ client } as any);
  });

  it('replays the previous result when the idempotency key was seen', async () => {
    const prev = { id: 'r-old', shotCount: 10, goodQty: 9, ngQty: 1 };
    client.workOrder.findUnique.mockResolvedValue(wo());
    client.workReport.findUnique.mockResolvedValue(prev);
    client.mold.findUniqueOrThrow.mockResolvedValue({
      totalShots: 110, lastMaintenanceShots: 0, maintenanceIntervalShots: 5000,
    });
    const out: any = await svc.report(worker, 'wo-1', {
      shotCount: 10, goodQty: 9, ngQty: 1, idempotencyKey: 'key-123',
    });
    expect(out.deduped).toBe(true);
    expect(out.report).toEqual(prev);
    expect(client.$transaction).not.toHaveBeenCalled(); // no double counting
  });

  it('writes report + mold shots + audit atomically', async () => {
    client.workOrder.findUnique.mockResolvedValue(wo());
    client.workReport.findUnique.mockResolvedValue(null);
    const created = { id: 'r-new' };
    const moldAfter = { totalShots: 120, lastMaintenanceShots: 0, maintenanceIntervalShots: 5000 };
    client.__tx.workReport.create.mockResolvedValue(created);
    client.__tx.mold.update.mockResolvedValue(moldAfter);
    const out: any = await svc.report(worker, 'wo-1', { shotCount: 20, goodQty: 18, ngQty: 2 });
    expect(out.deduped).toBe(false);
    expect(client.$transaction).toHaveBeenCalledTimes(1);
    expect(client.__tx.workReport.create).toHaveBeenCalled();
    expect(client.__tx.mold.update).toHaveBeenCalledWith({
      where: { id: 'mold-1' },
      data: { totalShots: { increment: 20 } },
    });
    expect(client.__tx.auditLog.create).toHaveBeenCalled();
  });

  it('rejects reports on non-progress orders', async () => {
    client.workOrder.findUnique.mockResolvedValue(wo({ status: WorkOrderStatus.SCHEDULED }));
    await expect(
      svc.report(worker, 'wo-1', { shotCount: 1, goodQty: 1, ngQty: 0 }),
    ).rejects.toThrow(BadRequestException);
  });
});
