import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

// Executes repository TS with explicit boundary doubles. Never opens a DB.
export function sourceLoader({ root = process.cwd(), dev = false, mocks = {}, globals = {} } = {}) {
  const cache = new Map(Object.entries(mocks).map(([file, value]) => [path.resolve(root, file), value]));
  function load(relative) {
    let file = path.resolve(root, relative);
    if (!existsSync(file) && !cache.has(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file);
    if (file.endsWith('.json')) return JSON.parse(readFileSync(file, 'utf8'));
    const exports = {};
    cache.set(file, exports);
    const source = readFileSync(file, 'utf8').replaceAll('import.meta.env.DEV', String(dev)).replaceAll('import.meta.env.PUBLIC_FP_PREVIEW_DRAFTS', 'undefined');
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const require = (specifier) => specifier.startsWith('.') ? load(path.resolve(path.dirname(file), specifier)) : createRequire(file)(specifier);
    vm.runInNewContext(code, { exports, require, console, URL, URLSearchParams, AbortSignal, Event, Date, setTimeout, clearTimeout, ...globals }, { filename: file });
    return exports;
  }
  return load;
}
