// Build-time security headers and Content-Security-Policy check for the
// Vercel output (.vercel/output, Build Output API v3).
//
// 1. Adds SECURITY_HEADERS (frame denial, nosniff, referrer and permissions
//    policy) to every response with one header-only route at the top of the
//    routing config (`continue: true`), so it never replaces a page's own
//    CSP or cache headers.
// 2. The adapter (staticHeaders) gives each prerendered page a route with
//    its CSP, matching the path without a trailing slash only. Vercel also
//    serves "/about/" from the same file, so each of those routes is
//    widened to accept an optional trailing slash: no page can be reached
//    without its policy.
// 3. Fails the build if any prerendered page runs an inline script whose
//    SHA-256 is not in that page's script-src, or if a script-src allows
//    'unsafe-inline' or 'unsafe-eval'. Data blocks (application/json,
//    application/ld+json) are not executed and need no hash. Script text
//    is read as a browser parses it (CRLF and lone CR become LF) before
//    hashing, so a page whose rendered script would be blocked fails here.
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS } from '../../src/server/http/securityHeaders.mjs';
import { inlineScriptHash } from '../../src/server/http/inlineScriptHash.mjs';

const EXECUTABLE = new Set(['', 'text/javascript', 'application/javascript', 'module']);
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Inline executable script bodies in an HTML document. */
export function inlineScripts(html) {
  const found = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = match[1];
    if (/\ssrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/\stype\s*=\s*["']?([^"'\s>]+)/i)?.[1] ?? '').toLowerCase();
    if (!EXECUTABLE.has(type)) continue;
    found.push(match[2]);
  }
  return found;
}

const sha256 = (text) => `'${inlineScriptHash(text)}'`;

/** script-src sources of a policy string. */
export function scriptSources(policy) {
  const directive = policy.split(';').map((part) => part.trim()).find((part) => part.startsWith('script-src '));
  return directive ? directive.split(/\s+/).slice(1) : [];
}

/** Problems with one page: unhashed inline scripts or unsafe script sources. */
export function cspProblems(html, policy) {
  const problems = [];
  const sources = new Set(scriptSources(policy));
  if (sources.size === 0) problems.push('no script-src');
  for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'"]) if (sources.has(unsafe)) problems.push(`script-src allows ${unsafe}`);
  for (const body of inlineScripts(html)) {
    if (!sources.has(sha256(body))) problems.push(`inline script without its hash: ${body.trim().slice(0, 60)}…`);
  }
  return problems;
}

function htmlFor(staticDir, route) {
  const base = path.join(staticDir, route === '/' ? '' : route);
  return [path.join(base, 'index.html'), `${base}.html`].find((file) => existsSync(file) && statSync(file).isFile());
}

/**
 * Patch config.json (steps 1 and 2) and check every page (step 3), reading
 * the HTML from `staticDir` (the adapter copies it into .vercel/output/static
 * only after this hook). Returns { pages, problems }.
 */
export function applySecurityHeaders(outputDir = path.resolve('.vercel/output'), staticDir = path.join(outputDir, 'static')) {
  const file = path.join(outputDir, 'config.json');
  const config = JSON.parse(readFileSync(file, 'utf8'));
  const routes = (config.routes ?? []).filter((route) => !(route.src === '/(.*)' && route.headers?.['x-frame-options']));
  const problems = [];
  let pages = 0;
  for (const route of routes) {
    const policy = route.headers?.['content-security-policy'];
    if (!policy || route.handle) continue;
    const pathname = route.src;
    if (!pathname.startsWith('/') || pathname.startsWith('^')) continue;
    const html = htmlFor(staticDir, pathname);
    if (html) {
      pages += 1;
      for (const problem of cspProblems(readFileSync(html, 'utf8'), policy)) problems.push(`${pathname}: ${problem}`);
    }
    route.src = pathname === '/' ? '^/$' : `^${escapeRegex(pathname.replace(/\/+$/, ''))}/?$`;
  }
  routes.unshift({ src: '/(.*)', headers: SECURITY_HEADERS, continue: true });
  config.routes = routes;
  writeFileSync(file, JSON.stringify(config, null, 2));
  return { pages, problems };
}

/** Prerendered HTML files that have no CSP route at all. */
export function pagesWithoutPolicy(outputDir = path.resolve('.vercel/output'), staticDir = path.join(outputDir, 'static')) {
  const config = JSON.parse(readFileSync(path.join(outputDir, 'config.json'), 'utf8'));
  const covered = config.routes.filter((route) => route.headers?.['content-security-policy']).map((route) => new RegExp(route.src));
  const missing = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) {
        const rel = '/' + path.relative(staticDir, full).split(path.sep).join('/');
        const pathname = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '') || '/';
        if (!covered.some((re) => re.test(pathname))) missing.push(pathname);
      }
    }
  };
  if (existsSync(staticDir)) walk(staticDir);
  return missing;
}

export const securityHeaders = {
  name: 'fresh-petals:security-headers',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      const outputDir = path.resolve('.vercel/output');
      if (!existsSync(path.join(outputDir, 'config.json'))) return;
      const staticDir = fileURLToPath(dir);
      const { pages, problems } = applySecurityHeaders(outputDir, staticDir);
      const uncovered = pagesWithoutPolicy(outputDir, staticDir);
      for (const pathname of uncovered) problems.push(`${pathname}: prerendered page without a Content-Security-Policy route`);
      if (problems.length) throw new Error(`Content-Security-Policy check failed:\n  ${problems.slice(0, 20).join('\n  ')}`);
      logger.info(`Security headers on every route; ${pages} prerendered pages checked: each has a CSP and every inline script is in its script-src.`);
    },
  },
};
