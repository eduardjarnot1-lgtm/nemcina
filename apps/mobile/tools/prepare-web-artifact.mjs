/**
 * Turn `expo export --platform web` output into something a static host can
 * serve from a subdirectory.
 *
 * Expo's web export assumes it owns the root of a domain: the page links its
 * bundle as `/_expo/...` and the bundle asks for its icons at `/assets/...`.
 * Served from a folder — which is how most previews, artifact hosts and
 * project pages work — every one of those is a 404.
 *
 * Three changes, all mechanical:
 *
 *   1. The bundle moves out of `_expo/`, because a leading underscore is a
 *      reserved prefix on several static hosts.
 *   2. Absolute asset paths in the bundle become relative, so they resolve
 *      against wherever the page is served from.
 *   3. `index.html` is rewritten to the shape an embedding host expects — no
 *      <html>/<head>/<body> wrapper, a relative script tag, and a shim that
 *      holds the address still so a reload finds the app again.
 *
 * Expo has a supported option for this, `experiments.baseUrl`, and it is the
 * better answer whenever the path is known at build time. It is baked into the
 * bundle, so it cannot be used when the host assigns the path afterwards.
 *
 *   node tools/prepare-web-artifact.mjs dist out
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

// 1. Move the bundle somewhere no host reserves.
const webDir = join(to, '_expo', 'static', 'js', 'web');
const entries = existsSync(webDir) ? (await readdir(webDir)).filter((f) => f.endsWith('.js')) : [];
if (entries.length !== 1) {
  console.error(`expected exactly one bundle in _expo/static/js/web, found ${entries.length}`);
  process.exit(1);
}
await mkdir(join(to, 'bundle'), { recursive: true });
const bundlePath = join('bundle', entries[0]);
await rename(join(webDir, entries[0]), join(to, bundlePath));
await rm(join(to, '_expo'), { recursive: true, force: true });

// 2. Absolute asset paths become relative.
const bundle = await readFile(join(to, bundlePath), 'utf8');
const rewritten = bundle.replaceAll('"/assets/', '"assets/');
const fixed = (bundle.match(/"\/assets\//g) ?? []).length;
await writeFile(join(to, bundlePath), rewritten);

// 3. The page itself.
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
<script src="${bundlePath}" defer></script>
`);

console.log(`prepared ${to}`);
console.log(`  bundle at ${bundlePath}`);
console.log(`  ${fixed} absolute asset paths made relative`);
