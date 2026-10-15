import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { prisma } from '@brainfactory/db';
import { hashPin } from '@brainfactory/shared/pin';

/**
 * Seed demo data on boot if the database is empty.
 * Idempotent: uses upserts. Ensures the Render deployment is demo-ready
 * without manual steps.
 */
async function ensureSeeded() {
  const userCount = await prisma.user.count();
  if (userCount > 0) return; // already seeded

  console.log('[seed] empty database, seeding demo data...');
    const adminPin = await hashPin('0000');
    const workerPin = await hashPin('1234');

    const worker = await prisma.user.upsert({
      where: { badgeCode: 'BF-USER-w001' },
      update: {},
      create: { name: '阿明', badgeCode: 'BF-USER-w001', pin: workerPin, role: 'WORKER', lang: 'vi' },
    });
    await prisma.user.upsert({
      where: { badgeCode: 'BF-USER-admin' },
      update: {},
      create: { name: '生管', badgeCode: 'BF-USER-admin', pin: adminPin, role: 'ADMIN', lang: 'zh' },
    });
    const m1 = await prisma.machine.upsert({
      where: { tenantId_code: { tenantId: 'demo', code: 'M-01' } },
      update: {},
      create: { code: 'M-01', name: '1號機', tonnage: 160 },
    });
    await prisma.machine.upsert({
      where: { tenantId_code: { tenantId: 'demo', code: 'M-02' } },
      update: {},
      create: { code: 'M-02', name: '2號機', tonnage: 220 },
    });
    const moldA = await prisma.mold.upsert({
      where: { tenantId_code: { tenantId: 'demo', code: 'MT-8801-A' } },
      update: {},
      create: {
        code: 'MT-8801-A', name: '手機殼模具', cavityCount: 4,
        totalShots: 48200, lastMaintenanceShots: 45000, maintenanceIntervalShots: 5000,
      },
    });
    await prisma.mold.upsert({
      where: { tenantId_code: { tenantId: 'demo', code: 'MT-8802-B' } },
      update: {},
      create: {
        code: 'MT-8802-B', name: '按鍵模具', cavityCount: 8,
        totalShots: 12000, lastMaintenanceShots: 12000, maintenanceIntervalShots: null,
      },
    });
    const existing = await prisma.workOrder.findFirst({ where: { code: 'BF-WO-0001' } });
    if (!existing) {
      await prisma.workOrder.create({
        data: {
          code: 'BF-WO-0001', productName: '手機殼 (黑)', plannedQty: 20000,
          moldId: moldA.id, machineId: m1.id, assigneeId: worker.id,
          dueDate: new Date(Date.now() + 7 * 86400000),
        },
      });
    }
    console.log('[seed] done');
}

async function bootstrap() {
  // Run migrations are handled by the start command; seed if empty.
  await ensureSeeded();

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors();
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`api listening on :${port}`);
}
bootstrap();
