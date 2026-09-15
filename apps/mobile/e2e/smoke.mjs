/**
 * The app, driven the way a person drives it.
 *
 * Unit tests prove the engine's arithmetic; nothing in them would have noticed
 * that the first question offered four sentences as the possible meanings of a
 * word. This runs the real bundle in a real browser and walks the real flow:
 * open a lesson, answer it to the end, come back, search, reload, and check the
 * progress is still there.
 *
 * It drives the web export rather than a simulator, because the web export runs
 * the same React Native components through react-native-web — the screens, the
 * engine, the storage adapter and the router are all the shipped ones. What it
 * does NOT cover is anything native: gestures, the keyboard, notifications, and
 * how any of this looks on a real device. Those still need a device.
 *
 *   npx expo export --platform web --output-dir dist
 *   node e2e/smoke.mjs
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import process from 'node:process';

const DIST = resolve(import.meta.dirname, '..', 'dist');
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
};

function skip(why) {
  console.log(`SKIP: ${why}`);
  process.exit(0);
}

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

/**
 * Serve `dist/`, falling back to index.html.
 *
 * The router owns the path, so /lessons is a route and not a missing file;
 * serving a 404 there would fail the test for the wrong reason.
 */
async function serve() {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    let file = join(DIST, decodeURIComponent(url.pathname));
    try {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    } catch {
      file = join(DIST, 'index.html');
    }
    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404).end('not found');
    }
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}/` };
}

const failures = [];
function check(condition, description) {
  if (condition) console.log(`  ok   ${description}`);
  else { console.log(`  FAIL ${description}`); failures.push(description); }
}

if (!existsSync(join(DIST, 'index.html'))) {
  skip('no web export in dist/ — run `npx expo export --platform web --output-dir dist` first');
}

let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  skip('playwright-core is not installed');
}
const executablePath = findChromium();
if (!executablePath) skip('no Chromium found (set CHROMIUM_PATH or PLAYWRIGHT_BROWSERS_PATH)');

const { server, url } = await serve();
const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

const text = async () => (await page.innerText('body')).replace(/\s*\n\s*/g, ' | ');
const tap = async (label) =>
  page.locator(`text="${label}"`).filter({ visible: true }).first().click({ timeout: 15_000 });

try {
  console.log('the course loads');
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Start', { timeout: 30_000 });
  const home = await text();
  check(/Lesson 1 of \d+/.test(home), 'the home screen offers a first lesson');
  check(home.includes('Learned'), 'progress totals are on screen');

  console.log('a lesson can be finished');
  await tap('Start');
  await page.waitForTimeout(1_200);

  const first = await text();
  check(first.includes('What does this mean?'), 'a new learner is asked to recognise, not to spell');
  // The bug this test exists for: options must be word meanings, not sentences.
  const options = await page.locator('[role="button"]').filter({ visible: true }).allInnerTexts();
  const chrome = new Set(['Skip', 'Continue', 'Hint', 'Check', 'Learn', 'Lessons', 'Search', 'Profile']);
  const answers = options.map((o) => o.trim()).filter((o) => o && !chrome.has(o));
  check(answers.length >= 4, 'a multiple choice offers four answers');
  check(answers.every((a) => a.split(/\s+/).length < 8),
    `no answer is a sentence (${answers.map((a) => JSON.stringify(a)).join(', ')})`);

  let finished = false;
  for (let i = 0; i < 60 && !finished; i += 1) {
    const body = await page.innerText('body');
    if (body.includes('Session finished')) { finished = true; break; }
    const input = page.locator('input').filter({ visible: true }).first();
    if (await input.count() > 0) {
      await input.fill('definitely wrong');
      await tap('Check');
    } else {
      const choices = page.locator('[role="button"]').filter({ visible: true });
      const count = await choices.count();
      let clicked = false;
      for (let k = 0; k < count; k += 1) {
        const label = (await choices.nth(k).innerText()).trim();
        if (label && !chrome.has(label)) { await choices.nth(k).click(); clicked = true; break; }
      }
      if (!clicked) { await tap('Skip'); continue; }
    }
    await page.waitForTimeout(300);
    if ((await page.innerText('body')).match(/Correct|Almost|Not quite/)) await tap('Continue');
    await page.waitForTimeout(200);
  }
  check(finished, 'the session reaches its summary instead of looping forever');
  const summary = await text();
  check(/\d+ words studied/.test(summary), 'the summary says how much was studied');
  check(/\d+% right first time/.test(summary), 'the summary reports first-attempt accuracy');

  console.log('progress is kept');
  await tap('Back to lessons');
  await page.waitForTimeout(1_000);
  const learned = Number((await page.innerText('body')).match(/(\d+)\s*\n?\s*Learned/)?.[1] ?? '0');
  check(learned > 0, `answers moved the learned count (${learned})`);

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(4_000);
  const afterReload = Number((await page.innerText('body')).match(/(\d+)\s*\n?\s*Learned/)?.[1] ?? '0');
  check(afterReload === learned, `progress survives a restart (${afterReload} of ${learned})`);

  console.log('search');
  await tap('Search');
  await page.waitForTimeout(600);
  const field = page.locator('input').filter({ visible: true }).first();
  await field.fill('strasse');
  await page.waitForTimeout(1_000);
  check((await page.innerText('body')).includes('Straße'),
    'a learner with no umlaut key still finds Straße');

  await field.fill('Alphabet');
  await page.waitForTimeout(1_000);
  const alphabet = await page.innerText('body');
  check(alphabet.includes('alphabet'), 'Alphabet is glossed');
  check(!alphabet.includes('How many letters are there'),
    'and is not glossed with its example sentence');

  console.log('grammar');
  await tap('Grammar');
  await page.waitForTimeout(900);
  const index = await page.innerText('body');
  check(/\d+ topics/.test(index), 'the grammar index lists its topics');
  // Open the first topic, which is whatever the A1 list leads with.
  const firstTopic = page.locator('text=/exercises/').filter({ visible: true }).first();
  await firstTopic.click({ timeout: 15_000 });
  await page.waitForTimeout(900);
  const topic = await page.innerText('body');
  check(topic.includes('From '), 'a topic credits the source it came from');
  check(/Rules|Examples/.test(topic), 'a topic shows its explanation');

  await tap('Practise');
  await page.waitForTimeout(1_000);
  const beforeAnswer = await page.innerText('body');
  check(beforeAnswer.includes('Check') || beforeAnswer.includes('Skip'),
    'a grammar exercise is on screen');

  const grammarInput = page.locator('input').filter({ visible: true }).first();
  if (await grammarInput.count() > 0) {
    await grammarInput.fill('definitely wrong');
    await tap('Check');
  } else {
    const choices = page.locator('[role="button"]').filter({ visible: true });
    const count = await choices.count();
    for (let k = 0; k < count; k += 1) {
      const label = (await choices.nth(k).innerText()).trim();
      if (label && !chrome.has(label) && label !== 'Practise') {
        await choices.nth(k).click();
        break;
      }
    }
  }
  await page.waitForTimeout(700);
  const afterAnswer = await page.innerText('body');
  check(/Correct|Almost|Not quite/.test(afterAnswer), 'the answer is judged');

  // The explanation is the point of a grammar exercise, so it has to appear —
  // as a line of real prose that was not on the question screen.
  const before = new Set(beforeAnswer.split('\n').map((line) => line.trim()));
  const explanation = afterAnswer.split('\n')
    .map((line) => line.trim())
    .find((line) => line.length >= 20 && !before.has(line) && !/^Answer:/.test(line));
  check(Boolean(explanation), `an explanation is shown with the verdict (${explanation ?? 'none'})`);

  console.log('browsing');
  // Practice is a screen pushed over the tabs, so the tab bar is not reachable
  // from here — go back to it the way a person would.
  await page.goBack();
  await page.waitForTimeout(600);
  await page.goBack();
  await page.waitForTimeout(900);
  await tap('Lessons');
  await page.waitForTimeout(800);
  await tap('By topic');
  await page.waitForTimeout(800);
  check((await page.innerText('body')).includes('words'), 'topic lessons list their size');

  check(consoleErrors.length === 0, `no console errors (${consoleErrors.slice(0, 3).join(' / ')})`);
} finally {
  await browser.close();
  server.close();
}

if (failures.length > 0) {
  console.log(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
