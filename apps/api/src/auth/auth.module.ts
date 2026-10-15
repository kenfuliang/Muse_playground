import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { PrismaService } from '../prisma/prisma.service.js';

// Phase 0 hardening: production 沒有 JWT_SECRET 就直接炸掉，不准用 dev fallback。
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is required in production');
}
if (!jwtSecret) {
  // eslint-disable-next-line no-console
  console.warn('[auth] JWT_SECRET not set — using dev fallback (DO NOT use in production)');
}

@Module({
  imports: [
    JwtModule.register({
      secret: jwtSecret ?? 'dev-secret-change-me',
      signOptions: { expiresIn: '12h' },
    }),
  ],
  controllers: [AuthController],
  providers: [PrismaService],
})
export class AuthModule {}
