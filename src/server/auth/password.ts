// Password hashing via Node's built-in crypto.scrypt — deliberately no new
// dependency (bcrypt/argon2) for a single-admin v1.
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

/** Returns "salt:hash", both hex-encoded, ready to store in admin_users.password_hash. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const candidate = scryptSync(password, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, "hex");

  if (candidate.length !== expected.length) return false;
  return timingSafeEqual(candidate, expected);
}
