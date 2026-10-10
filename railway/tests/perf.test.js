// Scene cost report: draw calls / triangles / GPU memory objects per scene (device-independent numbers).
// FPS here comes from a software renderer and is NOT representative of phones; use the in-game FPS overlay on devices.
const { open, check } = require('./harness');
(async () => {
  const { browser, page, errors } = await open({ w: 390, h: 844 });
  const scenes = [['แผนที่ไทย (2D)', () => window.__rt.setMode('net')], ['หัวลำโพง', () => window.__rt.setMode('term')]]
    .concat(['CMI', 'HDY', 'NKI', 'UBN', 'KRT'].map(id => [id, `window.__rt.stnEnter('${id}')`]));
  const rows = [];
  for (const [name, fn] of scenes) {
    await page.evaluate(typeof fn === 'string' ? fn : fn);
    if (name !== 'หัวลำโพง' && name.length === 3) await page.evaluate(() => { const S = window.__rt.stn(), m = window.__rt.meta(); m.ctrl.app = m.ctrl.dep = Date.now() + 3600e3; for (let i = 0; i < 6000; i++) window.__rt.stnStep(0.5); });
    await page.waitForTimeout(2500);
    const p = await page.evaluate(() => window.__rt.perf());
    rows.push(`| ${name} | ${p.calls} | ${Math.round(p.triangles / 1000)}k | ${p.geo} | ${p.tex} |`);
    check(`${name}: draw calls under budget`, p.calls < 600, `${p.calls} calls`);
  }
  console.log('\n| ฉาก | draw calls | triangles | geometries | textures |\n|---|---|---|---|---|\n' + rows.join('\n'));
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
})();
