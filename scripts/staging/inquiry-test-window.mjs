#!/usr/bin/env node
// Opens staging's controlled enquiry-write window for one command, then always closes it.
//
//   node scripts/staging/inquiry-test-window.mjs -- <command> [args...]
//
// 1. Generates a random key in memory and installs it as the staging Worker secret
//    FP_STAGING_INQUIRY_TEST_KEY (see src/server/http/requestGuard.ts). Only requests that send the
//    same value in x-fp-staging-inquiry-test may then log an enquiry; every visitor is still refused.
// 2. Runs the command with the key in its environment only. The key is never printed or written.
// 3. In `finally`, deletes the secret and confirms that POST /api/inquiries is refused (403) again,
//    with and without the old key.
// Staging Worker only: the Cloudflare account is the one holding the staging workers.dev subdomain.
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AUTH_ORIGIN, EXPECTED_SUBDOMAIN, WORKER_NAME } from "./deploy-lib.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const split = process.argv.indexOf("--");
const command = split < 0 ? [] : process.argv.slice(split + 1);
if (!command.length) { console.log("usage: node scripts/staging/inquiry-test-window.mjs -- <command> [args...]"); process.exit(2); }
if (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_API_TOKEN) { console.log("STOP: unset inherited Cloudflare settings"); process.exit(2); }

const WRANGLER = path.join(root, "node_modules/wrangler/bin/wrangler.js");
// An empty working directory, so no wrangler configuration other than --name can apply.
const cwd = mkdtempSync(path.join(tmpdir(), "fp-inquiry-window-"));
const wrangler = (argv, opts = {}) => spawnSync(process.execPath, [WRANGLER, ...argv], { encoding: "utf8", cwd, input: opts.input, env: { ...process.env, WRANGLER_SEND_METRICS: "false", ...opts.env } });
const NAME = "FP_STAGING_INQUIRY_TEST_KEY";
const refusedAgain = async (key) => {
  const statuses = [];
  for (const extra of [{}, { "x-fp-staging-inquiry-test": key }]) {
    const r = await fetch(`${AUTH_ORIGIN}/api/inquiries`, { method: "POST", redirect: "manual", headers: { origin: AUTH_ORIGIN, "content-type": "application/json", ...extra }, body: "{}" });
    statuses.push(r.status);
  }
  return statuses;
};

let token;
try { token = JSON.parse(wrangler(["auth", "token", "--json"]).stdout).token; } catch { /* below */ }
if (!token) { console.log("STOP: Wrangler is not signed in"); process.exit(2); }
const api = async (route) => { const r = await fetch(`https://api.cloudflare.com/client/v4${route}`, { redirect: "error", headers: { authorization: `Bearer ${token}` } }); const b = await r.json().catch(() => ({})); if (!r.ok || b.success === false) throw new Error(`Cloudflare API status ${r.status}`); return b.result; };
const accounts = [];
for (const a of await api("/accounts")) { const sub = await api(`/accounts/${a.id}/workers/subdomain`).catch(() => null); if (sub?.subdomain === EXPECTED_SUBDOMAIN) accounts.push(a.id); }
if (accounts.length !== 1) { console.log("STOP: the staging Cloudflare account was not found exactly once"); process.exit(2); }
const cf = { CLOUDFLARE_ACCOUNT_ID: accounts[0] };

const key = randomBytes(32).toString("base64url");
let exit = 1;
try {
  const put = wrangler(["secret", "put", NAME, "--name", WORKER_NAME], { input: key, env: cf });
  if (put.status !== 0) throw new Error(`secret put failed, exit ${put.status}`);
  console.log(`OPEN  ${NAME} installed on ${WORKER_NAME}; running the command`);
  await new Promise((r) => setTimeout(r, 8000)); // let the new version take effect
  const child = spawnSync(command[0], command.slice(1), { cwd: root, stdio: "inherit", env: { ...process.env, [NAME]: key } });
  exit = child.status ?? 1;
} catch (e) {
  console.log("ERROR", String(e.message).slice(0, 200));
} finally {
  const del = wrangler(["secret", "delete", NAME, "--name", WORKER_NAME], { input: "y\n", env: cf });
  console.log(`CLOSE secret delete exit ${del.status}`);
  let statuses = [];
  for (let i = 0; i < 12; i++) { statuses = await refusedAgain(key); if (statuses.every((s) => s === 403)) break; await new Promise((r) => setTimeout(r, 5000)); }
  const closed = del.status === 0 && statuses.every((s) => s === 403);
  console.log(`${closed ? "PASS" : "FAIL"}  enquiry writes refused again: without key ${statuses[0]}, with the old key ${statuses[1]}`);
  rmSync(cwd, { recursive: true, force: true });
  process.exit(closed ? exit : 3);
}
