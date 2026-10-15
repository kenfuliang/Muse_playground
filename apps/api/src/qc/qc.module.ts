import { Module } from '@nestjs/common';
import { QcController } from './qc.controller.js';
import { QcService } from './qc.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../common/auth.js';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'dev-secret',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [QcController],
  providers: [QcService, PrismaService, JwtAuthGuard],
})
export class QcModule {}
