import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";
import { SESSION_COOKIE_NAME } from "../../../../server/auth/session";

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const token = cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) AuthService.logout(token);
  cookies.delete(SESSION_COOKIE_NAME, { path: "/" });
  return redirect("/admin/login");
};
