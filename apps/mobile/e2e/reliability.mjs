/** Real web-export checks for storage failure, retries and cold-start review. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { newProgress, review } from '../../../packages/core/src/srs.ts';

const dist = resolve(import.meta.dirname, '..', 'dist');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon' };
const server = createServer(async (request, response) => {
  let file = join(dist, decodeURIComponent(new URL(request.url, 'http://localhost').pathname));
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); }
  catch { file = join(dist, 'index.html'); }
  try { response.writeHead(200, { 'Content-Type': mime[extname(file)] ?? 'application/octet-stream' }); response.end(await readFile(file)); }
  catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const errors = [];
let checks = 0;
const check = (value, label) => { assert.ok(value, label); checks++; console.log(`ok ${label}`); };
async function open(options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(({ records = [], failRead = false, failWrite = false }) => {
    localStorage.setItem('nemcina:preferences:v1', JSON.stringify({ onboarded: true, dailyGoal: 8, startingLevel: 'A1' }));
    if (!localStorage.getItem('nemcina:v1:progress')) localStorage.setItem('nemcina:v1:progress', JSON.stringify(records));
    const originalRead = Storage.prototype.getItem;
    const originalWrite = Storage.prototype.setItem;
    let readFailed = false;
    window.failAnswerWrites = failWrite;
    Storage.prototype.getItem = function(key) {
      if (failRead && !readFailed && key === 'nemcina:v1:progress') {
        readFailed = true;
        throw new Error('Simulated unavailable storage');
      }
      return originalRead.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (window.failAnswerWrites && key === 'nemcina:v1:attempts') throw new Error('Simulated full storage');
      return originalWrite.call(this, key, value);
    };
  }, options);
  return { page, context };
}
const button = (page, label) => page.getByRole('button', { name: label, exact: true }).filter({ visible: true }).first();

try {
  {
    const { page, context } = await open({ failRead: true });
    await page.goto(base);
    await button(page, 'Try loading again').waitFor();
    check((await page.innerText('body')).includes('Your progress could not be loaded'), 'read failure is visible');
    await button(page, 'Try loading again').click();
    await button(page, 'Start').waitFor();
    check((await page.innerText('body')).includes('Daily goal'), 'retry restores the learning screen');
    await context.close();
  }
  {
    const { page, context } = await open({ failWrite: true });
    await page.goto(base);
    await button(page, 'Start').click();
    const choices = page.getByRole('button').filter({ visible: true });
    await page.getByText('What does this mean?', { exact: true }).waitFor();
    // Exercise options precede Skip; native header controls have no text.
    const choice = choices.filter({ hasText: /\S/ }).filter({ hasNotText: /^(Skip|Back)$/ }).first();
    await choice.evaluate(element => { element.click(); element.click(); });
    await button(page, 'Retry saving').waitFor();
    check(await button(page, 'Continue').isDisabled(), 'cannot continue with an unsaved answer');
    await page.evaluate(() => { window.failAnswerWrites = false; });
    await button(page, 'Retry saving').click();
    await page.waitForFunction(() => !document.body.innerText.includes('Retry saving'));
    check(await button(page, 'Continue').isEnabled(), 'successful retry enables continuing');
    const history = await page.evaluate(() => JSON.parse(localStorage.getItem('nemcina:v1:attempts')));
    check(history.attempts.length === 1, 'double tap and retry record the answer once');
    check(history.days.reduce((n, d) => n + d.count, 0) === 1, 'daily activity counts the answer once');
    await page.goto(base);
    await page.getByText('Daily goal', { exact: true }).waitFor();
    check((await page.innerText('body')).includes('1 / 8 answers'), 'retried answer survives reopening');
    if (process.env.SCREENSHOT_DIR) {
      await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
      await page.screenshot({ path: join(process.env.SCREENSHOT_DIR, 'daily-goal-mobile.png'), fullPage: true });
    }
    await context.close();
  }
  {
    const vocabulary = JSON.parse(await readFile(new URL('../../../app/data/vocabulary.json', import.meta.url), 'utf8'));
    const word = vocabulary.words[0];
    const record = review(newProgress('local', word.id), 3, { now: Date.now() - 20 * 86_400_000 });
    const { page, context } = await open({ records: [record] });
    await page.goto(`${base}/session/review`);
    await button(page, 'Skip').waitFor();
    check(!(await page.innerText('body')).includes('Nothing is due'), 'direct review waits for saved progress');
    check((await page.locator('input').count()) > 0 || (await page.getByRole('button').count()) > 1,
      'a due word is available on a cold start');
    await context.close();
  }
  check(errors.length === 0, `no uncaught browser errors: ${errors.join('; ')}`);
  console.log(`${checks} reliability checks passed`);
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
