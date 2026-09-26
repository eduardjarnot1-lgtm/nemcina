import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const p = await b.newPage({ viewport: { width: 390, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));
const tap = async (l) => { await p.locator(`text=${l}`).filter({visible:true}).first().click({timeout:6000}); await p.waitForTimeout(400); };
await p.goto('http://localhost:8205/', { waitUntil: 'networkidle' });
await p.waitForTimeout(1400);
await tap('8 words'); await tap('Start at the beginning'); await p.waitForTimeout(900);
await tap('Start'); await p.waitForTimeout(1000);
const skip = new Set(['Check','Skip','Continue','Learn','Lessons','Grammar','Search','Profile','Practise','Show hint','Start']);
for (let i = 0; i < 26; i++) {
  if (/Back to lessons/.test(await p.evaluate(() => document.body.innerText))) break;
  const input = p.locator('input').filter({visible:true}).first();
  if (await input.count()) { await input.fill('x'); await p.locator('text=Check').filter({visible:true}).first().click({timeout:3000}).catch(()=>{}); }
  else { const o = p.locator('[role="button"]').filter({visible:true}); const c = await o.count();
    for (let k=0;k<c;k++){ const s=(await o.nth(k).innerText().catch(()=>'')).trim();
      if (s && !skip.has(s) && !s.includes('·')) { await o.nth(k).click({timeout:2500}).catch(()=>{}); break; } } }
  await p.waitForTimeout(200);
  await p.locator('text=Continue').filter({visible:true}).first().click({timeout:2000}).catch(()=>{});
  await p.waitForTimeout(150);
}
await p.waitForTimeout(1200);
console.log('RESULTS:', (await p.evaluate(() => document.body.innerText)).split('\n').filter(Boolean).slice(0,6).join(' | '));
await p.screenshot({ path: '/tmp/claude-0/c-results2.png', fullPage: true });
const learned = async () => (await p.evaluate(() => document.body.innerText)).match(/(\d+)\nLearned/)?.[1];
await p.locator('text=Back to lessons').first().click({timeout:5000}).catch(()=>{});
await p.waitForTimeout(1300);
const before = await learned();
await p.reload({ waitUntil: 'networkidle' }); await p.waitForTimeout(2400);
console.log(`learned before reload ${before} | after ${await learned()}`);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
