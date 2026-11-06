// What happens to a password-reset email on staging, without delivering one: a synthetic
// approved admin at a reserved example.com address (RFC 2606, undeliverable) asks for a
// reset through the deployed Worker, then directly through Supabase Auth. Shows whether
// Supabase accepted the send (recovery_sent_at) or refused it, and that the Worker's
// answer is the same either way. Removes the identity; checks every table afterwards.
//
//   node scripts/staging/email-probe.mjs --env=<staging env file> [--db-port=6543] [--out=<results.json>]
import { parseArgs, startRun, snapshot, compareSnapshots, syntheticIdentities, FORM, form, WORKER } from "./test-lib.mjs";
import { STAGING_ORIGIN } from "./guard.mjs";

const args = parseArgs();
const run = startRun({ envFile: args.env });
const { check, log, q, service, w, guarded, values, finish } = run;
const ids = syntheticIdentities({ q, service, check, log });
const before = await snapshot(q);
try {
  const admin = await ids.create({ approved: true, label: "email-probe" });
  const sent = async () => (await q(`select recovery_sent_at from auth.users where id=$1`, [admin.id]))[0].recovery_sent_at;

  const viaWorker = await w("POST", "/api/admin/auth/forgot-password", { headers: FORM, body: form({ email: admin.email }) });
  const unknown = await w("POST", "/api/admin/auth/forgot-password", { headers: FORM, body: form({ email: `fp-staging-test-nobody-${Date.now()}@example.com` }) });
  check("worker", "reset request for an admin and for an unknown address get the same answer (no enumeration)", viaWorker.status === unknown.status && viaWorker.location === unknown.location && /sent=1/.test(viaWorker.location), `${viaWorker.status} ${viaWorker.location} | ${unknown.status} ${unknown.location}`);
  const afterWorker = await sent();
  log(`after the Worker request, recovery_sent_at is ${afterWorker ? "set" : "empty"}`);

  const direct = await guarded(`${STAGING_ORIGIN}/auth/v1/recover`, { method: "POST", headers: { apikey: values.SUPABASE_ANON_KEY, "content-type": "application/json" }, body: JSON.stringify({ email: admin.email }) });
  const body = await direct.json().catch(() => ({}));
  const code = body.error_code ?? body.code ?? body.msg ?? "";
  const afterDirect = await sent();
  check("email", "Supabase's answer to a reset email for a non-team address is recorded", true, `HTTP ${direct.status} ${String(code).slice(0, 80)}; recovery_sent_at ${afterDirect ? "set" : "empty"}`);
  // Supabase refuses reserved example.com addresses before its team-member rule for the default
  // email service can apply, so this proves only that nothing was sent, not why delivery fails.
  check("email", "nothing was sent: Supabase refused the address and recorded no recovery email", direct.status >= 400 && !afterDirect && !afterWorker, `HTTP ${direct.status} ${String(code)}`);
} finally {
  await ids.cleanup();
  compareSnapshots(check, before, await snapshot(q));
}
process.exit(finish({ out: args.out }) ? 1 : 0);
