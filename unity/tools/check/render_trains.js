// Visual check of the detailed Unity train meshes (Unity space + livery atlases), rendered with three.js:
// scale.z = −1 restores the web build's handedness, FrontSide only, so a culled face or mirrored lettering shows.
// Run: DUMP=<dir> sh unity/tools/check/check.sh && node unity/tools/check/render_trains.js <dir>
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const dir = process.argv[2], THREE_DIR = process.env.THREE_DIR, tex = path.join(__dirname, '../../Assets/Resources/RailTrack/Trains');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });
  page.on('pageerror', e => console.error(e.message));
  await page.setContent('<body style="margin:0;background:#cfe0f0"><canvas id=c width=1400 height=820></canvas></body>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(THREE_DIR, 'build/three.min.js'), 'utf8') });
  const trains = JSON.parse(fs.readFileSync(path.join(dir, 'trains_detailed.json'), 'utf8'));
  const atlases = {}; for (const f of fs.readdirSync(tex).filter(f => f.endsWith('.png'))) atlases[f.replace('.png', '')] = 'data:image/png;base64,' + fs.readFileSync(path.join(tex, f)).toString('base64');
  const rows = [['HID', 'cnr', 'cnr'], ['GEK', 'coach', 'coach'], ['ALS', 'coach', 'frt'], ['CSR', 'frt', 'frt'], ['THN', 'THN_car', 'THN'], ['NKF', 'NKF_car', 'NKF'], ['APD', 'APD_car', 'APD'], ['ASR', 'ASR_car', 'ASR'], ['red', 'red_car', 'red']];
  for (const [tag, side, close] of [['left', 1, 0], ['right', -1, 0], ['lettering', 1, 1]]) {
    await page.evaluate(async ({ trains, atlases, rows, side, close }) => {
      const T = THREE, load = url => new Promise(res => new T.TextureLoader().load(url, t => { t.flipY = true; res(t); }));
      const mats = {};
      for (const k of Object.keys(trains)) { const fam = trains[k].family; if (!mats[fam]) mats[fam] = new T.MeshStandardMaterial({ map: await load(atlases['atlas_' + fam]), roughness: 0.5, metalness: 0.1, side: T.FrontSide }); }
      const r = window._r || (window._r = new T.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true })); r.setClearColor(0xcfe0f0);
      const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0x9aa6b8, 0.85)); const s = new T.DirectionalLight(0xffffff, 0.8); s.position.set(60 * side, 120, 80); sc.add(s);
      rows.forEach((ids, row) => ids.forEach((id, i) => {
        const m = trains[id], g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(m.p, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(m.uv, 2)); g.setIndex(m.i); g.computeVertexNormals();
        const o = new T.Mesh(g, mats[m.family]); o.scale.z = -1;           // Unity → web handedness
        o.rotation.y = Math.PI / 2;                                         // cars along +x, front of the head car toward +x
        o.position.set(30 - i * 21, 0, row * 7 - 28); sc.add(o);
      }));
      const cam = close ? new T.OrthographicCamera(-14, 14, 8.2, -8.2, -500, 500) : new T.OrthographicCamera(-50, 50, 29.3, -29.3, -500, 500);
      if (close) { cam.position.set(19, 3, 100); cam.lookAt(19, 2.4, -28); } else { cam.position.set(40, 30, 60 * side); cam.lookAt(5, 0, 0); }
      r.render(sc, cam);
    }, { trains, atlases, rows, side, close });
    const out = path.join(dir, `trains_${tag}.png`); await page.screenshot({ path: out }); console.log('wrote', out);
  }
  await browser.close();
})();
