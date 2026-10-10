// Export the game's data for the Unity port: builds nothing, just loads railway/index.html headless and dumps
// rtExport() to unity/Assets/StreamingAssets/RailTrack/*.json (JsonUtility-friendly, see src/export.js).
// Run: node railway/tools/export_unity.js   (same env vars as the tests: PLAYWRIGHT, THREE_DIR, CHROMIUM)
const fs = require('fs'), path = require('path');
const { open } = require('../tests/harness');
(async () => {
  const { browser, page, errors } = await open({ hash: '#rtdebug' });
  const files = await page.evaluate(() => window.__rt.exportData());
  const out = path.join(__dirname, '../../unity/Assets/StreamingAssets/RailTrack');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(__dirname, '../../unity/tools/check/golden_paths.json'), JSON.stringify(files['#golden']) + '\n');
  delete files['#golden'];
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1) + '\n');
    console.log('wrote', name, fs.statSync(path.join(out, name)).size, 'bytes');
  }
  // detailed train models: geometry + painted livery atlases (Resources so Unity imports and compresses the PNGs)
  const trains = await page.evaluate(() => window.__rt.exportTrains());
  const tdir = path.join(__dirname, '../../unity/Assets/Resources/RailTrack/Trains');
  fs.mkdirSync(tdir, { recursive: true });
  for (const f of trains.families) {
    for (const [kind, url] of [['', f.tex], ['_em', f.em]]) fs.writeFileSync(path.join(tdir, `atlas_${f.family}${kind}.png`), Buffer.from(url.split(',')[1], 'base64'));
    delete f.tex; delete f.em;
  }
  fs.writeFileSync(path.join(tdir, 'trains.json'), JSON.stringify(trains) + '\n');
  console.log('wrote', trains.models.length, 'train models,', trains.families.length, 'liveries');
  // behaviour reference for the C# port: each station from a fresh 06:00 start, 24 h with both ARS controllers on
  const ref = await page.evaluate(() => {
    const R = window.__rt, out = [];
    for (const id of ['CMI', 'HDY', 'NKI', 'UBN', 'KRT']) {
      const runs = [];
      for (let k = 0; k < 4; k++) {
        const W = R.world(); W.now = 6 * 3600; W.ledger = {};
        const m = R.meta(); m.lv = 1; m.ctrl = { app: Date.now() + 3600e3, dep: Date.now() + 3600e3 };
        R.stnReset(id); R.stnEnter(id); const S = R.stn();
        for (let i = 0; i < 24 * 7200; i++) R.stnStep(0.5);
        runs.push({ dep: S.stats.dep, onTime: S.stats.onTime, holdMin: S.stats.holdMin });
      }
      const avg = f => runs.reduce((a, r) => a + r[f], 0) / runs.length;
      out.push({ station: id, dep: avg('dep'), onTime: avg('onTime'), holdMin: avg('holdMin') });
    }
    return out;
  });
  fs.writeFileSync(path.join(__dirname, '../../unity/tools/check/golden_sim.json'), JSON.stringify({ stations: ref }) + '\n');
  console.log('behaviour reference', JSON.stringify(ref));
  if (errors.length) console.error('page errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
