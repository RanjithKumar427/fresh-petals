// The staging guard must refuse anything but staging's Session pooler, with no network.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRODUCTION_REF, STAGING_ORIGIN, STAGING_REF, emptinessFailures, pendingDecision, settingFailures, snapshotDiff, targetFailures } from "../staging/guard.mjs";

const HOST = "aws-0-eu-west-1.pooler.supabase.com";
const url = (o = {}) => `postgresql://${o.user ?? `postgres.${STAGING_REF}`}:${o.pw ?? "s3cret-Value"}@${o.host ?? HOST}:${o.port ?? 5432}/${o.db ?? "postgres"}${o.query ?? ""}`;
const file = (over = {}, declared) => {
  const values = { DATABASE_URL: url(), SUPABASE_URL: STAGING_ORIGIN, SUPABASE_ANON_KEY: "sb_publishable_a", SUPABASE_SERVICE_ROLE_KEY: "sb_secret_b", ...over };
  return { values, declared: declared ?? Object.keys(values) };
};
const refuses = (f, pattern) => assert.ok(targetFailures(f).some((m) => pattern.test(m)), targetFailures(f).join("; ") || "no failure");

test("accepts staging's Session pooler, with or without a trailing slash on the origin", () => {
  assert.deepEqual(targetFailures(file()), []);
  assert.deepEqual(targetFailures(file({ SUPABASE_URL: `${STAGING_ORIGIN}/` })), []);
});

