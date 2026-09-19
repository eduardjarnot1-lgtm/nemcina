/**
 * Turn `expo export --platform web` output into something a static host can
 * serve from a subdirectory.
 *
 * Expo's web export assumes it owns the root of a domain: the page links its
 * bundle as `/_expo/...` and the bundle asks for its icons at `/assets/...`.
 * Served from a folder — which is how most previews, artifact hosts and
 * project pages work — every one of those is a 404.
 *
 * Five changes, all mechanical:
 *
 *   1. Every script moves out of `_expo/`, because a leading underscore is a
 *      reserved prefix on several static hosts.
 *   2. The API URL compiled into the bundle is checked (see below).
 *   3. Absolute asset paths in the bundle become relative, so they resolve
 *      against wherever the page is served from.
 *   4. The same for the lazy chunks. A dynamic `import()` makes Metro split
 *      the bundle and write a map of chunk paths into the entry script, all
 *      of them rooted at `/_expo/...`, and a root-absolute path ignores the
 *      folder the page is served from — so every lazy chunk 404s. Metro
 *      resolves a relative one against `location.origin + location.pathname`
 *      (the page, not the script that asks), so the rewrite is page-relative:
 *      `bundle/<chunk>.js`, matching the <script> tags on the page itself.
 *   5. `index.html` is rewritten to the shape an embedding host expects — no
 *      <html>/<head>/<body> wrapper, relative script tags, and a shim that
 *      holds the address still so a reload finds the app again.
 *
 * Expo has a supported option for this, `experiments.baseUrl`, and it is the
 * better answer whenever the path is known at build time. It is baked into the
 * bundle, so it cannot be used when the host assigns the path afterwards.
 *
 *   node tools/prepare-web-artifact.mjs dist out
 *
 * One guard lives here: the API URL compiled into the bundle is read back and
 * refused if it points at the machine doing the build. See step 2.
 */
import { cp, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { assertApiUrl } from './assert-api-url.mjs';

const [source = 'dist', target = 'web-artifact'] = process.argv.slice(2);
const from = resolve(source);
const to = resolve(target);

if (!existsSync(join(from, 'index.html'))) {
  console.error(`no export in ${from} — run: npx expo export --platform web --output-dir ${source}`);
  process.exit(1);
}

await rm(to, { recursive: true, force: true });
await cp(from, to, { recursive: true });
// Build metadata is for the build, not for the people using the page.
await rm(join(to, 'metadata.json'), { force: true });

// 1. Move every script somewhere no host reserves.
//
// Metro emits the scripts the page loads up front (its runtime, the shared
// module, the entry) alongside the chunks it fetches later. Only the first
// group appears in index.html, and their order matters, so the order is taken
// from the page Expo generated rather than guessed at.
const webDir = join(to, '_expo', 'static', 'js', 'web');
const scripts = existsSync(webDir) ? (await readdir(webDir)).filter((f) => f.endsWith('.js')) : [];
if (scripts.length === 0) {
  console.error(`no bundle in _expo/static/js/web`);
  process.exit(1);
}

const generated = await readFile(join(from, 'index.html'), 'utf8');
const eager = [...generated.matchAll(/<script src="\/_expo\/static\/js\/web\/([^"]+)"/g)].map((m) => m[1]);
const missing = eager.filter((name) => !scripts.includes(name));
if (eager.length === 0 || missing.length > 0) {
  console.error(
    missing.length > 0
      ? `index.html loads ${missing.join(', ')}, which the export did not produce`
      : 'index.html loads no bundle — the export looks incomplete',
  );
  process.exit(1);
}

await mkdir(join(to, 'bundle'), { recursive: true });
for (const name of scripts) {
  await rename(join(webDir, name), join(to, 'bundle', name));
}
await rm(join(to, '_expo'), { recursive: true, force: true });

// 2. The API URL is checked before anything is published. The Pages build
// runs the same check; see tools/assert-api-url.mjs for why it reads the
// compiled constant rather than scanning for loopback strings.
const apiUrl = await assertApiUrl(
  scripts.map((name) => join(to, 'bundle', name)),
  'EXPO_PUBLIC_API_URL= npx expo export --platform web --output-dir dist --clear',
);

// 3. Absolute asset and chunk paths become relative, in every script.
let fixedAssets = 0;
let fixedChunks = 0;
for (const name of scripts) {
  const path = join(to, 'bundle', name);
  const script = await readFile(path, 'utf8');
  fixedAssets += (script.match(/"\/assets\//g) ?? []).length;
  fixedChunks += (script.match(/"\/_expo\/static\/js\/web\//g) ?? []).length;
  await writeFile(
    path,
    script.replaceAll('"/assets/', '"assets/').replaceAll('"/_expo/static/js/web/', '"bundle/'),
  );
}

// Nothing may still point into the directory that no longer exists.
for (const name of scripts) {
  const script = await readFile(join(to, 'bundle', name), 'utf8');
  if (script.includes('/_expo/static/js/web/')) {
    throw new Error(`${name} still references _expo/static/js/web after rewriting`);
  }
}

// 4. The page itself.
await writeFile(join(to, 'index.html'), `<title>Němčina</title>
<style>
  /* react-native-web wants a full-height root. An embedding host may pad the
     root element for safe areas, which would push that past the bottom of the
     screen; the app handles its own insets through SafeAreaProvider. */
  :root { padding: 0 !important; }
  html, body { height: 100%; margin: 0; overflow: hidden; background: #f7f7f9; }
  #root { display: flex; height: 100%; flex: 1; }
</style>
<div id="root"></div>
<script>
  /*
   * Hold the address still.
   *
   * The router writes absolute paths — "/lessons", "/grammar" — which on a host
   * serving this app from a folder walk the address somewhere the host has
   * nothing to serve, so a reload lands on a 404 instead of the app. Screens
   * are chosen from the navigation state once the app is running; the URL is
   * only read at boot. So every history write is pinned to the folder this page
   * came from, and a reload always finds the app again.
   *
   * The cost is the back button, which returns here rather than to the previous
   * screen. On a page opened from a link that is the smaller loss.
   *
   * Swallowing a refusal matters more than the address: a sandbox that forbids
   * history writes should cost the URL bar, not the tap.
   */
  (function () {
    var here = location.pathname.replace(/[^/]*$/, '');
    if (here === '/') return;
    ['pushState', 'replaceState'].forEach(function (name) {
      var original = history[name].bind(history);
      history[name] = function (state) {
        try { return original(state, '', here); } catch (error) { return undefined; }
      };
    });
  })();
</script>
${eager.map((name) => `<script src="bundle/${name}" defer></script>`).join('\n')}
`);

console.log(`prepared ${to}`);
console.log(`  ${eager.length} script(s) loaded by the page, ${scripts.length - eager.length} lazy chunk(s)`);
console.log(`  ${fixedAssets} absolute asset paths made relative`);
console.log(`  ${fixedChunks} absolute chunk paths made relative`);
console.log(`  API_URL = ${apiUrl === '' ? '(unset — Firebase accounts)' : apiUrl}`);
