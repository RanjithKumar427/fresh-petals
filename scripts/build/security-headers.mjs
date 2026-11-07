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

/** The policy a prerendered page carries in its <meta http-equiv> tag (Cloudflare builds). */
export function metaPolicy(html) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/http-equiv\s*=\s*["']?content-security-policy["'\s>]/i.test(tag)) continue;
    const content = tag.match(/\scontent\s*=\s*"([^"]*)"/i) ?? tag.match(/\scontent\s*=\s*'([^']*)'/i);
    if (content) return content[1].replaceAll('&#39;', "'").replaceAll('&quot;', '"').replaceAll('&amp;', '&');
  }
  return null;
}

/**
 * Astro writes a static page's <meta> policy before the body runs, so hashes
 * that src/components/InlineScript.astro registers (Astro.csp.insertScriptHash)
 * reach the response header on Vercel but not the meta tag. Add the hash of
 * each script carrying InlineScript's data-fp-inline marker, and nothing else:
 * any other inline script still fails cspProblems().
 */
export function withReviewedHashes(html) {
  const reviewed = [];
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\sdata-fp-inline(\s|=|$)/i.test(match[1])) reviewed.push(sha256(match[2]));
  }
  if (!reviewed.length) return html;
  return html.replace(/(<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*\scontent\s*=\s*")([^"]*)(")/i, (all, before, content, after) => {
    const directives = content.split(';');
    const index = directives.findIndex((part) => part.trim().startsWith('script-src '));
    if (index === -1) return all;
    const existing = directives[index].trim().split(/\s+/);
    const add = [...new Set(reviewed)].filter((hash) => !existing.includes(hash) && !existing.includes(hash.replaceAll("'", '&#39;')));
    const quote = content.includes('&#39;') ? (hash) => hash.replaceAll("'", '&#39;') : (hash) => hash;
    directives[index] = `${directives[index]} ${add.map(quote).join(' ')}`.trimEnd();
    return before + directives.join(';') + after;
  });
}

/**
 * A <meta> policy governs only what follows it, and Astro places it after
 * some head content (including a reviewed inline script). Move it to directly
 * after <meta charset>, so nothing on the page runs outside the policy.
 */
export function policyFirst(html) {
  const meta = html.match(/<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>/i);
  const charset = html.match(/<meta\s+charset\s*=\s*["']?[^"'>\s]+["']?\s*\/?>/i);
  if (!meta || !charset || html.indexOf(meta[0]) < html.indexOf(charset[0])) return html;
  const without = html.replace(meta[0], '');
  const at = without.indexOf(charset[0]) + charset[0].length;
  return without.slice(0, at) + meta[0] + without.slice(at);
}

/**
 * Browsers ignore frame-ancestors in a <meta> policy and log an error on every
 * page; the same protection comes from X-Frame-Options: DENY in _headers.
 */
export function withoutMetaFrameAncestors(html) {
  return html.replace(/(<meta\b[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*\scontent\s*=\s*")([^"]*)(")/i, (all, before, content, after) =>
    before + content.split(';').filter((part) => !part.trim().startsWith('frame-ancestors')).join(';') + after);
}

/** HSTS, which Vercel adds at its domain layer, is sent by Cloudflare builds themselves. */
export const CLOUDFLARE_EXTRA_HEADERS = { 'strict-transport-security': 'max-age=63072000' };

/**
 * Cloudflare Workers static assets: one `/*` rule in _headers gives every
 * static file the security headers (merged with any rule the adapter adds),
 * and every prerendered page must carry a meta CSP that hashes each inline
 * script it runs. A <meta> policy cannot express frame-ancestors; framing is
 * still refused by X-Frame-Options: DENY from the same rule.
 */
export function applyCloudflareHeaders(staticDir) {
  const headersFile = path.join(staticDir, '_headers');
  const existing = existsSync(headersFile) ? readFileSync(headersFile, 'utf8') : '';
  // The preview and staging Workers are built separately and must never be indexed.
  const preview = process.env.FP_DEPLOY_ENV === 'preview' || process.env.FP_DEPLOY_ENV === 'staging' ? { 'x-robots-tag': 'noindex, nofollow' } : {};
  const lines = Object.entries({ ...SECURITY_HEADERS, ...CLOUDFLARE_EXTRA_HEADERS, ...preview }).map(([name, value]) => `  ${name}: ${value}`);
  // HTML fragments fetched by prebuilt pages (src/pages/fragments/) are never pages to index.
  // Stored-photo copies are named by content hash (scripts/build/stored-photos.mjs): never stale.
  const fragments = `/fragments/*\n  x-robots-tag: noindex\n\n/photos/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
  if (!existing.includes('# fresh-petals security headers')) {
    writeFileSync(headersFile, `# fresh-petals security headers\n/*\n${lines.join('\n')}\n\n${fragments}\n${existing}`);
  }
  // Deeper /studio paths: the adapter writes /studio and /studio/ from astro.config's
  // redirects; the splat makes /studio/<anything> a static 301 too, without running the Worker.
  const redirectsFile = path.join(staticDir, '_redirects');
  const redirects = existsSync(redirectsFile) ? readFileSync(redirectsFile, 'utf8') : '';
  if (!redirects.includes('/studio/*')) writeFileSync(redirectsFile, `${redirects.replace(/\n*$/, '\n')}/studio/*    /categories/bouquets    301\n`);
  const problems = [];
  let pages = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith('.html')) {
        const rel = '/' + path.relative(staticDir, full).split(path.sep).join('/');
        // A fragment is HTML inserted into a page that already carries the policy; it has no <head>.
        if (rel.startsWith('/fragments/')) continue;
        pages += 1;
        const html = withoutMetaFrameAncestors(policyFirst(withReviewedHashes(readFileSync(full, 'utf8'))));
        writeFileSync(full, html);
        const policy = metaPolicy(html);
        const head = html.slice(0, html.search(/content-security-policy/i));
        if (/<script\b|<link\b[^>]*rel\s*=\s*["']?(?:stylesheet|modulepreload)/i.test(head)) problems.push(`${rel}: script or stylesheet before the Content-Security-Policy`);
        if (!policy) problems.push(`${rel}: prerendered page without a Content-Security-Policy`);
        else for (const problem of cspProblems(html, policy)) problems.push(`${rel}: ${problem}`);
      }
    }
  };
  walk(staticDir);
  return { pages, problems };
}

export const securityHeaders = {
  name: 'fresh-petals:security-headers',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      if (process.env.DEPLOY_TARGET === 'cloudflare') {
        const { pages, problems } = applyCloudflareHeaders(fileURLToPath(dir));
        if (problems.length) throw new Error(`Content-Security-Policy check failed:\n  ${problems.slice(0, 20).join('\n  ')}`);
        logger.info(`Security headers in _headers for every static file; ${pages} prerendered pages checked: each has a CSP and every inline script is in its script-src.`);
        return;
      }
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