test("refuses production references anywhere", () => {
  refuses(file({ SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co` }), /production/);
  refuses(file({ DATABASE_URL: url({ user: `postgres.${PRODUCTION_REF}` }) }), /production/);
  refuses(file({ SUPABASE_ANON_KEY: `x${PRODUCTION_REF}` }), /production/);
});

test("refuses the wrong pooler mode, host, database or user", () => {
  refuses(file({ DATABASE_URL: url({ port: 6543 }) }), /5432/);
  refuses(file({ DATABASE_URL: url({ host: "db.example.com" }) }), /pooler endpoint/);
  refuses(file({ DATABASE_URL: url({ host: "aws-0-eu-west-1.pooler.supabase.com.evil.example" }) }), /pooler endpoint/);
  refuses(file({ DATABASE_URL: url({ db: "other" }) }), /database/);
  refuses(file({ DATABASE_URL: url({ user: "postgres" }) }), /pooler user/);
  refuses(file({ SUPABASE_URL: "https://example.supabase.co" }), /staging origin/);
});

test("refuses query parameters, which could override TLS verification", () => {
  refuses(file({ DATABASE_URL: url({ query: "?sslmode=disable" }) }), /query parameters/);
});

test("refuses bad passwords without repairing them", () => {
  refuses(file({ DATABASE_URL: url({ pw: "[YOUR-PASSWORD]" }) }), /placeholder|delimiter/);
  refuses(file({ DATABASE_URL: url({ pw: "abc%zz" }) }), /percent/);
  refuses(file({ DATABASE_URL: url({ pw: "a@b" }) }), /delimiter/);
});

test("refuses missing and duplicate settings", () => {
  refuses(file({ SUPABASE_ANON_KEY: " " }), /SUPABASE_ANON_KEY is missing/);
  const dup = file();
  dup.declared.push("DATABASE_URL");
  refuses(dup, /more than once/);
});

test("no failure message contains a credential", () => {
  const f = file({ DATABASE_URL: url({ pw: "a@b%zzSECRET", port: 1 }), SUPABASE_URL: "https://SECRET.example" });
  assert.ok(targetFailures(f).length > 0);
  assert.ok(!targetFailures(f).join(" ").includes("SECRET"));
});

const LIVE = { disableSignup: true, passwordMinFromDashboard: 12, defaultAcls: [{ owner: "postgres", type: "f", acl: "{anon=X/postgres}" }, { owner: "postgres", type: "r", acl: "{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres}" }, { owner: "supabase_admin", type: "r", acl: "{anon=arwdDxtm/supabase_admin}" }] };

test("requires the owner's settings to be live", () => {
  assert.deepEqual(settingFailures(LIVE), []);
  assert.match(settingFailures({ ...LIVE, disableSignup: false })[0], /signups/);
  assert.match(settingFailures({ ...LIVE, disableSignup: undefined })[0], /signups/);
  assert.match(settingFailures({ ...LIVE, passwordMinFromDashboard: 6 })[0], /password/);
  assert.match(settingFailures({ ...LIVE, defaultAcls: [{ owner: "postgres", type: "r", acl: "{anon=arwdDxtm/postgres}" }] })[0], /visitor roles/);
  assert.match(settingFailures({ ...LIVE, defaultAcls: [{ owner: "postgres", type: "S", acl: "{authenticated=rwU/postgres}" }] })[0], /visitor roles/);
  // Any one data right is enough to mean the toggle is still on.
  for (const letters of ["a", "r", "w", "d", "rDxtm"]) {
    assert.match(settingFailures({ ...LIVE, defaultAcls: [{ owner: "postgres", type: "r", acl: `{anon=${letters}/postgres}` }] })[0], /visitor roles/);
  }
});

test("accepts what saving the toggle off actually leaves, for the verifier to judge", () => {
  const defaultAcls = [
    { owner: "postgres", type: "r", acl: "{postgres=arwdDxtm/postgres,anon=Dxtm/postgres,authenticated=Dxtm/postgres,service_role=Dxtm/postgres}" },
    { owner: "postgres", type: "S", acl: "{postgres=rwU/postgres,anon=w/postgres,authenticated=w/postgres,service_role=w/postgres}" },
    { owner: "supabase_admin", type: "r", acl: "{anon=arwdDxtm/supabase_admin}" },
  ];
  assert.deepEqual(settingFailures({ ...LIVE, defaultAcls }), []);
});

const ENTRIES = [{ tag: "a", when: 1, hash: "h1" }, { tag: "b", when: 2, hash: "h2" }, { tag: "c", when: 3, hash: "h3" }];
const LEDGER = [{ hash: "h1", created_at: "1" }, { hash: "h2", created_at: "2" }];

test("allows one expected migration only when the ledger is exactly the earlier entries", () => {
  assert.equal(pendingDecision(LEDGER, ENTRIES, "c").state, "ready");
  assert.equal(pendingDecision([...LEDGER, { hash: "h3", created_at: "3" }], ENTRIES, "c").state, "applied");
  assert.equal(pendingDecision([...LEDGER, { hash: "other", created_at: "3" }], ENTRIES, "c").state, "refuse");
  assert.equal(pendingDecision([{ hash: "x", created_at: "1" }, LEDGER[1]], ENTRIES, "c").state, "refuse");
  assert.equal(pendingDecision([LEDGER[0], { hash: "h2", created_at: "9" }], ENTRIES, "c").state, "refuse");
  assert.equal(pendingDecision([LEDGER[0]], ENTRIES, "c").state, "refuse");
  assert.equal(pendingDecision([], ENTRIES, "c").state, "refuse");
  assert.equal(pendingDecision([...LEDGER, { hash: "h3", created_at: "3" }, { hash: "h4", created_at: "4" }], ENTRIES, "c").state, "refuse");
  assert.equal(pendingDecision(LEDGER, ENTRIES, "b").state, "refuse");
  assert.equal(pendingDecision(LEDGER, ENTRIES, "missing").state, "refuse");
});

test("reports permission changes in both directions", () => {
  assert.deepEqual(snapshotDiff(["x", "y"], ["y", "z"]), { removed: ["x"], added: ["z"] });
});

test("0014 only revokes MAINTAIN from the two visitor roles, after 0013", () => {
  const sql = readFileSync(new URL("../../drizzle/0014_revoke_visitor_maintain.sql", import.meta.url), "utf8").replace(/--.*$/gm, "").trim();
  assert.equal(sql, "REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public FROM anon, authenticated;");
  const { entries } = JSON.parse(readFileSync(new URL("../../drizzle/meta/_journal.json", import.meta.url), "utf8"));
  assert.deepEqual(entries.at(-1), { idx: 14, version: "7", when: 1793793600000, tag: "0014_revoke_visitor_maintain", breakpoints: true });
  assert.ok(entries.at(-1).when > entries.at(-2).when);
});

test("refuses a database that already holds application objects or history", () => {
  assert.deepEqual(emptinessFailures({ publicObjects: "0", drizzleSchema: false, supabaseLedger: false }), []);
  assert.equal(emptinessFailures({ publicObjects: "3", drizzleSchema: true, supabaseLedger: true }).length, 3);
});
