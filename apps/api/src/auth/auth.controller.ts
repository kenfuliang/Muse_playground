import { Body, Controller, Post } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import { LoginInput, classifyBarcode, loginSchema, stripPrefix } from '@brainfactory/shared';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';

/**
 * Badge scan = login. PIN = fallback. No passwords on the factory floor.
 * NOTE (v1 trial): PINs are sha256-hashed, JWT secret from env.
 * Harden before any real deployment (rate limiting, rotation).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  async login(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    let user = null;
    if (body.badgeCode) {
      // A badge scan must actually be a badge — never accept a work-order code here.
      if (classifyBarcode(body.badgeCode) !== 'badge') {
        return { ok: false as const, error: 'not_a_badge' };
      }
      user = await this.prisma.client.user.findUnique({
        where: { badgeCode: body.badgeCode },
      });
    } else if (body.pin) {
      const hash = createHash('sha256').update(body.pin).digest('hex');
      user = await this.prisma.client.user.findFirst({ where: { pin: hash } });
    }
    if (!user) return { ok: false as const, error: 'unknown_user' };

    const payload = { sub: user.id, name: user.name, role: user.role, lang: user.lang };
    const token = await this.jwt.signAsync(payload);
    return { ok: true as const, token, user: payload };
  }
}
