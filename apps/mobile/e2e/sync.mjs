/**
 * The whole stack: the app, the server, and an account.
 *
 * `smoke.mjs` proves the app works on its own. This proves the part that only
 * exists once there are two of something: study on one "device", sign in on
 * another, and find the work there. It runs the real server on a real socket
 * and the real app bundle in a browser, with nothing stubbed between them.
 *
 *   TOKEN_PEPPER=... CORS_ORIGINS=http://127.0.0.1:PORT \
 *     npx expo export --platform web --output-dir dist
 *   node e2e/sync.mjs
 *
 * Because the app's API URL is baked into the bundle at export time, this
 * script exports the app itself, pointed at the server it just started.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';

const MOBILE = resolve(import.meta.dirname, '..');
const DIST = join(MOBILE, 'dist-sync');
const REPO = resolve(MOBILE, '..', '..');

const failures = [];
const check = (ok, what) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
};
const skip = (why) => { console.log(`SKIP: ${why}`); process.exit(0); };

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return null;
  for (const entry of readdirSync(root)) {
    const candidate = join(root, entry, 'chrome-linux', 'chrome');
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { skip('playwright-core is not installed'); }
const executablePath = findChromium();
if (!executablePath) skip('no Chromium found (set CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH)');

/** A static file server for the export; the router owns every path. */
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.svg': 'image/svg+xml',
};
async function serveStatic(root, port) {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let file = join(root, decodeURIComponent(url.pathname));
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    } catch { file = join(root, 'index.html'); }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch { response.writeHead(404).end('not found'); }
  });
  await new Promise((done) => server.listen(port, '127.0.0.1', done));
  return server;
}

const run = (command, args, options) => new Promise((done, fail) => {
  const child = spawn(command, args, { stdio: 'inherit', ...options });
  child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`${command} exited ${code}`))));
  child.on('error', fail);
});

// Fixed ports, because the app's API URL is baked in at export time.
const API_PORT = 8091;
const WEB_PORT = 8092;
const apiUrl = `http://127.0.0.1:${API_PORT}`;
const webUrl = `http://127.0.0.1:${WEB_PORT}`;

console.log('starting the server');
const { createApi } = await import(join(REPO, 'packages/server/src/http.ts'));
const { readConfig } = await import(join(REPO, 'packages/server/src/config.ts'));
const api = createApi(readConfig({
  NODE_ENV: 'test',
  // Ephemeral and never written down: this server lives for one test run.
  TOKEN_PEPPER: randomBytes(24).toString('base64url'),
  DATABASE_PATH: ':memory:',
  CORS_ORIGINS: webUrl,
}));
await api.listen(API_PORT);

console.log(`exporting the app against ${apiUrl}`);
await run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-sync', '--clear'], {
  cwd: MOBILE,
  env: {
    ...process.env,
    EXPO_PUBLIC_API_URL: apiUrl,
    EXPO_OFFLINE: '1',
    EXPO_NO_TELEMETRY: '1',
    CI: '1',
  },
});

const web = await serveStatic(DIST, WEB_PORT);
const browser = await chromium.launch({ executablePath });

const email = `learner-${randomBytes(4).toString('hex')}@example.com`;
const password = 'a long enough password';

/** One "device": its own browser context, so its own storage. */
async function device() {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(webUrl, { waitUntil: 'networkidle' });
  // Every fresh context is a fresh install, so it opens on the welcome flow.
  // Take the shortest way through it; placement is smoke.mjs's business.
  await page.waitForSelector('text=How much is a session?', { timeout: 30_000 });
  await page.locator('text="Start at the beginning"').filter({ visible: true }).first().click();
  await page.locator('text="Start"').filter({ visible: true }).first()
    .waitFor({ timeout: 30_000 });
  const tap = (label) =>
    page.locator(`text="${label}"`).filter({ visible: true }).first().click({ timeout: 15_000 });
  /**
   * Tab bar buttons, specifically.
   *
   * The screen a session pushes stays mounted underneath, so a tab's name can
   * match something in it as well. The tab bar is last in the document, so the
   * last match is the one that is actually the tab.
   */
  const tapTab = async (label) => {
    await page.waitForTimeout(400);
    await page.locator(`text="${label}"`).filter({ visible: true }).last()
      .click({ timeout: 15_000 });
    await page.waitForTimeout(400);
  };
  const body = () => page.innerText('body');
  const learned = async () => Number((await body()).match(/(\d+)\s*\n?\s*Learned/)?.[1] ?? '0');
  return { context, page, errors, tap, tapTab, body, learned };
}

