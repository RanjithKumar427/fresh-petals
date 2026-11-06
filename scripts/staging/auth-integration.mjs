#!/usr/bin/env node
// Staging Auth integration run against the deployed staging Worker. No browser, no email.
//
//   node scripts/staging/auth-integration.mjs --env=<staging env file> [--out=<results.json>] [--require=<commit>] [--db-port=6543]
//
// Creates, and removes in `finally` on success or failure:
//   - one synthetic approved administrator (admin_users row) with a test-only TOTP factor;
//   - one synthetic identity with no admin profile at all, later with its own test-only factor.
// Both use reserved example.com addresses with email_confirm, so Auth sends no email. Passwords,
// TOTP secrets, codes and tokens are generated locally and held in memory only. It never signs in,
// resets or changes any pre-existing account, and checks afterwards that every public table,
// every Storage object and every pre-existing Auth user is unchanged.
//
// It refuses to start unless the served x-fp-source-revision is a local commit containing
// --require (default c1307af, the reset cookie fix), and needs 1 GB of free memory.
import { STAGING_ORIGIN } from "./guard.mjs";
import {
  WORKER, Z, FORM, JSON_HEADERS, ADMIN_PAGES, ADMIN_READS, ADMIN_WRITES, form, sleep, random, scrub, parseArgs, startRun, servedRevision,
  removes, describeCookie, sessionCookieNames, sessionCookieAttributesOk, freshCode, snapshot, compareSnapshots, syntheticIdentities, enrolFactor, jarClient,
} from "./test-lib.mjs";

const args = parseArgs();
const REQUIRED = args.require || "c1307afc48f2a5125cb3738eefc3e94adaa506c7";
const REDIRECT = `${WORKER}/admin/reset-password`;
const run = startRun({ envFile: args.env });
const { log, check, due, guarded, q, service, w, sdkFor, values } = run;

const rev = await servedRevision(guarded, REQUIRED);
if (!rev.ok) { console.log(`STOP: the served revision is not a local commit containing ${REQUIRED.slice(0, 7)}; nothing was created`); process.exit(2); }
log("deployed revision", rev.served.slice(0, 7), "contains", REQUIRED.slice(0, 7));
const before = await snapshot(q);
log("baseline", JSON.stringify({ tables: Object.keys(before.tables).length, objects: before.storage.n, auth: before.auth }));

const ids = syntheticIdentities({ q, service, check, log });
const aalOf = async (jar) => { const { data, error } = await sdkFor(jar).auth.mfa.getAuthenticatorAssuranceLevel(); return error ? { error: error.status } : { current: data.currentLevel, next: data.nextLevel }; };

/** Password-only (or recovery-only) access: every page to the code page, every read and write 403. */
async function firstFactorOnly(jar) {
  let pages = 0, reads = 0, writes = 0; const bad = [];
  for (const p of ADMIN_PAGES) { const r = await w("GET", p, { jar, store: false }); if (r.status === 302 && r.to === "/admin/mfa" && /no-store/.test(r.cache)) pages++; else bad.push(`${p.replace(Z, "Z")} ${r.status} ${r.to}`); }
  for (const p of ADMIN_READS) { const r = await w("GET", p, { jar, store: false }); if (r.status === 403 && r.text.length < 100) reads++; else bad.push(`${p.replace(Z, "Z")} ${r.status}`); }
  for (const [m, p, h, d] of ADMIN_WRITES) { const r = await w(m, p, { jar, headers: h, body: d, store: false }); if (r.status === 403) writes++; else bad.push(`${m} ${p.replace(Z, "Z")} ${r.status}`); }
  return { ok: !bad.length, evidence: `pages ${pages}/${ADMIN_PAGES.length} to code page, API reads ${reads}/${ADMIN_READS.length} 403, writes ${writes}/${ADMIN_WRITES.length} 403${bad.length ? " | " + bad.join("; ") : ""}` };
}

