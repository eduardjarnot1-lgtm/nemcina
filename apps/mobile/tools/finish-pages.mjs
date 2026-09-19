/**
 * Finish a GitHub Pages export.
 *
 * `expo export` with `EXPO_BASE_URL` already writes every path under the
 * prefix, so unlike the artifact build there is nothing to rewrite. Two things
 * are still needed before it is safe to publish:
 *
 *   1. A `404.html`. Pages is a static host: it serves a file per path and
 *      knows nothing about the router, so `/nemcina/lessons` — a real link the
 *      app writes and a reader may bookmark — has no file behind it. Pages
 *      serves `404.html` for any path it cannot find, so a copy of the page
 *      boots the app, which then reads the URL and shows that screen. The
 *      address stays correct, which is why this beats pinning it.
 *
 *   2. The API URL check, the same one the artifact build runs. Two ways to
 *      publish must not mean one of them is unguarded.
 *
 *   node tools/finish-pages.mjs dist-pages
 */
import { copyFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { assertApiUrl } from './assert-api-url.mjs';

const [target = 'dist-pages'] = process.argv.slice(2);
const dist = resolve(target);
const page = join(dist, 'index.html');

if (!existsSync(page)) {
  console.error(`no export in ${dist} — run: npm run build:pages`);
  process.exit(1);
}

const webDir = join(dist, '_expo', 'static', 'js', 'web');
const scripts = existsSync(webDir)
  ? (await readdir(webDir)).filter((f) => f.endsWith('.js')).map((f) => join(webDir, f))
  : [];
if (scripts.length === 0) {
  console.error('no bundle in _expo/static/js/web — the export looks incomplete');
  process.exit(1);
}

const apiUrl = await assertApiUrl(scripts, 'npm run build:pages');

await copyFile(page, join(dist, '404.html'));

console.log(`pages build ready in ${dist}`);
console.log(`  ${scripts.length} script(s), API_URL = ${apiUrl === '' ? '(unset — Firebase accounts)' : apiUrl}`);
console.log('  404.html written, so deep links and reloads resolve');
