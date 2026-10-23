import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createDashboardServer } from '../dashboard/server.mjs';

test('Układ Hurtowni: nawigacja, scenariusze i logi w obu motywach oraz na małych ekranach', { timeout: 60000 }, async () => {
  let runs = 0;
  const server = createDashboardServer({ runSuite: async () => { runs++; throw Error('Test wyglądu nie uruchamia zestawów'); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ channel: 'msedge' });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let writes = 0;
    await page.route('**/api/**', route => {
      if (route.request().method() !== 'GET') { writes++; return route.abort(); }
      return route.continue();
    });
    await page.goto(base);
    await page.waitForFunction(() => document.body.dataset.activeView === 'dashboard' && document.querySelector('#home-scenarios').textContent !== '—');
    const views = ['dashboard', 'start', 'scenarios', 'run-status', 'reports', 'wizard', 'create-product', 'api', 'documentation', 'settings', 'debugger'];
    for (const theme of ['light', 'dark']) {
      await page.locator('#qa-theme-mode').selectOption(theme);
      for (const width of [1440, 1024, 390]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const view of views) {
          await page.evaluate(view => setView(view), view);
          assert.equal(await page.locator(`#view-${view}`).isVisible(), true, `${view} visible`);
          assert.equal(await page.locator('.qa-sidebar nav [aria-current=page]').count(), 1);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, `${theme} ${width} ${view} overflow`);
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.evaluate(() => setView('scenarios'));
    await page.locator('.scenario-accordion:not([open]) > summary').first().click();
    assert.equal(await page.locator('#scenario-detail').isVisible(), true);
    assert.equal(await page.locator('#scenario-detail .scenario-description-grid').isVisible(), true);
    await page.locator('#scenario-search').fill('NIEISTNIEJACY_SCENARIUSZ_123');
    assert.match(await page.locator('#scenario-list').innerText(), /Brak wyników/);
    await page.locator('#scenario-reset').click();
    assert.equal(await page.locator('#scenario-detail').isVisible(), true);
    await page.locator('[data-edit-scenario]').click();
    await page.waitForSelector('dialog[open]');
    await page.keyboard.press('Escape');
    await page.locator('#account-header-open').click();
    assert.equal(await page.locator('#account-editor').isVisible(), true);
    await page.evaluate(() => {
      state.jobs = [{ id: 'layout-mock', name: 'Próbny przebieg UI', status: 'RUNNING', startedAt: new Date().toISOString(), log: 'Krok 1' }];
      renderJob();
      setView('run-status');
    });
    assert.equal(await page.locator('#view-run-status .run-panel:not(.run-docked)').isVisible(), true);
    await page.evaluate(() => setView('dashboard'));
    assert.equal(await page.locator('body > .run-panel.run-docked').isVisible(), true);
    await page.goto(base + '/#scenarios');
    await page.waitForSelector('#scenario-detail', { state: 'visible' });
    assert.deepEqual(errors, []);
    assert.equal(writes, 0);
    assert.equal(runs, 0);
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
});
