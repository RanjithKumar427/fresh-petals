// The text a browser hashes for an inline script, shared by the component
// that renders reviewed scripts (src/components/InlineScript.astro) and the
// build check (scripts/build/security-headers.mjs). Plain .mjs so the build
// script can import it without a TypeScript step.
//
// Before tokenising, an HTML parser turns every CRLF pair and every lone CR
// into LF; the CSP hash of a script is taken over the element's text after
// that. A source file checked out with CRLF (core.autocrlf on Windows) would
// otherwise be hashed with CRs the browser never sees, and blocked.
import { createHash } from 'node:crypto';

/**
 * Script text as an HTML parser presents it: CRLF and lone CR become LF.
 * @param {string} text
 * @returns {string}
 */
export function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * CSP source for the script text a browser would run, e.g. `sha256-…` (unquoted).
 * @param {string} text
 * @returns {`sha256-${string}`}
 */
export function inlineScriptHash(text) {
  return `sha256-${createHash('sha256').update(normalizeNewlines(text), 'utf8').digest('base64')}`;
}
