-- Brainfactory MES v1 initial schema (enums, users, machines, molds, work orders, reports, maintenance, audit log)
CREATE TYPE "Role" AS ENUM ('ADMIN', 'WORKER');
CREATE TYPE "WorkOrderStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

CREATE TABLE "User" (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'longteam',
  name TEXT NOT NULL,
  "badgeCode" TEXT NOT NULL UNIQUE,
  pin TEXT,
  role "Role" NOT NULL DEFAULT 'WORKER',
  lang TEXT NOT NULL DEFAULT 'zh',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "Machine" (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'longteam',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tonnage INTEGER,
  status TEXT NOT NULL DEFAULT 'IDLE',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenantId", code)
);

CREATE TABLE "Mold" (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'longteam',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  "cavityCount" INTEGER NOT NULL DEFAULT 1,
  "totalShots" INTEGER NOT NULL DEFAULT 0,
  "lastMaintenanceShots" INTEGER NOT NULL DEFAULT 0,
  "maintenanceIntervalShots" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenantId", code)
);

CREATE TABLE "WorkOrder" (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'longteam',
  code TEXT NOT NULL,
  "productName" TEXT NOT NULL,
  "plannedQty" INTEGER NOT NULL,
  status "WorkOrderStatus" NOT NULL DEFAULT 'SCHEDULED',
  "dueDate" TIMESTAMPTZ,
  "moldId" TEXT NOT NULL REFERENCES "Mold"(id),
  "machineId" TEXT NOT NULL REFERENCES "Machine"(id),
  "assigneeId" TEXT REFERENCES "User"(id),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("tenantId", code)
);

CREATE TABLE "WorkReport" (
  id TEXT PRIMARY KEY,
  "workOrderId" TEXT NOT NULL REFERENCES "WorkOrder"(id),
  "reporterId" TEXT NOT NULL REFERENCES "User"(id),
  "shotCount" INTEGER NOT NULL,
  "goodQty" INTEGER NOT NULL,
  "ngQty" INTEGER NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "MoldMaintenance" (
  id TEXT PRIMARY KEY,
  "moldId" TEXT NOT NULL REFERENCES "Mold"(id),
  "shotsAtMaintenance" INTEGER NOT NULL,
  note TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE "AuditLog" (
  id TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL DEFAULT 'longteam',
  "actorId" TEXT REFERENCES "User"(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  detail JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
