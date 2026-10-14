import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { prisma } from '@brainfactory/db';

/**
 * Prisma connects lazily on first query — the app boots (and /api/health
 * answers) even when the database is unreachable. Queries fail loudly
 * at call time instead.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client = prisma;
  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
