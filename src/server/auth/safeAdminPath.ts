/** Only same-site admin paths are accepted as a post-sign-in destination. */
export function safeAdminPath(value: string | null | undefined): string {
  const next = String(value || "");
  if (!next.startsWith("/admin/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) {
    return "/admin/dashboard";
  }
  if (next.startsWith("/admin/mfa") || next.startsWith("/admin/login")) return "/admin/dashboard";
  return next;
}
