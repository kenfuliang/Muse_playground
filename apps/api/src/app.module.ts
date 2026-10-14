import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { MesModule } from './mes/mes.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [AuthModule, MesModule],
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
