// Network link test: shared world clock, delay ledger carried KRT → HDY, catch-up on re-entry, real trains on the map.
// Run: node railway/tests/world.test.js
const { open, check } = require('./harness');
(async () => {
  const { browser, page, errors } = await open({ hash: '#rtdebug' });
  await page.waitForTimeout(800);
  // Krung Thep Aphiwat: hold special express 31 (16:45 → Hat Yai) about 20 minutes, then release it by hand
  const krt = await page.evaluate(() => {
    const R = window.__rt; R.meta().ctrl = { app: Date.now() + 3600e3 }; R.stnEnter('KRT'); const S = R.stn();
    const is31 = s => s.no === '31' && s.mode === 'orig';
    for (let i = 0; i < 40000 && !(S.services.find(is31) && S.now > S.services.find(is31).schedDep + 20 * 60); i++) R.stnStep(1);
    const s = S.services.find(is31); if (!s) return { err: 'no 31', now: S.now };
    for (let i = 0; i < 3000 && s.phase !== 'ready'; i++) R.stnStep(1);
    const ok = R.stnRelease(s) || (() => { for (let i = 0; i < 300; i++) { R.stnStep(1); if (R.stnRelease(s)) return true; } return false; })();
    return { ok, phase: s.phase, dday: s.dday, ledger: R.world().ledger['31#' + s.dday], world: R.world().now };
  });
  check('KRT records the late departure of 31 in the ledger', krt.ok && krt.ledger && krt.ledger.min >= 18 && krt.ledger.at === 'KRT', JSON.stringify(krt));
  // the map shows 31 running late
  const map = await page.evaluate(() => { const R = window.__rt, run = R.ttRunning(R.world().now + 3600); const r = run.find(x => x.t.no === '31'); return { n: run.length, delay: r && r.delay }; });
  check('network map draws 31 running with its delay', map.n > 0 && map.delay >= 13, JSON.stringify(map));
  // Hat Yai: caught up to the world clock, 31 arrives next morning carrying the (partly recovered) delay
  const hdy = await page.evaluate(() => {
    const R = window.__rt, w0 = R.world().now; R.meta().ctrl = { app: Date.now() + 3600e3, dep: Date.now() + 3600e3 }; R.stnEnter('HDY'); const S = R.stn();
    const caught = Math.abs(S.now - w0) < 120;
    const is31 = s => s.no === '31' && s.mode === 'term';
    for (let i = 0; i < 20000 && !(S.services.find(is31) && S.services.find(is31).dly); i++) R.stnStep(5);
    const s = S.services.find(is31);
    return { caught, found: !!s, inDelay: s && s.inDelay, src: s && s.delaySrc, eta: s && s.eta, arr: s && s.schedArr };
  });
  check('HDY catches up to the world clock on entry', hdy.caught, JSON.stringify(hdy));
  check('HDY inherits the delay of 31 from KRT', hdy.found && hdy.inDelay >= 13 && hdy.src === 'KRT' && hdy.eta === hdy.arr + hdy.inDelay * 60, JSON.stringify(hdy));
  // re-entering KRT after time moved on: the duty crew handled the backlog
  const back = await page.evaluate(() => { const R = window.__rt; R.stnEnter('KRT'); const S = R.stn(); return { lag: R.world().now - S.now, gone: S.services.filter(s => s.phase !== 'gone' && s.schedDep + 600 < S.now).length }; });
  check('KRT is caught up when re-entered', Math.abs(back.lag) < 120 && back.gone === 0, JSON.stringify(back));
  const diff = await page.evaluate(() => { const R = window.__rt; return { peak: R.rush(7.5 * 3600), off: R.rush(12 * 3600), wx: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => R.rain(d * 86400 + 3600)), same: R.rain(86400 * 3 + 100) === R.rain(86400 * 3 + 80000) }; });
  check('difficulty: peak headways and per-day weather', diff.peak < 1 && diff.off === 1 && diff.same && diff.wx.some(Boolean) && !diff.wx.every(Boolean), JSON.stringify(diff));
  check('no page errors', errors.length === 0, JSON.stringify(errors.slice(0, 3)));
  await browser.close();
  process.exit(process.exitCode || 0);
})();