try {
  console.log('device one: study, register, sync');
  const one = await device();

  // Signing in is never a wall: the profile offers an account, it does not
  // demand one before the app can be used.
  await one.tapTab('Profile');
  await one.page.waitForTimeout(800);
  const profile = await one.body();
  check(profile.includes('Account'), 'the account panel is on the profile before signing in');
  check(profile.includes('keeps your progress across devices'),
    'and says what an account is for rather than demanding one');
  await one.tapTab('Learn');
  await one.page.waitForTimeout(600);

  // Study a lesson, answering whatever is offered.
  await one.tap('Start');
  await one.page.waitForTimeout(1_200);
  const chrome = new Set(['Skip', 'Continue', 'Hint', 'Check', 'Learn', 'Lessons', 'Grammar', 'Search', 'Profile']);
  for (let i = 0; i < 40; i += 1) {
    if ((await one.body()).includes('Session finished')) break;
    const input = one.page.locator('input').filter({ visible: true }).first();
    if (await input.count() > 0) { await input.fill('wrong'); await one.tap('Check'); }
    else {
      const options = one.page.locator('[role="button"]').filter({ visible: true });
      const count = await options.count();
      let clicked = false;
      for (let k = 0; k < count; k += 1) {
        const label = (await options.nth(k).innerText()).trim();
        if (label && !chrome.has(label)) { await options.nth(k).click(); clicked = true; break; }
      }
      if (!clicked) { await one.tap('Skip'); continue; }
    }
    await one.page.waitForTimeout(250);
    if (/Correct|Almost|Not quite/.test(await one.body())) await one.tap('Continue');
    await one.page.waitForTimeout(150);
  }
  await one.tap('Back to lessons');
  await one.page.waitForTimeout(1_500);

  const studied = await one.learned();
  check(studied > 0, `device one learned something (${studied})`);

  await one.tapTab('Profile');
  await one.page.waitForTimeout(600);
  await one.tap('No account yet? Create one');
  await one.page.waitForTimeout(400);
  const fields = one.page.locator('input').filter({ visible: true });
  await fields.nth(0).fill(email);
  await fields.nth(1).fill(password);
  await one.tap('Create an account');
  await one.page.waitForTimeout(2_500);
  check((await one.body()).includes(email), 'device one is signed in');

  await one.tap('Sync now');
  await one.page.waitForTimeout(3_000);
  const sent = (await one.body()).match(/Sent (\d+), received (\d+)\./);
  check(Boolean(sent), `the sync reported what it did (${sent?.[0] ?? 'nothing'})`);
  check(Number(sent?.[1] ?? 0) > 0, 'device one sent its progress');

  console.log('device two: sign in, sync, find the work');
  const two = await device();
  check(await two.learned() === 0, 'device two starts empty');

  await two.tapTab('Profile');
  await two.page.waitForTimeout(600);
  const twoFields = two.page.locator('input').filter({ visible: true });
  await twoFields.nth(0).fill(email);
  await twoFields.nth(1).fill(password);
  await two.tap('Sign in');
  await two.page.waitForTimeout(2_500);
  check((await two.body()).includes(email), 'device two is signed in');

  await two.tap('Sync now');
  await two.page.waitForTimeout(3_000);
  const received = (await two.body()).match(/Sent (\d+), received (\d+)\./);
  check(Number(received?.[2] ?? 0) > 0, `device two received records (${received?.[0] ?? 'nothing'})`);

  await two.tapTab('Learn');
  await two.page.waitForTimeout(1_200);
  const arrived = await two.learned();
  check(arrived === studied,
    `THE thing: the work crossed devices (${arrived} on device two, ${studied} on device one)`);

  console.log('a wrong password is refused');
  const three = await device();
  await three.tapTab('Profile');
  await three.page.waitForTimeout(600);
  const threeFields = three.page.locator('input').filter({ visible: true });
  await threeFields.nth(0).fill(email);
  await threeFields.nth(1).fill('not the password');
  await three.tap('Sign in');
  await three.page.waitForTimeout(2_000);
  const refused = await three.body();
  check(/Wrong email address or password/.test(refused), 'the wrong password is refused');
  check(!refused.includes(`Signed in as ${email}`), 'and does not sign anyone in');

  check([...one.errors, ...two.errors, ...three.errors].length === 0,
    `no page errors (${[...one.errors, ...two.errors, ...three.errors].slice(0, 2).join(' / ')})`);
} finally {
  await browser.close();
  web.close();
  await api.close();
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
