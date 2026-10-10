// Visual check of the generated Unity scenery without Unity: renders the dumped Unity-space meshes with three.js.
// The meshes are drawn with scale.z = −1 (back to the web build's right-handed space) and FrontSide only,
// so any face Unity would cull (wrong winding) shows up as a hole.
// Run: DUMP=<dir> sh unity/tools/check/check.sh && node unity/tools/check/render_scenery.js <dir>
// Env: PLAYWRIGHT, THREE_DIR, CHROMIUM as in railway/tests.
const fs = require('fs'), path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT || 'playwright');
const dir = process.argv[2], THREE_DIR = process.env.THREE_DIR;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on('pageerror', e => console.error(e.message));
  await page.setContent('<body style="margin:0"><canvas id=c width=1280 height=760></canvas></body>');
  await page.addScriptTag({ content: fs.readFileSync(path.join(THREE_DIR, 'build/three.min.js'), 'utf8') });
  const trains = JSON.parse(fs.readFileSync(path.join(dir, 'trains.json'), 'utf8'));
  for (const f of fs.readdirSync(dir).filter(f => f.startsWith('scene_') && f.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const [tag, zoom, dx] of [['wide', 0.8, 0], ['close', 2.6, 0]]) {
      await page.evaluate(({ data, trains, zoom }) => {
        const T = THREE, r = window._r || (window._r = new T.WebGLRenderer({ canvas: document.getElementById('c'), antialias: true }));
        r.setClearColor(0xcfe0f0); r.shadowMap.enabled = false;
        const sc = new T.Scene(); sc.add(new T.HemisphereLight(0xffffff, 0xb9c4d4, 0.75)); const sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(160, 260, 160); sc.add(sun);
        const mk = (m, mat) => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(m.p, 3)); g.setAttribute('color', new T.Float32BufferAttribute(m.c, 4)); g.setIndex(m.i); g.computeVertexNormals(); const o = new T.Mesh(g, mat); o.scale.z = -1; return o; };
        sc.add(mk(data.opaque, new T.MeshLambertMaterial({ vertexColors: true, side: T.FrontSide })));
        if (data.transparent.p.length) sc.add(mk(data.transparent, new T.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: T.DoubleSide })));
        // a consist on the first track: locomotive + sleepers, the way TimetableStationRunner lines cars up (front toward −x)
        const [cx, cy, cz] = data.centre; const ids = ['HID', 'cnr', 'cnr', 'cnr', 'THN', 'THN_car', 'THN'];
        ids.forEach((id, i) => { const o = mk(trains[id], new T.MeshLambertMaterial({ vertexColors: true })); o.rotation.y = -Math.PI / 2; o.position.set(cx - 60 + i * 20.5 + (i > 3 ? 30 : 0), cy, -cz - 0.0); sc.add(o); });
        const h = 360 / zoom, w = h * 1280 / 760, cam = new T.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, -3000, 3000);
        const az = Math.PI / 4, el = 35 * Math.PI / 180, tgt = new T.Vector3(cx, cy, -cz);
        cam.position.set(tgt.x + Math.sin(az) * Math.cos(el) * 1000, tgt.y + Math.sin(el) * 1000, tgt.z + Math.cos(az) * Math.cos(el) * 1000); cam.lookAt(tgt);
        r.render(sc, cam);
      }, { data, trains, zoom });
      const out = path.join(dir, f.replace('.json', '') + '_' + tag + '.png');
      await page.screenshot({ path: out }); console.log('wrote', out);
    }
  }
  await browser.close();
})();
