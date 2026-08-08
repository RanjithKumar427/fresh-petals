// Service-role Supabase client — admin-only operations (inviting/creating
// users, listing all users) that never run as part of a normal signed-in
// request. Deliberately separate from supabaseServerClient.ts (which acts
// *as* the current visitor using the anon key + their session cookie) so
// the two trust levels can never be accidentally confused at a call site:
// importing from this file is a visible, searchable signal that
// service-role privileges are in play.
//
// Used today only by AuthService.inviteAdmin() (the programmatic
// equivalent of scripts/create-admin.mjs, now delegating identity
// creation to Supabase Auth) — never imported by a page, component, or
// anything reachable from the browser.
import { createClient } from "@supabase/supabase-js";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

export function getSupabaseAdminClient() {
  return createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
