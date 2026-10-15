-- Phase 0 hardening: idempotency key on work reports (additive, no data loss)
ALTER TABLE "WorkReport" ADD COLUMN "idempotencyKey" TEXT;
CREATE UNIQUE INDEX "WorkReport_idempotencyKey_key" ON "WorkReport"("idempotencyKey");
