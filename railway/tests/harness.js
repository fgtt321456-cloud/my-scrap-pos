// Shared Playwright harness: serves three.js from a local copy so tests run offline and deterministically.
// Setup:  cd railway/tests && npm init -y && npm i playwright three@0.128.0
const path = require('path'), fs = require('fs');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const THREE_DIR = process.env.THREE_DIR || path.join(__dirname, 'node_modules', 'three');
const GAME = 'file://' + path.resolve(__dirname, '..', 'index.html');
async function open({ hash = '#rtdebug', w = 1440, h = 900, clear = true } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
  await page.route('**/three.min.js', r => r.fulfill({ body: fs.readFileSync(path.join(THREE_DIR, 'build/three.min.js')), contentType: 'text/javascript' }));
  await page.route('**/three@0.128.0/examples/js/**', r => r.fulfill({ body: fs.readFileSync(path.join(THREE_DIR, 'examples/js', r.request().url().split('/examples/js/')[1])), contentType: 'text/javascript' }));
  await page.route('**fonts.g**', r => r.abort());
  if (clear) await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(GAME + hash);
  await page.waitForTimeout(2500);
  if (await page.isVisible('#coachSkip')) await page.click('#coachSkip');
  return { browser, page, errors };
}
function check(name, ok, info) { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  ' + info : ''}`); if (!ok) process.exitCode = 1; }
module.exports = { open, check };
