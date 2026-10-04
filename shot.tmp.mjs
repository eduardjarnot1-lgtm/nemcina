import { chromium } from 'playwright-core';
import { appendFileSync } from 'node:fs';
const PORT = process.argv[2], TAG = process.argv[3], OUT = process.argv[4];
const LOG = `${OUT}/${TAG}.log`;
const say = m => appendFileSync(LOG, m + '\n');
const TOPICS = [
  ['regular-verbs', 'g-daf-a1-regular-verbs-in-the-present-tense'],
  ['def-article',   'g-daf-a2-inflections-with-the-definite-article'],
  ['adj-endings',   'g-daf-a2-adjectives-after-the-definite-article'],
  ['subordinate',   'g-daf-a2-expressing-reasons-dependent-clauses-wit'],
];
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [w, h, size] of [[390, 900, 'mobile'], [1280, 1000, 'desktop']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  // Onboard once per context so the app is past its welcome flow.
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2200);
  for (const label of ['8 words', 'Start at the beginning']) {
    await p.locator(`text=${label}`).filter({ visible: true }).first().click({ timeout: 8000 }).catch(() => {});
    await p.waitForTimeout(400);
  }
  for (const [name, id] of TOPICS) {
    await p.evaluate((x) => { window.history.pushState({}, '', x); window.dispatchEvent(new PopStateEvent('popstate')); },
      `/grammar/${encodeURIComponent(id)}`);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${OUT}/${TAG}-${size}-${name}.png`, fullPage: true });
    const text = await p.evaluate(() => document.body.innerText);
    say(`[${size}] ${name}: ${text.split('\n').filter(Boolean).slice(0, 8).join(' | ')}`);
  }
  say(`[${size}] console errors: ${errs.length ? errs.slice(0,2).join(' | ') : 'none'}`);
  await p.close();
}
await b.close();
