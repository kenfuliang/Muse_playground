import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { AuthController } from './auth.controller.js';

/** Rate-limit is module-level state; use a unique badge per test to isolate. */
let n = 0;

describe('login rate limiting (Phase 0)', () => {
  it('allows 5 attempts then rejects with 429', async () => {
    const badge = `BF-USER-rate-${Date.now()}-${n++}`;
    const prisma: any = {
      client: { user: { findUnique: vi.fn().mockResolvedValue(null) } },
    };
    const jwt: any = { signAsync: vi.fn() };
    const ctl = new AuthController(prisma, jwt);
    const req: any = { ip: '10.0.0.1' };

    for (let i = 0; i < 5; i++) {
      const r: any = await ctl.login(req, { badgeCode: badge });
      expect(r.ok).toBe(false);
    }
    await expect(ctl.login(req, { badgeCode: badge })).rejects.toThrow(HttpException);
    try {
      await ctl.login(req, { badgeCode: badge });
    } catch (e: any) {
      expect(e.getStatus()).toBe(429);
    }
  });

  it('rejects non-badge codes at the badge endpoint', async () => {
    const prisma: any = { client: { user: { findUnique: vi.fn() } } };
    const jwt: any = { signAsync: vi.fn() };
    const ctl = new AuthController(prisma, jwt);
    const r: any = await ctl.login({ ip: '10.0.0.2' } as any, { badgeCode: 'BF-WO-123456' });
    expect(r).toEqual({ ok: false, error: 'not_a_badge' });
    expect(prisma.client.user.findUnique).not.toHaveBeenCalled();
  });
});

describe('PIN login (Phase 0)', () => {
  it('verifies scrypt PIN and issues a token', async () => {
    const { hashPin } = await import('@brainfactory/shared/pin');
    const stored = await hashPin('1234');
    const prisma: any = {
      client: {
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'u1', pin: stored, name: '阿明', role: 'WORKER', lang: 'vi' },
          ]),
          update: vi.fn(),
        },
      },
    };
    const jwt: any = { signAsync: vi.fn().mockResolvedValue('tok') };
    const ctl = new AuthController(prisma, jwt);
    const r: any = await ctl.login({ ip: '10.0.0.3' } as any, { pin: '1234' });
    expect(r.ok).toBe(true);
    expect(r.token).toBe('tok');
  });

  it('upgrades legacy sha256 PINs on successful login', async () => {
    const { createHash } = await import('node:crypto');
    const legacy = createHash('sha256').update('1234').digest('hex');
    const prisma: any = {
      client: {
        user: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'u1', pin: legacy, name: '阿明', role: 'WORKER', lang: 'vi' },
          ]),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    };
    const jwt: any = { signAsync: vi.fn().mockResolvedValue('tok') };
    const ctl = new AuthController(prisma, jwt);
    const r: any = await ctl.login({ ip: '10.0.0.4' } as any, { pin: '1234' });
    expect(r.ok).toBe(true);
    expect(prisma.client.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { pin: expect.stringMatching(/^scrypt\$/) },
    });
  });
});
