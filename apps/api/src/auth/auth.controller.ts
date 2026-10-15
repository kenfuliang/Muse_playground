import { Body, Controller, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { LoginInput, classifyBarcode, loginSchema } from '@brainfactory/shared';
import { hashPin, verifyPin } from '@brainfactory/shared/pin';
import { PrismaService } from '../prisma/prisma.service.js';
import { ZodValidationPipe } from '../common/zod-pipe.js';

/** 失敗計數：key = badgeOrIp，value = timestamps(ms)。Phase 0 hardening. */
const failures = new Map<string, number[]>();
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;

function checkRateLimit(key: string) {
  const now = Date.now();
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_ATTEMPTS) {
    throw new HttpException('too many attempts, try later', HttpStatus.TOO_MANY_REQUESTS);
  }
  recent.push(now);
  failures.set(key, recent);
}

/**
 * Badge scan = login. PIN = fallback. No passwords on the factory floor.
 *
 * Phase 0 hardening:
 * - PIN 存 scrypt 加鹽哈希（node 內建，不引入新依賴）；舊 sha256 登入成功時自動升級
 * - 登入限流：同 badge/IP 5 次/分鐘
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  @Post('login')
  async login(@Req() req: Request, @Body(new ZodValidationPipe(loginSchema)) body: LoginInput) {
    const key = `${body.badgeCode ?? body.pin ?? 'unknown'}@${req.ip}`;
    checkRateLimit(key);

    let user = null;
    let legacyUpgrade: string | null = null;
    if (body.badgeCode) {
      // A badge scan must actually be a badge — never accept a work-order code here.
      if (classifyBarcode(body.badgeCode) !== 'badge') {
        return { ok: false as const, error: 'not_a_badge' };
      }
      user = await this.prisma.client.user.findUnique({
        where: { badgeCode: body.badgeCode },
      });
    } else if (body.pin) {
      // PIN 登入：先找有 PIN 的使用者再驗證（避免雜湊比對計時洩漏哪個 badge 存在 — badge 掃碼本來就公開，這裡重點是限流）
      const candidates = await this.prisma.client.user.findMany({
        where: { pin: { not: null } },
      });
      for (const c of candidates) {
        const r = await verifyPin(c.pin!, body.pin);
        if (r !== 'no') {
          user = c;
          if (r === 'legacy') legacyUpgrade = c.id;
          break;
        }
      }
    }
    if (!user) return { ok: false as const, error: 'unknown_user' };

    // 舊 sha256 升級成 scrypt（一次寫入，之後走新格式）
    if (legacyUpgrade && body.pin) {
      const upgraded = await hashPin(body.pin);
      await this.prisma.client.user.update({
        where: { id: legacyUpgrade },
        data: { pin: upgraded },
      });
    }

    const payload = { sub: user.id, name: user.name, role: user.role, lang: user.lang };
    const token = await this.jwt.signAsync(payload);
    return { ok: true as const, token, user: payload };
  }
}
