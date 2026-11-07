#!/usr/bin/env node
// Installs FP_PUBLISH_GITHUB_TOKEN (publish on save, src/server/services/Publishing.ts) on the
// staging and production Workers. Run it yourself in a terminal; the token is typed at a hidden
// prompt and is never echoed, printed, logged or written to a file.
//
//   node scripts/cloudflare/set-publish-token.mjs [--staging-only | --production-only]
//
// The token must be a fine-grained personal access token limited to RanjithKumar427/fresh-petals
// with Repository permissions -> Contents: Read and write (Metadata: Read is added by GitHub).
// GitHub requires Contents write for POST /repos/{owner}/{repo}/dispatches.
// Wrangler must be logged in on this PC (npx wrangler login).
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY = "RanjithKumar427/fresh-petals";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// The account: CLOUDFLARE_ACCOUNT_ID, or the one wrangler already chose for this checkout.
const accountCache = path.join(ROOT, "node_modules/.cache/wrangler/wrangler-account.json");
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || (existsSync(accountCache) ? JSON.parse(readFileSync(accountCache, "utf8")).account?.id : "");
if (!ACCOUNT_ID) { console.log("Set CLOUDFLARE_ACCOUNT_ID (or run any wrangler command in this checkout once) and retry."); process.exit(2); }
const WRANGLER = path.join(ROOT, "node_modules/wrangler/bin/wrangler.js");
const only = process.argv.find((a) => a === "--staging-only" || a === "--production-only");
const WORKERS = only === "--staging-only" ? ["fresh-petals-staging"] : only === "--production-only" ? ["fresh-petals"] : ["fresh-petals-staging", "fresh-petals"];

function hiddenPrompt(label) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY) return reject(new Error("run this in an interactive terminal (the prompt needs a TTY)"));
    process.stdout.write(label);
    input.setRawMode(true);
    input.resume();
    input.setEncoding("utf8");
    let value = "";
    const done = (error) => { input.setRawMode(false); input.pause(); input.removeListener("data", onData); process.stdout.write("\n"); error ? reject(error) : resolve(value); };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") return done();
        if (ch === "\u0003") return done(new Error("cancelled"));
        if (ch === "\u0008" || ch === "\u007f") value = value.slice(0, -1);
        else if (ch >= " ") value += ch;
      }
    };
    input.on("data", onData);
  });
}

const token = (await hiddenPrompt("Paste the fine-grained GitHub token (input hidden), then Enter: ")).trim();
if (!/^github_pat_[A-Za-z0-9_]{40,}$/.test(token)) {
  console.log("Refused: that is not a fine-grained personal access token (expected github_pat_...). Nothing was installed.");
  process.exit(2);
}

// The token can see this repository (no write is attempted here; the first save proves dispatch).
const response = await fetch(`https://api.github.com/repos/${REPOSITORY}`, {
  headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "user-agent": "fresh-petals-setup", "x-github-api-version": "2022-11-28" },
  signal: AbortSignal.timeout(15000),
});
if (response.status !== 200) {
  console.log(`Refused: GitHub answered ${response.status} for ${REPOSITORY} with this token (wrong repository selection or expired). Nothing was installed.`);
  process.exit(2);
}
console.log(`GitHub accepts the token for ${REPOSITORY}.`);

const cwd = mkdtempSync(path.join(os.tmpdir(), "fp-publish-token-")); // no wrangler.jsonc here: --name decides the Worker
let failed = 0;
try {
  for (const worker of WORKERS) {
    const r = spawnSync(process.execPath, [WRANGLER, "secret", "put", "FP_PUBLISH_GITHUB_TOKEN", "--name", worker], {
      cwd, input: token, encoding: "utf8", env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID, WRANGLER_SEND_METRICS: "false" },
    });
    const ok = r.status === 0;
    if (!ok) failed++;
    console.log(`${worker}: ${ok ? "FP_PUBLISH_GITHUB_TOKEN installed" : `install failed (exit ${r.status}); run "npx wrangler login" and retry`}`);
  }
} finally {
  rmSync(cwd, { recursive: true, force: true });
}
process.exit(failed ? 1 : 0);
