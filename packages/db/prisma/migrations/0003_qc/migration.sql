-- Phase 1: QC inspections and NG records (additive)

-- Enums
CREATE TYPE "InspectionType" AS ENUM ('FIRST_ARTICLE', 'PATROL');
CREATE TYPE "InspectionStatus" AS ENUM ('PENDING', 'PASS', 'NG');
CREATE TYPE "NgDisposition" AS ENUM ('QUARANTINE', 'REWORK', 'SCRAP', 'CONCESSION');

-- QcInspection
CREATE TABLE "QcInspection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL DEFAULT 'demo',
    "workOrderId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "status" "InspectionStatus" NOT NULL DEFAULT 'PENDING',
    "inspectorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QcInspection_pkey" PRIMARY KEY ("id")
);

-- NgRecord
CREATE TABLE "NgRecord" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "disposition" "NgDisposition" NOT NULL DEFAULT 'QUARANTINE',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NgRecord_pkey" PRIMARY KEY ("id")
);

-- Foreign keys
ALTER TABLE "QcInspection" ADD CONSTRAINT "QcInspection_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "QcInspection" ADD CONSTRAINT "QcInspection_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NgRecord" ADD CONSTRAINT "NgRecord_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "QcInspection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
