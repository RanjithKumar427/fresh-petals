import type { APIRoute } from "astro";
import { AuthService } from "../../../../server/services/AuthService";

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  await AuthService.logout(request, cookies);
  return redirect("/admin/login");
};
