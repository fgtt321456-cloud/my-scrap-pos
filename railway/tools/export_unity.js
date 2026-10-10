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
  for (const [name, data] of Object.entries(files)) {
    fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1) + '\n');
    console.log('wrote', name, fs.statSync(path.join(out, name)).size, 'bytes');
  }
  if (errors.length) console.error('page errors:', errors);
  await browser.close();
  process.exit(errors.length ? 1 : 0);
})();