/** Recovery link → the Worker's bridge, as the reset page's script does it. Returns the jar and the link's tokens. */
async function recoverySession(user) {
  const link = await service.auth.admin.generateLink({ type: "recovery", email: user.email, options: { redirectTo: REDIRECT } });
  if (link.error) throw new Error(`generateLink refused, status ${link.error.status}`);
  const actionLink = link.data.properties.action_link;
  const verify = await guarded(actionLink, { redirect: "manual" });
  const landing = new URL(verify.headers.get("location"));
  const frag = new URLSearchParams(landing.hash.slice(1));
  const jar = new Map();
  const bridge = await w("POST", "/api/admin/auth/recovery-session", { jar, headers: JSON_HEADERS, body: JSON.stringify({ access_token: frag.get("access_token"), refresh_token: frag.get("refresh_token") }) });
  return { jar, frag, landing, verify, bridge, actionLink };
}

try {
  // ------------------------------------------------------------------ setup
  const admin = await ids.create({ approved: true, label: "admin" });
  await enrolFactor({ sdk: jarClient(sdkFor).sdk, user: admin, due });
  check("setup", "synthetic administrator with a verified test-only factor, no sessions left from setup", (await ids.sessions(admin)).length === 0 && (await q(`select count(*)::int n from auth.mfa_factors where user_id=$1 and status='verified'`, [admin.id]))[0].n === 1);

  // ------------------------------------------------------------------ 1. recovery link to session
  const startHash = await ids.passwordDigest(admin);
  const { jar: rec, frag, landing, verify, bridge, actionLink } = await recoverySession(admin);
  check("recovery", "link lands on the staging reset page with tokens only in the fragment", landing.origin + landing.pathname === REDIRECT && !/token/.test(landing.search) && frag.get("type") === "recovery" && !!frag.get("access_token"), `verify ${verify.status}`);
  const rs = await ids.sessions(admin);
  check("recovery", "bridge creates one recovery session at aal1 from the link alone", bridge.status === 200 && rs.length === 1 && rs[0].aal === "aal1" && rs[0].amr === "otp", `bridge ${bridge.status}; ${rs.map((x) => `${x.aal}/${x.amr}`).join(",")}`);
  check("cookies", "recovery session cookie attributes", bridge.set.some((c) => c.name.startsWith("sb-") && sessionCookieAttributesOk(c)), bridge.set.map(describeCookie).join(" ; "));
  const aalRec = await aalOf(rec);
  check("assurance", "SDK reports the recovery session as aal1 with aal2 required next", aalRec.current === "aal1" && aalRec.next === "aal2", JSON.stringify(aalRec));
  const resetPage = await w("GET", "/admin/reset-password", { jar: rec, store: false });
  check("recovery", "reset form asks for an authenticator code", resetPage.text.includes('id="password"') && resetPage.text.includes('id="code"'));
  const block = await firstFactorOnly(rec);
  check("recovery", "recovery session alone gets no protected page, read or write", block.ok, block.evidence);
  const direct = await guarded(`${STAGING_ORIGIN}/auth/v1/user`, { method: "PUT", headers: { apikey: values.SUPABASE_ANON_KEY, authorization: `Bearer ${frag.get("access_token")}`, "content-type": "application/json" }, body: JSON.stringify({ password: random() }) });
  const dj = await direct.json().catch(() => ({}));
  check("recovery", "Auth itself refuses a password change from the aal1 recovery session", direct.status === 401 && (dj.error_code ?? dj.code) === "insufficient_aal" && (await ids.passwordDigest(admin)) === startHash, `${direct.status} ${dj.error_code ?? dj.code ?? ""}`);
  const trial = random();
  const noCode = await w("POST", "/api/admin/auth/reset-password", { jar: rec, headers: FORM, body: form({ password: trial, confirmPassword: trial }), store: false });
  const badCode = await w("POST", "/api/admin/auth/reset-password", { jar: rec, headers: FORM, body: form({ password: trial, confirmPassword: trial, code: "000000" }), store: false });
  check("recovery", "reset without a code and with a wrong code both refused, password unchanged", noCode.location.includes("error=") && badCode.location.includes("error=") && (await ids.passwordDigest(admin)) === startHash, `${noCode.status} ${noCode.to}; ${badCode.status} ${badCode.to}`);
  const fakeDone = await w("GET", "/admin/reset-password?done=1", { jar: rec, store: false });
  check("reset proof", "done=1 without the one-time cookie shows no success", !fakeDone.text.includes("has been reset"));

  // ------------------------------------------------------------------ 2. the one real reset for the synthetic admin
  const recBefore = new Map(rec);
  const newPassword = random();
  const reset = await w("POST", "/api/admin/auth/reset-password", { jar: rec, headers: FORM, body: form({ password: newPassword, confirmPassword: newPassword, code: await freshCode(admin.secret, due) }) });
  const changed = (await ids.passwordDigest(admin)) !== startHash;
  check("recovery", "reset with a valid code changes the password", reset.status === 302 && reset.location === "/admin/reset-password?done=1" && changed, `${reset.status} ${reset.to}${reset.location.includes("error=") ? " (error)" : ""}`);
  const previousPassword = admin.password;
  admin.password = newPassword;
  const proof = reset.set.find((c) => c.name === "fp_password_changed");
  check("reset proof", "success cookie is HttpOnly, Secure, SameSite=Lax, scoped to the reset page, 60 s", !!proof && proof.value === "1" && proof.a.httponly && proof.a.secure && /^lax$/i.test(proof.a.samesite) && proof.a.path === "/admin/reset-password" && proof.a["max-age"] === "60", proof ? describeCookie(proof) : "absent");
  const sbSet = reset.set.filter((c) => c.name.startsWith("sb-"));
  const lastByName = new Map(sbSet.map((c) => [c.name, c]));
  check("cookies", "reset response removes every session cookie and chunk it wrote or received", sbSet.length > 0 && [...lastByName.values()].every(removes) && sessionCookieNames(rec).length === 0, `${lastByName.size} session cookie names, all removed: ${[...lastByName.values()].every(removes)} | ${[...lastByName.values()].map(describeCookie).join(" ; ")}`);
  check("cookies", "reset response keeps the one-time success cookie", rec.get("fp_password_changed") === "1");
  check("recovery", "recovery session ended on the server after the reset", (await ids.sessions(admin)).length === 0);
  const replayRec = await w("GET", "/api/admin/products", { jar: recBefore, store: false });
  check("recovery", "replayed pre-reset recovery cookies are refused", replayRec.status === 401, String(replayRec.status));
  const done = await w("GET", "/admin/reset-password?done=1", { jar: rec });
  const consumed = done.set.find((c) => c.name === "fp_password_changed");
  check("reset proof", "success page shown once with the cookie, which it then removes", done.text.includes("has been reset") && !!consumed && removes(consumed) && !rec.has("fp_password_changed"));
  const again = await w("GET", "/admin/reset-password?done=1", { jar: rec, store: false });
  check("reset proof", "reloading done=1 afterwards shows no success", !again.text.includes("has been reset"));
  const reuse = await guarded(actionLink, { redirect: "manual" });
  const reuseTo = new URL(reuse.headers.get("location") ?? "about:blank");
  const reuseFrag = new URLSearchParams(reuseTo.hash.slice(1));
  check("recovery", "the used recovery link cannot be used again", !reuseFrag.get("access_token") && !reuseTo.searchParams.get("code") && (!!reuseFrag.get("error") || !!reuseTo.searchParams.get("error") || reuse.status >= 400), `${reuse.status} ${reuseFrag.get("error_code") ?? reuseTo.searchParams.get("error_code") ?? reuseFrag.get("error") ?? ""}`);

  // ------------------------------------------------------------------ 3. previous password refused, new one reaches aal1 only
  await sleep(3000);
  const oldJar = new Map();
  const old = await w("POST", "/api/admin/auth/login", { jar: oldJar, headers: FORM, body: form({ email: admin.email, password: previousPassword }) });
  check("login", "previous password refused with no session and no cookie", old.status === 302 && old.to === "/admin/login" && old.location.includes("error=") && sessionCookieNames(oldJar).length === 0 && (await ids.sessions(admin)).length === 0, `${old.status} ${old.to}`);
  await sleep(3000);
  const s = new Map();
  const login = await w("POST", "/api/admin/auth/login", { jar: s, headers: FORM, body: form({ email: admin.email, password: admin.password }) });
  const s1 = await ids.sessions(admin);
  check("login", "new password accepted and sent to the code page", login.status === 302 && login.to === "/admin/mfa" && s1.length === 1 && s1[0].aal === "aal1" && s1[0].amr === "password", `${login.status} ${login.to}; ${s1.map((x) => `${x.aal}/${x.amr}`).join(",")}`);
  const written = login.set.filter((c) => c.name.startsWith("sb-") && !removes(c));
  check("cookies", "real sign-in cookie attributes", written.length > 0 && written.every(sessionCookieAttributesOk), login.set.map(describeCookie).join(" ; "));
  const aal1 = await aalOf(s);
  check("assurance", "SDK reports the password session as aal1 with aal2 required next", aal1.current === "aal1" && aal1.next === "aal2", JSON.stringify(aal1));
  const pw = await firstFactorOnly(s);
  check("mfa", "password alone gets no protected page, read or write", pw.ok, pw.evidence);

  // ------------------------------------------------------------------ 4. second factor through the deployed code page
  const mfa = await w("POST", "/admin/mfa", { jar: s, headers: FORM, body: form({ action: "verify", code: await freshCode(admin.secret, due) }) });
  const s2 = await ids.sessions(admin);
  check("mfa", "code page upgrades the same session to aal2 with totp", mfa.status === 302 && s2.length === 1 && s2[0].aal === "aal2" && /totp/.test(s2[0].amr ?? ""), `${mfa.status} ${mfa.to}; ${s2.map((x) => `${x.aal}/${x.amr}`).join(",")}`);
  check("cookies", "aal2 cookie attributes", mfa.set.filter((c) => c.name.startsWith("sb-") && !removes(c)).every(sessionCookieAttributesOk), mfa.set.map(describeCookie).join(" ; "));
  const aal2 = await aalOf(s);
  check("assurance", "SDK reports aal2", aal2.current === "aal2" && aal2.next === "aal2", JSON.stringify(aal2));
  const anonymous = (await w("GET", "/api/admin/products")).status;
  let open = 0; const shut = [];
  for (const p of ["/admin/dashboard", "/admin/inquiries", "/admin/products", "/admin/media", "/api/admin/products", "/api/admin/inquiries", "/api/admin/media", "/api/admin/media/folders"]) { const r = await w("GET", p, { jar: s, store: false }); if (r.status === 200 && /no-store/.test(r.cache)) open++; else shut.push(`${p} ${r.status}`); }
  check("authorization", "no session 401, aal1 403 (above), aal2 opens pages and API reads", anonymous === 401 && open === 8, `none ${anonymous}; aal2 ${open}/8${shut.length ? " | " + shut.join("; ") : ""}`);

  // ------------------------------------------------------------------ 5. authenticated CSRF; targets are all-zero ids or logout
  const targets = [["PATCH", `/api/admin/products/${Z}`, "application/json", "{}"], ["POST", `/api/admin/products/${Z}/status`, "application/json", "{}"], ["POST", `/api/admin/inquiries/${Z}/status`, "application/json", "{}"], ["DELETE", `/api/admin/media/${Z}`, undefined, undefined], ["POST", "/api/admin/auth/logout", "application/x-www-form-urlencoded", ""]];
  const variants = { "other site Origin": { origin: "https://evil.example" }, "production Origin": { origin: "https://onlyfreshpetals.in" }, "null Origin": { origin: "null" }, "no Origin": {}, "same Origin, cross-site Fetch Metadata": { origin: WORKER, "sec-fetch-site": "cross-site" }, "no Origin, cross-site Fetch Metadata": { "sec-fetch-site": "cross-site" } };
  for (const [label, h] of Object.entries(variants)) {
    const st = [];
    for (const [m, p, ct, d] of targets) st.push((await w(m, p, { jar: s, headers: { ...h, ...(ct ? { "content-type": ct } : {}) }, body: d, store: false })).status);
    check("csrf", `signed in at aal2, ${label}: all refused`, st.every((x) => x === 403), st.join(","));
  }
  const wrongType = await w("PATCH", `/api/admin/products/${Z}`, { jar: s, headers: { origin: WORKER, "content-type": "text/plain" }, body: "{}", store: false });
  check("csrf", "same origin with a form-safe body type refused", wrongType.status === 415, String(wrongType.status));
  const control = await w("PATCH", `/api/admin/products/${Z}`, { jar: s, headers: JSON_HEADERS, body: "{}", store: false });
  check("csrf", "control: same-origin JSON passes the guard to the handler", ![401, 403, 415].includes(control.status), String(control.status));
  const still = await w("GET", "/api/admin/products", { jar: s, store: false });
  check("csrf", "session survives every refused cross-site logout", still.status === 200 && (await ids.sessions(admin)).length === 1, String(still.status));

  // ------------------------------------------------------------------ 6. logout: cookies removed and the session invalid on the server
  const preLogout = new Map(s);
  const out = await w("POST", "/api/admin/auth/logout", { jar: s, headers: FORM, body: "" });
  check("logout", "logout redirects and removes the session cookies", out.status === 302 && out.to === "/admin/login" && sessionCookieNames(s).length === 0, `${out.status} ${out.to}; ${out.set.map(describeCookie).join(" ; ")}`);
  const replay = await w("GET", "/api/admin/products", { jar: preLogout, store: false });
  check("logout", "server-side: replayed pre-logout cookies are refused and the session is gone", replay.status === 401 && (await ids.sessions(admin)).length === 0, `${replay.status}; sessions ${(await ids.sessions(admin)).length}`);

  // ------------------------------------------------------------------ 7. approved profile withdrawn: existing session ended, new sign-in refused
  await sleep(3000);
  const ex = new Map();
  const exLogin = await w("POST", "/api/admin/auth/login", { jar: ex, headers: FORM, body: form({ email: admin.email, password: admin.password }) });
  if (exLogin.to !== "/admin/mfa" || (await ids.sessions(admin)).length !== 1) throw new Error("could not open the session for the unapproved-profile check");
  await q(`update public.admin_users set role='disabled-integration-test' where id=$1 and email=$2`, [admin.id, admin.email]);
  const exPre = new Map(ex);
  const exPage = await w("GET", "/admin/mfa", { jar: ex });
  const exApi = await w("GET", "/api/admin/products", { jar: exPre, store: false });
  check("non-admin", "session refused once its profile is unapproved: sent to login, cookie removed, session ended", exPage.status === 302 && exPage.to === "/admin/login" && sessionCookieNames(ex).length === 0 && (await ids.sessions(admin)).length === 0 && exApi.status === 401, `page ${exPage.status} ${exPage.to}; replay API ${exApi.status}; ${exPage.set.map(describeCookie).join(" ; ") || "no Set-Cookie"}`);
  await sleep(3000);
  const rj = new Map();
  const rejected = await w("POST", "/api/admin/auth/login", { jar: rj, headers: FORM, body: form({ email: admin.email, password: admin.password }) });
  check("cookies", "valid password but unapproved profile: refused, every cookie removed, no session", rejected.status === 302 && rejected.to === "/admin/login" && rejected.location.includes("error=") && sessionCookieNames(rj).length === 0 && (await ids.sessions(admin)).length === 0, `${rejected.status} ${rejected.to}; ${rejected.set.map(describeCookie).join(" ; ") || "no Set-Cookie"}`);

  // ------------------------------------------------------------------ 8. an identity with no admin profile at all
  // Each level uses fresh sessions opened directly against Auth (confirmed valid first), because the
  // Worker ends an unapproved session on its first request.
  const none = await ids.create({ approved: false, label: "noprofile" });
  await sleep(3000);
  const nj = new Map();
  const nLogin = await w("POST", "/api/admin/auth/login", { jar: nj, headers: FORM, body: form({ email: none.email, password: none.password }) });
  check("no profile", "sign-in through the app with the correct password: refused, no cookie, no session", nLogin.status === 302 && nLogin.to === "/admin/login" && nLogin.location.includes("error=") && sessionCookieNames(nj).length === 0 && (await ids.sessions(none)).length === 0, `${nLogin.status} ${nLogin.to}; ${nLogin.set.map(describeCookie).join(" ; ") || "no Set-Cookie"}`);

  async function directSession(level) {
    const { jar, sdk } = jarClient(sdkFor);
    const r = await sdk.auth.signInWithPassword({ email: none.email, password: none.password });
    if (r.error) throw new Error(`no-profile sign-in refused, status ${r.error.status}`);
    if (level === "aal2") { const v = await sdk.auth.mfa.challengeAndVerify({ factorId: none.factorId, code: await freshCode(none.secret, due) }); if (v.error) throw new Error(`no-profile verify refused, status ${v.error.status}`); }
    return jar;
  }
  async function refusedAtLevel(label, open, expectedAal) {
    const bad = [];
    let confirmed = 0;
    const probes = [["GET", "/api/admin/products", 401], ["GET", "/admin/dashboard", 302], ["PATCH", `/api/admin/products/${Z}`, 401]];
    for (const [m, p, want] of probes) {
      const jar = await open();
      const level = await aalOf(jar);
      const live = await ids.sessions(none);
      if (level.current === expectedAal && live.length === 1) confirmed++;
      const r = await w(m, p, { jar, headers: m === "GET" ? {} : JSON_HEADERS, body: m === "GET" ? undefined : "{}" });
      const after = await ids.sessions(none);
      const ok = r.status === want && (want !== 302 || r.to === "/admin/login") && sessionCookieNames(jar).length === 0 && after.length === 0;
      if (!ok) bad.push(`${m} ${p.replace(Z, "Z")} ${r.status} ${r.to} cookies ${sessionCookieNames(jar).length} sessions ${after.length}`);
    }
    check("no profile", `valid ${label} session: API read 401, page to sign-in, write 401; cookie removed and session ended each time`, !bad.length && confirmed === probes.length, `${probes.length - bad.length}/${probes.length} refused; sessions confirmed at ${expectedAal} before each: ${confirmed}/${probes.length}${bad.length ? " | " + bad.join("; ") : ""}`);
  }
  await refusedAtLevel("aal1 (no factor)", () => directSession("aal1"), "aal1");
  await enrolFactor({ sdk: jarClient(sdkFor).sdk, user: none, due });
  await refusedAtLevel("aal1 (verified factor present)", () => directSession("aal1"), "aal1");
  await refusedAtLevel("aal2", () => directSession("aal2"), "aal2");
  const nrec = await recoverySession(none);
  const nrecSessions = await ids.sessions(none);
  const nrecApi = await w("GET", "/api/admin/products", { jar: nrec.jar });
  const nrecPage = await w("GET", "/admin/dashboard", { jar: new Map(nrec.jar), store: false });
  check("no profile", "recovery-link session: refused and ended by the Worker", nrec.bridge.status === 200 && nrecSessions.length === 1 && nrecApi.status === 401 && nrecPage.status === 302 && nrecPage.to === "/admin/login" && (await ids.sessions(none)).length === 0, `bridge ${nrec.bridge.status}; API ${nrecApi.status}; page ${nrecPage.status} ${nrecPage.to}; sessions after ${(await ids.sessions(none)).length}`);
} catch (e) {
  check("run", "run completed without an error", false, scrub(e.message));
} finally {
  await ids.cleanup();
  compareSnapshots(check, before, await snapshot(q), { sequencesMayAdvance: false });
  const fails = run.finish({ out: args.out, extra: { revision: rev.served } });
  process.exit(process.exitCode ?? (fails ? 1 : 0));
}

