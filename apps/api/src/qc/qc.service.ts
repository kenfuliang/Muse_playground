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
import { randomUUID } from 'crypto';

/**
 * QC service using raw SQL for QcInspection/NgRecord.
 * This avoids requiring `prisma generate` to succeed on Render
 * (the Prisma CDN download is unreliable in the build environment).
 * Existing models (WorkOrder, User) still use the typed client.
 */

type QcInspectionRow = {
  id: string;
  tenantId: string;
  workOrderId: string;
  type: string;
  status: string;
  inspectorId: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type NgRecordRow = {
  id: string;
  inspectionId: string;
  qty: number;
  reason: string;
  disposition: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class QcService {
  constructor(private readonly prisma: PrismaService) {}

  private get db(): any {
    return (this.prisma as any).client ?? (this.prisma as any).prisma;
  }

  private audit(actorId: string | undefined, action: string, entity: string, entityId: string, detail?: object) {
    return this.db.auditLog.create({
      data: { actorId, action, entity, entityId, detail: detail as object | undefined },
    });
  }

  /** 為工單建立檢驗單（首件 / 巡檢） */
  async createInspection(user: AuthUser, input: CreateInspectionInput) {
    const wo = await this.db.workOrder.findUnique({ where: { id: input.workOrderId } });
    if (!wo) throw new NotFoundException('work order not found');

    const id = randomUUID();
    await this.db.$executeRaw`
      INSERT INTO "QcInspection" ("id", "tenantId", "workOrderId", "type", "status", "inspectorId", "note", "createdAt", "updatedAt")
      VALUES (${id}, 'demo', ${input.workOrderId}, ${input.type}::"InspectionType", 'PENDING'::"InspectionStatus", ${user.sub}, ${input.note ?? null}, NOW(), NOW())
    `;
    const rows = await this.db.$queryRaw<QcInspectionRow[]>`
      SELECT * FROM "QcInspection" WHERE "id" = ${id}
    `;
    await this.audit(user.sub, 'qc.inspection.create', 'QcInspection', id, {
      workOrderId: input.workOrderId,
      type: input.type,
    });
    return { ...rows[0], workOrder: wo };
  }

  /** 待檢列表 */
  async pendingInspections() {
    const rows = await this.db.$queryRaw<any[]>`
      SELECT qi.*, wo."code" as "workOrderCode", wo."productName",
             m."code" as "moldCode", mc."code" as "machineCode"
      FROM "QcInspection" qi
      JOIN "WorkOrder" wo ON wo."id" = qi."workOrderId"
      LEFT JOIN "Mold" m ON m."id" = wo."moldId"
      LEFT JOIN "Machine" mc ON mc."id" = wo."machineId"
      WHERE qi."status" = 'PENDING'::"InspectionStatus"
      ORDER BY qi."createdAt" ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      status: r.status,
      note: r.note,
      createdAt: r.createdAt,
      workOrder: {
        id: r.workOrderId,
        code: r.workOrderCode,
        productName: r.productName,
        mold: r.moldCode ? { code: r.moldCode } : null,
        machine: r.machineCode ? { code: r.machineCode } : null,
      },
    }));
  }

  /** 錄檢驗結果；NG 自動建立 NgRecord（隔離） */
  async recordResult(user: AuthUser, id: string, input: RecordResultInput) {
    const rows = await this.db.$queryRaw<QcInspectionRow[]>`
      SELECT * FROM "QcInspection" WHERE "id" = ${id}
    `;
    const inspection = rows[0];
    if (!inspection) throw new NotFoundException('inspection not found');
    if (!canTransitionInspection(inspection.status as InspectionStatus, input.status)) {
      throw new BadRequestException(`cannot transition ${inspection.status} -> ${input.status}`);
    }

    await this.db.$executeRaw`
      UPDATE "QcInspection" SET "status" = ${input.status}::"InspectionStatus", "note" = ${input.note ?? null}, "updatedAt" = NOW()
      WHERE "id" = ${id}
    `;

    let ngRecord = null;
    if (input.status === InspectionStatus.NG) {
      const ngId = randomUUID();
      await this.db.$executeRaw`
        INSERT INTO "NgRecord" ("id", "inspectionId", "qty", "reason", "disposition", "createdAt", "updatedAt")
        VALUES (${ngId}, ${id}, ${input.ngQty!}, ${input.ngReason!}, 'QUARANTINE'::"NgDisposition", NOW(), NOW())
      `;
      const ngRows = await this.db.$queryRaw<NgRecordRow[]>`
        SELECT * FROM "NgRecord" WHERE "id" = ${ngId}
      `;
      ngRecord = ngRows[0];
    }

    await this.audit(user.sub, `qc.inspection.${input.status.toLowerCase()}`, 'QcInspection', id, {
      status: input.status,
      ngQty: input.ngQty,
    });

    const updated = await this.db.$queryRaw<QcInspectionRow[]>`
      SELECT * FROM "QcInspection" WHERE "id" = ${id}
    `;
    return { inspection: updated[0], ngRecord };
  }

  /** NG 處置：隔離 → 重工 / 報廢 / 特採 */
  async disposeNg(user: AuthUser, ngId: string, input: DisposeNgInput) {
    const rows = await this.db.$queryRaw<NgRecordRow[]>`
      SELECT * FROM "NgRecord" WHERE "id" = ${ngId}
    `;
    const ng = rows[0];
    if (!ng) throw new NotFoundException('ng record not found');
    if (!canTransitionDisposition(ng.disposition as NgDisposition, input.disposition)) {
      throw new BadRequestException(`cannot transition ${ng.disposition} -> ${input.disposition}`);
    }

    await this.db.$executeRaw`
      UPDATE "NgRecord" SET "disposition" = ${input.disposition}::"NgDisposition", "note" = ${input.note ?? null}, "updatedAt" = NOW()
      WHERE "id" = ${ngId}
    `;
    await this.audit(user.sub, 'qc.ng.dispose', 'NgRecord', ngId, {
      disposition: input.disposition,
    });

    const updated = await this.db.$queryRaw<NgRecordRow[]>`
      SELECT * FROM "NgRecord" WHERE "id" = ${ngId}
    `;
    return updated[0];
  }

  /** NG 列表 */
  async ngRecords() {
    const rows = await this.db.$queryRaw<any[]>`
      SELECT nr.*, qi."workOrderId", wo."code" as "workOrderCode"
      FROM "NgRecord" nr
      JOIN "QcInspection" qi ON qi."id" = nr."inspectionId"
      JOIN "WorkOrder" wo ON wo."id" = qi."workOrderId"
      ORDER BY nr."createdAt" DESC
    `;
    return rows.map((r) => ({
      id: r.id,
      qty: r.qty,
      reason: r.reason,
      disposition: r.disposition,
      note: r.note,
      createdAt: r.createdAt,
      inspection: {
        id: r.inspectionId,
        workOrder: { id: r.workOrderId, code: r.workOrderCode },
      },
    }));
  }
}
