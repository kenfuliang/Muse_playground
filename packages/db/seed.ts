/**
 * Seed data for the factory trial. Demo machines, molds, users and
 * one scheduled work order so every screen has something to show.
 *
 * Run: npm run db:seed -w packages/db   (needs DATABASE_URL)
 */
import { PrismaClient } from '@prisma/client';
import { createHash } from 'node:crypto';

const prisma = new PrismaClient();
const pinHash = (pin: string) => createHash('sha256').update(pin).digest('hex');

async function main() {
  // --- users ---
  const admin = await prisma.user.upsert({
    where: { badgeCode: 'BF-USER-admin' },
    update: {},
    create: {
      name: '生管',
      badgeCode: 'BF-USER-admin',
      pin: pinHash('0000'),
      role: 'ADMIN',
      lang: 'zh',
    },
  });

  const worker = await prisma.user.upsert({
    where: { badgeCode: 'BF-USER-w001' },
    update: {},
    create: {
      name: '阿明',
      badgeCode: 'BF-USER-w001',
      pin: pinHash('1234'),
      role: 'WORKER',
      lang: 'vi',
    },
  });

  // --- machines ---
  const m1 = await prisma.machine.upsert({
    where: { tenantId_code: { tenantId: 'longteam', code: 'M-01' } },
    update: {},
    create: { code: 'M-01', name: '1號機', tonnage: 160 },
  });
  const m2 = await prisma.machine.upsert({
    where: { tenantId_code: { tenantId: 'longteam', code: 'M-02' } },
    update: {},
    create: { code: 'M-02', name: '2號機', tonnage: 220 },
  });

  // --- molds ---
  const moldA = await prisma.mold.upsert({
    where: { tenantId_code: { tenantId: 'longteam', code: 'MT-8801-A' } },
    update: {},
    create: {
      code: 'MT-8801-A',
      name: '手機殼模具',
      cavityCount: 4,
      totalShots: 48200,
      lastMaintenanceShots: 45000,
      maintenanceIntervalShots: 5000, // 5000 模次保養一次（試用值，可調）
    },
  });
  await prisma.mold.upsert({
    where: { tenantId_code: { tenantId: 'longteam', code: 'MT-8802-B' } },
    update: {},
    create: {
      code: 'MT-8802-B',
      name: '按鍵模具',
      cavityCount: 8,
      totalShots: 12000,
      lastMaintenanceShots: 12000,
      maintenanceIntervalShots: null, // 尚未設定保養週期
    },
  });

  // --- a scheduled work order for the trial ---
  const existing = await prisma.workOrder.findFirst({
    where: { code: 'BF-WO-0001' },
  });
  if (!existing) {
    await prisma.workOrder.create({
      data: {
        code: 'BF-WO-0001',
        productName: '手機殼 (黑)',
        plannedQty: 20000,
        moldId: moldA.id,
        machineId: m1.id,
        assigneeId: worker.id,
        dueDate: new Date(Date.now() + 7 * 86400000),
      },
    });
  }

  console.log('seed ok:', { admin: admin.badgeCode, worker: worker.badgeCode, pin: '1234' });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
