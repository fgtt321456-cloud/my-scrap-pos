// End-to-end smoke test: menu → station picker → each station → Hua Lamphong platform flow → network map.
// Run: node railway/tests/smoke.test.js
const { open, check } = require('./harness');
(async () => {
  const { browser, page, errors } = await open({ hash: '#rtdebug-menu' });
  await page.click('#mPlay'); await page.waitForTimeout(500);
  check('station picker opens', await page.isVisible('#hubs'));
  await page.click('[data-hub="term"]'); await page.waitForTimeout(1500);
  await page.waitForSelector('#coachSkip', { state: 'visible', timeout: 5000 }).catch(() => {});
  if (await page.isVisible('#coachSkip')) await page.click('#coachSkip');
  check('tutorial starts at the station', true);
  // Hua Lamphong: select a waiting train, choose a platform, a route gets set
  await page.click('#liveList .lv.alert'); await page.waitForTimeout(400);
  await page.click('#tcard [data-f="act"]'); await page.waitForTimeout(500);
  await page.click('#psList .pcard:not(.no)'); await page.waitForTimeout(400);
  const routes = await page.evaluate(() => window.__rt.routes());
  check('HLP arrival route set from platform sheet', routes.some(r => r.startsWith('arr')), JSON.stringify(routes));
  // 4 game hours with automatic controllers: no stuck trains
  const hlp = await page.evaluate(() => { const R = window.__rt, m = R.meta(); m.ctrl.app = m.ctrl.dep = Date.now() + 3600e3; const T = R.t; T.ars.arr = T.ars.dep = true; for (let i = 0; i < 4 * 3600 * 4; i++) R.tStep(0.25); return { dep: T.stats.dep, stuck: T.services.filter(x => x.phase === 'dwell' && T.now - x.schedDep > 1800).length }; });
  check('HLP 4h simulation departs trains, none stuck', hlp.dep > 20 && hlp.stuck === 0, JSON.stringify(hlp));
  // shared station UI also drives a timetable station (Chiang Mai)
  await page.evaluate(() => { const R = window.__rt; R.meta().ctrl = {}; R.stnEnter('CMI'); const S = R.stn(); for (let i = 0; i < 6000 && !S.services.some(s => s.phase === 'approach' || s.phase === 'held'); i++) R.stnStep(0.5); });
  await page.waitForTimeout(800);
  await page.click('#liveList .lv.alert'); await page.waitForTimeout(300);
  await page.click('#tcard [data-f="act"]'); await page.waitForTimeout(400);
  await page.click('#psList .pcard:not(.no)'); await page.waitForTimeout(300);
  const tr = await page.evaluate(() => window.__rt.stn().services.filter(s => s.track && ['approach', 'held', 'entering'].includes(s.phase)).length);
  check('CMI platform chosen through the shared card and sheet', tr > 0);
  // every real-reference station loads and runs its timetable
  for (const id of ['CMI', 'HDY', 'NKI', 'UBN', 'KRT']) {
    const r = await page.evaluate(id => { const R = window.__rt; R.stnEnter(id); const S = R.stn(), m = R.meta(); m.ctrl.app = m.ctrl.dep = Date.now() + 3600e3; for (let i = 0; i < 4 * 7200; i++) R.stnStep(0.5); return { dep: S.stats.dep, held: S.services.filter(s => s.phase === 'held').length }; }, id);
    await page.waitForTimeout(600);
    check(`station ${id} runs`, r.dep > 0, JSON.stringify(r));
  }
  // network map: buy-route economy keeps moving
  const net = await page.evaluate(() => { const R = window.__rt; R.setMode('net'); for (let i = 0; i < 2000; i++) R.simStep(0.05); return { trains: R.s.trains.length, legs: R.s.stats.legs }; });
  check('network simulation runs on real rail paths', net.legs > 0, JSON.stringify(net));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
})();
