import { Module } from '@nestjs/common';
import { MastersController, WorkOrdersController } from './mes.controller.js';
import { MesService } from './mes.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/auth.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [WorkOrdersController, MastersController],
  providers: [MesService, PrismaService, JwtAuthGuard],
})
export class MesModule {}
