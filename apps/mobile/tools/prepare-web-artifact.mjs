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

// 2. The API URL is checked before anything is published.
//
// `e2e/sync.mjs` exports the app with EXPO_PUBLIC_API_URL pointing at its own
// local server, and Metro caches that inlined value — so a later `expo export`
// without `--clear` reuses it and ships a build that tries to reach a server on
// the reader's own machine. That shipped once. It does not get to ship twice.
//
// The check reads the one value that matters rather than scanning for loopback
// strings, because a scan does not hold: the Firebase Auth SDK carries
// `http://localhost` as an OAuth request literal, so a scan either fails on
// every build or needs a vendor exception that would also hide a real one.
// `src/api.ts` compiles to a string constant and the predicate built from it:
//
//   const t='',o=()=>t.trim().length>0
//
// Both quote styles have been seen from the same source — the minifier picks
// whichever escapes less — so the pattern accepts either.
//
// Failing to find it is itself a failure. A gate that cannot see what it guards
// is not a gate, and silently passing is how the first bad build got out.
const apiUrlPattern = /const (\w+)=(["'])((?:\\.|(?!\2)[^\\])*)\2,\w+=\(\)=>\1\.trim\(\)\.length>0/;
let apiUrl = null;
for (const name of scripts) {
  const found = (await readFile(join(to, 'bundle', name), 'utf8')).match(apiUrlPattern);
  if (found) apiUrl = found[3];
}
if (apiUrl === null) {
  throw new Error(
    'could not find the compiled API_URL in the export, so it cannot be checked.\n'
    + 'src/api.ts or the minifier changed shape — update the pattern in this script\n'
    + 'rather than publishing an unchecked bundle.',
  );
}
if (/^https?:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:\/|$)/i.test(apiUrl)) {
  throw new Error(
    `the bundle has a loopback API URL baked in (${apiUrl}).\n`
    + "It would send every reader's account requests to their own machine.\n"
    + 'This is Metro reusing a cached transform from e2e/sync.mjs.\n'
    + 'Re-export with a cleared cache before publishing:\n'
    + '  EXPO_PUBLIC_API_URL= npx expo export --platform web --output-dir dist --clear',
  );
}

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
