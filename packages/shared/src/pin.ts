import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

/**
 * PIN hashing for the factory floor (no passwords, badge + 4-digit PIN only).
 *
 * Phase 0 hardening: salted scrypt via node built-ins — no new dependency.
 * Stored format: `scrypt$<salt-hex>$<hash-hex>`.
 * Legacy v1 trial format was unsalted sha256 hex; verifyPin() still accepts it
 * so existing trial DBs keep working, and callers should re-hash on success.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(pin, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export type PinCheck = 'ok' | 'legacy' | 'no';

export async function verifyPin(stored: string, pin: string): Promise<PinCheck> {
  if (stored.startsWith('scrypt$')) {
    const [, salt, hashHex] = stored.split('$');
    if (!salt || !hashHex) return 'no';
    const hash = (await scryptAsync(pin, salt, 32)) as Buffer;
    const expected = Buffer.from(hashHex, 'hex');
    return hash.length === expected.length && timingSafeEqual(hash, expected) ? 'ok' : 'no';
  }
  const hash = createHash('sha256').update(pin).digest();
  const expected = Buffer.from(stored, 'hex');
  return hash.length === expected.length && timingSafeEqual(hash, expected) ? 'legacy' : 'no';
}
