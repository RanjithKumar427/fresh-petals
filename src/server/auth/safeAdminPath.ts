/** Only same-site admin paths are accepted as a post-sign-in destination. */
export function safeAdminPath(value: string | null | undefined): string {
  const next = String(value || "");
  if (!next.startsWith("/admin/") || next.startsWith("//") || next.includes("\\") || /[\r\n]/.test(next)) {
    return "/admin/dashboard";
  }
  // Judge the path a browser would actually visit, after resolving ".." and encoded forms.
  const resolved = new URL(next, "https://admin.invalid");
  if (resolved.origin !== "https://admin.invalid" || !resolved.pathname.startsWith("/admin/")) return "/admin/dashboard";
  if (resolved.pathname.startsWith("/admin/mfa") || resolved.pathname.startsWith("/admin/login")) return "/admin/dashboard";
  return next;
}
