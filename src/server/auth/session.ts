import { randomBytes } from "node:crypto";

export const SESSION_COOKIE_NAME = "fp_admin_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_TTL_MS).toISOString();
}

export function isExpired(expiresAtIso: string): boolean {
  return new Date(expiresAtIso).getTime() < Date.now();
}
