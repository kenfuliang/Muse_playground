import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateInspectionInput,
  RecordResultInput,
  DisposeNgInput,
  InspectionStatus,
  NgDisposition,
  canTransitionInspection,
  canTransitionDisposition,
} from '@brainfactory/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthUser } from '../common/auth.js';

@Injectable()
export class QcService {
  constructor(private readonly prisma: PrismaService) {}

  private audit(actorId: string | undefined, action: string, entity: string, entityId: string, detail?: object) {
    return this.prisma.client.auditLog.create({
      data: { actorId, action, entity, entityId, detail: detail as object | undefined },
    });
  }

  /** 為工單建立檢驗單（首件 / 巡檢） */
  async createInspection(user: AuthUser, input: CreateInspectionInput) {
    const wo = await this.prisma.client.workOrder.findUnique({ where: { id: input.workOrderId } });
    if (!wo) throw new NotFoundException('work order not found');

    const inspection = await this.prisma.client.qcInspection.create({
      data: {
        workOrderId: input.workOrderId,
        type: input.type,
        inspectorId: user.sub,
        note: input.note,
      },
      include: { workOrder: true },
    });
    await this.audit(user.sub, 'qc.inspection.create', 'QcInspection', inspection.id, {
      workOrderId: input.workOrderId,
      type: input.type,
    });
    return inspection;
  }

  /** 待檢列表 */
  async pendingInspections() {
    return this.prisma.client.qcInspection.findMany({
      where: { status: InspectionStatus.PENDING },
      include: { workOrder: { include: { mold: true, machine: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** 錄檢驗結果；NG 自動建立 NgRecord（隔離） */
  async recordResult(user: AuthUser, id: string, input: RecordResultInput) {
    const inspection = await this.prisma.client.qcInspection.findUnique({
      where: { id },
      include: { ngRecords: true },
    });
    if (!inspection) throw new NotFoundException('inspection not found');
    if (!canTransitionInspection(inspection.status as InspectionStatus, input.status)) {
      throw new BadRequestException(`cannot transition ${inspection.status} -> ${input.status}`);
    }

    const result = await this.prisma.client.$transaction(async (tx) => {
      const updated = await tx.qcInspection.update({
        where: { id },
        data: { status: input.status, note: input.note },
        include: { workOrder: true },
      });

      let ngRecord = null;
      if (input.status === InspectionStatus.NG) {
        ngRecord = await tx.ngRecord.create({
          data: {
            inspectionId: id,
            qty: input.ngQty!,
            reason: input.ngReason!,
            disposition: NgDisposition.QUARANTINE,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: user.sub,
          action: `qc.inspection.${input.status.toLowerCase()}`,
          entity: 'QcInspection',
          entityId: id,
          detail: { status: input.status, ngQty: input.ngQty } as object,
        },
      });

      return { inspection: updated, ngRecord };
    });

    return result;
  }

  /** NG 處置：隔離 → 重工 / 報廢 / 特採 */
  async disposeNg(user: AuthUser, ngId: string, input: DisposeNgInput) {
    const ng = await this.prisma.client.ngRecord.findUnique({ where: { id: ngId } });
    if (!ng) throw new NotFoundException('ng record not found');
    if (!canTransitionDisposition(ng.disposition as NgDisposition, input.disposition)) {
      throw new BadRequestException(`cannot transition ${ng.disposition} -> ${input.disposition}`);
    }

    const updated = await this.prisma.client.ngRecord.update({
      where: { id: ngId },
      data: { disposition: input.disposition, note: input.note },
    });
    await this.audit(user.sub, 'qc.ng.dispose', 'NgRecord', ngId, {
      disposition: input.disposition,
    });
    return updated;
  }

  /** NG 列表（待處置優先） */
  async ngRecords() {
    return this.prisma.client.ngRecord.findMany({
      include: { inspection: { include: { workOrder: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
