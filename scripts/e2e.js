const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  assert.equal(await page.title(), '腦筋急轉色｜色字反應挑戰');
  assert.equal(await page.locator('#pause-overlay').evaluate((el) => getComputedStyle(el).display), 'none');

  await page.click('[data-profile="senior"]');
  assert.ok((await page.locator('[data-difficulty="easy"] small').textContent()).includes('四色常駐'));
  await page.click('#back-home');
  await page.click('[data-profile="child"]');
  await page.click('[data-mode="mixed"]');
  await page.click('[data-difficulty="hard"]');
  assert.ok(await page.locator('body').evaluate((el) => el.classList.contains('profile-child')));
  await page.click('#start-game');
  await page.waitForTimeout(3000);
  assert.ok(await page.locator('#game-screen').evaluate((el) => el.classList.contains('active')));
  assert.equal(await page.locator('.answer').count(), 4);
  assert.equal(await page.locator('#question-bar').count(), 0);
  const promptBeforeWait = await page.locator('#prompt-word').textContent();
  await page.waitForTimeout(5500);
  assert.equal(await page.locator('#prompt-word').textContent(), promptBeforeWait);
  assert.equal(await page.locator('.answer:not(:disabled)').count(), 4);

  const answerId = await page.evaluate(() => {
    const rule = document.querySelector('#rule-badge').textContent;
    const word = document.querySelector('#prompt-word');
    const wordIds = { '紅': 'red', '黃': 'yellow', '藍': 'blue', '綠': 'green' };
    const colorIds = { 'rgb(229, 72, 77)': 'red', 'rgb(242, 189, 46)': 'yellow', 'rgb(40, 120, 255)': 'blue', 'rgb(21, 155, 104)': 'green' };
    return rule === '看字義' ? wordIds[word.textContent] : colorIds[getComputedStyle(word).color];
  });
  await page.click(`[data-answer="${answerId}"]`);
  assert.ok(Number(await page.locator('#score').textContent()) > 0);

  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  assert.ok(await page.locator('#pause-overlay').evaluate((el) => el.classList.contains('active')));
  await page.click('#resume-game');
  await page.waitForTimeout(3000);
  assert.equal(await page.locator('#pause-overlay').evaluate((el) => getComputedStyle(el).display), 'none');
  await page.waitForTimeout(61000);
  assert.ok(await page.locator('#result-screen').evaluate((el) => el.classList.contains('active')));
  assert.ok((await page.locator('#result-accuracy').textContent()).endsWith('%'));
  assert.ok((await page.locator('#result-average').textContent()).endsWith('s'));

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  mobile.on('pageerror', (error) => errors.push(error.message));
  await mobile.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' });
  const dimensions = await mobile.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
  assert.ok(dimensions.page <= dimensions.viewport, `手機版水平溢出：${dimensions.page} > ${dimensions.viewport}`);
  assert.equal(await mobile.locator('[data-profile]').count(), 3);
  await mobile.screenshot({ path: 'mobile-home.png', fullPage: true });
  assert.deepEqual(errors, []);
  await browser.close();
  console.log('桌面與手機流程、答題、暫停續玩及版面檢查通過');
})().catch((error) => { console.error(error); process.exit(1); });
