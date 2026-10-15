import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CreateWorkOrderInput,
  ReportProductionInput,
  WorkOrderStatus,
  canTransition,
  isMaintenanceDue,
  makeWorkOrderCode,
} from '@brainfactory/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/auth.js';

@Injectable()
export class MesService {
  constructor(private readonly prisma: PrismaService) {}

  private audit(actorId: string | undefined, action: string, entity: string, entityId: string, detail?: object) {
    return this.prisma.client.auditLog.create({
      data: { actorId, action, entity, entityId, detail: detail as object | undefined },
    });
  }

  /** 生管開工單：選模具＋機台＋產品＋數量＋指派人（員工證條碼） */
  async createWorkOrder(user: AuthUser, input: CreateWorkOrderInput) {
    const seq = String(Date.now()).slice(-6);
    let assigneeId: string | undefined;
    if (input.assigneeBadge) {
      const assignee = await this.prisma.client.user.findUnique({
        where: { badgeCode: input.assigneeBadge },
      });
      if (!assignee) throw new BadRequestException('assignee badge not found');
      assigneeId = assignee.id;
    }
    const wo = await this.prisma.client.workOrder.create({
      data: {
        code: makeWorkOrderCode(seq),
        productName: input.productName,
        plannedQty: input.plannedQty,
        moldId: input.moldId,
        machineId: input.machineId,
        assigneeId,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
      include: { mold: true, machine: true, assignee: true },
    });
    await this.audit(user.sub, 'workorder.create', 'WorkOrder', wo.id, { code: wo.code });
    return wo;
  }

  /** 生管看全部工單（管理端工單列表） */
  async listWorkOrders() {
    return this.prisma.client.workOrder.findMany({
      include: { mold: true, machine: true, assignee: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** 工人的「我的工單」：指派給我的、未完工的單 */
  async myWorkOrders(user: AuthUser) {
    return this.prisma.client.workOrder.findMany({
      where: {
        assigneeId: user.sub,
        status: { in: [WorkOrderStatus.SCHEDULED, WorkOrderStatus.IN_PROGRESS] },
      },
      include: { mold: true, machine: true },
      orderBy: { dueDate: 'asc' },
    });
  }

  async getWorkOrder(user: AuthUser, id: string) {
    const wo = await this.prisma.client.workOrder.findUnique({
      where: { id },
      include: { mold: true, machine: true, assignee: true },
    });
    if (!wo) throw new NotFoundException('work order not found');
    this.assertCanOperate(user, wo.assigneeId);
    return wo;
  }

  /** 工人只能動自己的單；生管 (ADMIN) 可動全部。Phase 0 hardening. */
  private assertCanOperate(user: AuthUser, assigneeId: string | null) {
    if (user.role === 'ADMIN') return;
    if (assigneeId !== user.sub) {
      throw new ForbiddenException('not your work order');
    }
  }

  private async transition(user: AuthUser, id: string, to: WorkOrderStatus) {
    const wo = await this.getWorkOrder(user, id);
    if (!canTransition(wo.status as WorkOrderStatus, to)) {
      throw new BadRequestException(`cannot transition ${wo.status} -> ${to}`);
    }
    const updated = await this.prisma.client.workOrder.update({
      where: { id },
      data: { status: to },
      include: { mold: true, machine: true },
    });
    await this.audit(user.sub, `workorder.${to.toLowerCase()}`, 'WorkOrder', id, {});
    return updated;
  }

  start(user: AuthUser, id: string) {
    return this.transition(user, id, WorkOrderStatus.IN_PROGRESS);
  }

  complete(user: AuthUser, id: string) {
    return this.transition(user, id, WorkOrderStatus.COMPLETED);
  }

  /**
   * 報工（人工輸入 — 機台無連網）。
   * 每次報工累加模具模次；達到保養間隔就回傳 maintenanceDue 提醒。
   *
   * Phase 0 hardening:
   * - 整個報工包在一個 transaction 裡（report + 模次累加 + audit 原子執行）
   * - idempotencyKey 重複 → 直接回傳上次的結果，不重複計數
   */
  async report(user: AuthUser, id: string, input: ReportProductionInput) {
    const wo = await this.getWorkOrder(user, id);
    if (wo.status !== WorkOrderStatus.IN_PROGRESS) {
      throw new BadRequestException('work order is not in progress');
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.client.workReport.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) {
        const mold = await this.prisma.client.mold.findUniqueOrThrow({
          where: { id: wo.moldId },
        });
        return {
          report: existing,
          deduped: true as const,
          maintenanceDue: isMaintenanceDue({
            totalShots: mold.totalShots,
            lastMaintenanceShots: mold.lastMaintenanceShots,
            maintenanceIntervalShots: mold.maintenanceIntervalShots,
          }),
        };
      }
    }

    const { report, mold } = await this.prisma.client.$transaction(async (tx) => {
      const report = await tx.workReport.create({
        data: {
          workOrderId: id,
          reporterId: user.sub,
          shotCount: input.shotCount,
          goodQty: input.goodQty,
          ngQty: input.ngQty,
          idempotencyKey: input.idempotencyKey,
        },
      });
      const mold = await tx.mold.update({
        where: { id: wo.moldId },
        data: { totalShots: { increment: input.shotCount } },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'workorder.report',
          entity: 'WorkOrder',
          entityId: id,
          detail: {
            shotCount: input.shotCount,
            goodQty: input.goodQty,
            ngQty: input.ngQty,
          } as object,
        },
      });
      return { report, mold };
    });

    return {
      report,
      deduped: false as const,
      maintenanceDue: isMaintenanceDue({
        totalShots: mold.totalShots,
        lastMaintenanceShots: mold.lastMaintenanceShots,
        maintenanceIntervalShots: mold.maintenanceIntervalShots,
      }),
    };
  }

  // ---- master data (生管) ----

  listMachines() {
    return this.prisma.client.machine.findMany({ orderBy: { code: 'asc' } });
  }

  listMolds() {
    return this.prisma.client.mold.findMany({ orderBy: { code: 'asc' } });
  }

  async maintenanceDue() {
    const molds = await this.prisma.client.mold.findMany();
    return molds
      .filter((m) =>
        isMaintenanceDue({
          totalShots: m.totalShots,
          lastMaintenanceShots: m.lastMaintenanceShots,
          maintenanceIntervalShots: m.maintenanceIntervalShots,
        }),
      )
      .map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        totalShots: m.totalShots,
        sinceMaintenance: m.totalShots - m.lastMaintenanceShots,
        interval: m.maintenanceIntervalShots,
      }));
  }

  async recordMaintenance(user: AuthUser, moldId: string, note?: string) {
    const mold = await this.prisma.client.mold.findUnique({ where: { id: moldId } });
    if (!mold) throw new NotFoundException('mold not found');
    // Phase 0: 保養記錄 + 模次歸零原子執行
    const rec = await this.prisma.client.$transaction(async (tx) => {
      const rec = await tx.moldMaintenance.create({
        data: { moldId, shotsAtMaintenance: mold.totalShots, note },
      });
      await tx.mold.update({
        where: { id: moldId },
        data: { lastMaintenanceShots: mold.totalShots },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: 'mold.maintenance',
          entity: 'Mold',
          entityId: moldId,
          detail: { shots: mold.totalShots } as object,
        },
      });
      return rec;
    });
    return rec;
  }
}
