import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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
    return wo;
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
   */
  async report(user: AuthUser, id: string, input: ReportProductionInput) {
    const wo = await this.getWorkOrder(user, id);
    if (wo.status !== WorkOrderStatus.IN_PROGRESS) {
      throw new BadRequestException('work order is not in progress');
    }
    const report = await this.prisma.client.workReport.create({
      data: {
        workOrderId: id,
        reporterId: user.sub,
        shotCount: input.shotCount,
        goodQty: input.goodQty,
        ngQty: input.ngQty,
      },
    });
    const mold = await this.prisma.client.mold.update({
      where: { id: wo.moldId },
      data: { totalShots: { increment: input.shotCount } },
    });
    await this.audit(user.sub, 'workorder.report', 'WorkOrder', id, {
      shotCount: input.shotCount,
      goodQty: input.goodQty,
      ngQty: input.ngQty,
    });
    return {
      report,
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
    const rec = await this.prisma.client.moldMaintenance.create({
      data: { moldId, shotsAtMaintenance: mold.totalShots, note },
    });
    await this.prisma.client.mold.update({
      where: { id: moldId },
      data: { lastMaintenanceShots: mold.totalShots },
    });
    await this.audit(user.sub, 'mold.maintenance', 'Mold', moldId, { shots: mold.totalShots });
    return rec;
  }
}
