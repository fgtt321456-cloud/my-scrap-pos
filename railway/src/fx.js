
// =================== Visual polish: terrain, contact shadows, bevels, lamps, day/night, bloom, billboards ===================
const PAL = {
  terrain: '#DCD1B8', terrainShade: '#D8CDB4', grass: '#C5D6A0', grassDeep: '#9DBB78', sand: '#EFE4C6',
  tree: 0x6FA35A, treeLight: 0x8DBE6A, wall: 0xF6F1E7, houseWarm: 0xEFE3CF, houseCool: 0xD7DFEA,
  roofT: 0xB8654A, roofS: 0x5E6F86, lamp: 0xFFD27A, window: 0xFFC768, glass: 0x4A5668,
  yellow: '#FFC20E', navy: '#0F2240', navy7: '#1B355E', green: '#1FA463', red: '#E5484D', info: '#3A7BD5',
};
const FX = { quality: 'high', composer: null, bloom: null, renderPass: null, lamp: 0, hour: 12 };

// ---------- shared helpers ----------
function addHeightGradient(geo, lo, hi) {
  const p = geo.attributes.position, n = p.count, col = new Float32Array(n * 3);
  geo.computeBoundingBox();
  const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, span = (y1 - y0) || 1;
  for (let i = 0; i < n; i++) { const k = lo + (hi - lo) * ((p.getY(i) - y0) / span); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = k; }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}
function radialTexture(inner, outer, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'), grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, inner); grd.addColorStop(1, outer); g.fillStyle = grd; g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}
const BEVEL_GEO = (() => {
  const g = THREE.RoundedBoxGeometry ? new THREE.RoundedBoxGeometry(1, 1, 1, 2, 0.07) : new THREE.BoxGeometry(1, 1, 1);
  return addHeightGradient(g, 0.72, 1.0);
})();
const M_WALL = mat(PAL.wall, { vertexColors: true });
const M_HOUSE = mat(0xffffff, { vertexColors: true, roughness: 0.85 });
const M_CROWN = mat(0xffffff, { vertexColors: true, roughness: 0.9, flatShading: true });
/** Bevelled, gradient-shaded box for buildings (stations use it instead of flat cubes). */
function bbox(w, h, d, m) {
  const o = new THREE.Mesh(BEVEL_GEO, m === M.white ? M_WALL : m);
  o.scale.set(w, h, d); o.castShadow = true; o.receiveShadow = true; return o;
}
const AO_TEX = radialTexture('rgba(20,24,30,0.55)', 'rgba(20,24,30,0)');
const AO_MAT = new THREE.MeshBasicMaterial({ map: AO_TEX, transparent: true, depthWrite: false });
const POOL_TEX = radialTexture('rgba(255,210,122,0.85)', 'rgba(255,210,122,0)');
const flatPlane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

// ---------- network scene: terrain, colours, houses, trees ----------
{
  M.ground.color.set(PAL.terrainShade); M.slab.color.set(0xBFB399);
  M.ballast.color.set(0x8C8476); M.sleeper.color.set(0x5B4636); M.rail.color.set(0x3A3F47);
  M.pad.color.set(0xC9D0DA); M.road.color.set(0xCFC7B4); M.sea.color.set(0x6FA8D6); M.water.color.set(0x8FC1E3); M.hill.color.set(0x8FAE78);
  M.white.color.set(PAL.wall); M.roof.color.set(0xDAD3C3);
  // painted terrain with soft tonal variation and meadows (the "gradient texture" ground)
  const N = 1024, c = document.createElement('canvas'); c.width = c.height = N;
  const g = c.getContext('2d'), W2P = v => (v + MAP) / (2 * MAP) * N;
  g.fillStyle = PAL.terrain; g.fillRect(0, 0, N, N);
  const blob = (x, y, r, col) => { const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, col); grd.addColorStop(1, 'rgba(220,209,184,0)'); g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); };
  for (let i = 0; i < 160; i++) blob(rng() * N, rng() * N, 30 + rng() * 150, rng() < 0.5 ? 'rgba(212,199,170,0.45)' : 'rgba(244,238,222,0.5)');
  for (let i = 0; i < 90; i++) {
    let wx, wz, n = 0;
    do { wx = (rng() * 2 - 1) * (MAP - 6); wz = (rng() * 2 - 1) * (MAP - 6); n++; } while ((nearStation(wx, wz, 13) || inSea(wx, wz, 3)) && n < 40);
    const r = (6 + rng() * 15) / (2 * MAP) * N * 1.5;
    blob(W2P(wx), W2P(wz), r, rng() < 0.6 ? 'rgba(197,214,160,0.9)' : 'rgba(157,187,120,0.75)');
  }
  // rice-field strips in the central plain
  g.save(); g.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) {
    const wx = -40 + rng() * 70, wz = -60 + rng() * 50; if (nearStation(wx, wz, 12)) continue;
    const x = W2P(wx), y = W2P(wz), w = 18 + rng() * 26, h = 10 + rng() * 16;
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#b9cf8f' : '#d2deb0'; g.fillRect(x + k * w / 4, y, w / 4 - 1, h); }
  }
  g.restore();
  // beach along the gulf
  const sx = W2P(SEA.x0), sz = W2P(SEA.z0);
  g.fillStyle = PAL.sand; g.fillRect(sx - 10, sz - 10, N - sx + 10, 14); g.fillRect(sx - 10, sz - 10, 14, N - sz + 10);
  for (let i = 0; i < 4000; i++) { g.fillStyle = rng() < 0.5 ? 'rgba(120,100,70,0.06)' : 'rgba(255,255,255,0.08)'; g.fillRect(rng() * N, rng() * N, 2, 2); }
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const terrain = new THREE.Mesh(new THREE.PlaneGeometry(MAP * 2, MAP * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
  terrain.position.y = 0.012; terrain.receiveShadow = true; scene.add(terrain);
  // houses: bevelled + gradient; crowns: low-poly + gradient
  houseMesh.geometry = BEVEL_GEO; houseMesh.material = M_HOUSE;
  const cc = [0xEFE3CF, 0xF6F1E7, 0xD7DFEA, 0xE4D5C1, 0xCDD8E6].map(x => new THREE.Color(x));
  DECOR.houses.forEach((h, i) => houseMesh.setColorAt(h.i, cc[i % cc.length]));
  treeCrown.geometry = addHeightGradient(new THREE.IcosahedronGeometry(1, 1), 0.7, 1.05); treeCrown.material = M_CROWN;
  const t1 = new THREE.Color(PAL.tree), t2 = new THREE.Color(PAL.treeLight);
  DECOR.trees.forEach(t => treeCrown.setColorAt(t.i, rng() < 0.5 ? t1 : t2));
}
// roofs, lit window bands, contact-shadow blobs for every house and tree
const roofMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.72, 1, 4).rotateY(Math.PI / 4), mat(0xffffff, { roughness: 0.8, flatShading: true }), DECOR.houses.length);
const winMat = new THREE.MeshBasicMaterial({ color: PAL.glass });
const winMesh = new THREE.InstancedMesh(unitBox, winMat, DECOR.houses.length * 2);
const aoMesh = new THREE.InstancedMesh(flatPlane, AO_MAT, DECOR.houses.length + DECOR.trees.length + STATIONS.length);
roofMesh.castShadow = true; aoMesh.renderOrder = 1;
{
  const r1 = new THREE.Color(PAL.roofT), r2 = new THREE.Color(PAL.roofS);
  DECOR.houses.forEach((h, i) => roofMesh.setColorAt(i, i % 3 ? r1 : r2));
  scene.add(roofMesh, winMesh, aoMesh);
}
function fxWriteDecor() {
  const Z = 0.0001;
  dummy.rotation.set(0, 0, 0);
  DECOR.houses.forEach((h, i) => {
    const k = h.hidden ? Z : 1, tall = h.h > 3.4, rh = tall ? Z : 0.45 + Math.min(h.w, h.d) * 0.22;
    dummy.position.set(h.x, h.h + rh / 2 - 0.02, h.z); dummy.scale.set(h.w * 1.04 * k, rh * k, h.d * 1.04 * k); dummy.updateMatrix(); roofMesh.setMatrixAt(i, dummy.matrix);
    dummy.position.set(h.x, h.h * 0.62, h.z); dummy.scale.set(h.w * 1.015 * k, Math.min(0.32, h.h * 0.16) * k, h.d * 1.015 * k); dummy.updateMatrix(); winMesh.setMatrixAt(i * 2, dummy.matrix);
    const k2 = tall ? k : Z;
    dummy.position.set(h.x, h.h * 0.3, h.z); dummy.scale.set(h.w * 1.015 * k2, 0.28 * k2, h.d * 1.015 * k2); dummy.updateMatrix(); winMesh.setMatrixAt(i * 2 + 1, dummy.matrix);
    dummy.position.set(h.x, 0.03, h.z); dummy.scale.set((h.w + 1.6) * k, 1, (h.d + 1.6) * k); dummy.updateMatrix(); aoMesh.setMatrixAt(i, dummy.matrix);
  });
  const o = DECOR.houses.length;
  DECOR.trees.forEach((t, i) => { const s = t.hidden ? Z : 2.2 * t.s; dummy.position.set(t.x + 0.25, 0.028, t.z + 0.25); dummy.scale.set(s, 1, s); dummy.updateMatrix(); aoMesh.setMatrixAt(o + i, dummy.matrix); });
  const o2 = o + DECOR.trees.length;
  STATIONS.forEach((s, i) => { dummy.position.set(s.x, 0.02, s.z); dummy.scale.set(17, 1, 17); dummy.updateMatrix(); aoMesh.setMatrixAt(o2 + i, dummy.matrix); });
  roofMesh.instanceMatrix.needsUpdate = winMesh.instanceMatrix.needsUpdate = aoMesh.instanceMatrix.needsUpdate = true;
}
// street lamps (road edges + station corners)
const LAMPS = [];
ROADS.forEach(r => { for (let p = r.lo + 6; p < r.hi - 4; p += 11) { const x = r.axis === 'z' ? p : r.at + 2.4, z = r.axis === 'z' ? r.at + 2.4 : p; if (!nearStation(x, z, 8) && !inSea(x, z, 0.5)) LAMPS.push([x, z]); } });
STATIONS.forEach(s => { LAMPS.push([s.x + 6.4, s.z + 6.4], [s.x - 6.4, s.z + 6.4], [s.x + 6.4, s.z - 6.4]); });
function makeLamps(list, poleH, target) {
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.06, 0.09, 1, 6), mat(0x3A3F47), list.length);
  const headMat = new THREE.MeshBasicMaterial({ color: 0x9aa0a8 });
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.2, 8, 6), headMat, list.length);
  const poolMat = new THREE.MeshBasicMaterial({ map: POOL_TEX, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const pools = new THREE.InstancedMesh(flatPlane, poolMat, list.length);
  list.forEach(([x, z], i) => {
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(x, poleH / 2, z); dummy.scale.set(1, poleH, 1); dummy.updateMatrix(); poles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, poleH + 0.1, z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 0.05, z); dummy.scale.set(poleH * 2.6, 1, poleH * 2.6); dummy.updateMatrix(); pools.setMatrixAt(i, dummy.matrix);
  });
  poles.castShadow = true; pools.renderOrder = 2; target.add(poles, heads, pools);
  return { headMat, poolMat };
}
const NET_LAMPS = makeLamps(LAMPS, 2.6, scene);

// ---------- day / night ----------
const DN_KEYS = [
  { h: 0, sky: 0x0B1428, hs: 0x2a3a66, hg: 0x141a28, hi: 0.5, sc: 0x9fb4e0, si: 0.22, lamp: 1 },
  { h: 5, sky: 0x111b36, hs: 0x2e3d68, hg: 0x161c2a, hi: 0.52, sc: 0x9fb4e0, si: 0.22, lamp: 1 },
  { h: 6, sky: 0xF0C49C, hs: 0xf3cfaa, hg: 0x7a6c5e, hi: 0.46, sc: 0xFFB070, si: 0.4, lamp: 0.35 },
  { h: 8, sky: 0xE6ECF2, hs: 0xeef2f8, hg: 0xa9a28f, hi: 0.58, sc: 0xFFF1DC, si: 0.56, lamp: 0 },
  { h: 12, sky: 0xDDE7F2, hs: 0xf7f9fc, hg: 0xaaa38f, hi: 0.6, sc: 0xFFF6E8, si: 0.6, lamp: 0 },
  { h: 16, sky: 0xE4E6EC, hs: 0xf6f0e6, hg: 0xa79e8a, hi: 0.58, sc: 0xFFEBD0, si: 0.56, lamp: 0 },
  { h: 18, sky: 0xE9A07A, hs: 0xffcfa8, hg: 0x8a6f60, hi: 0.6, sc: 0xFF9E66, si: 0.5, lamp: 0.55 },
  { h: 19.5, sky: 0x3A3560, hs: 0x6a5d8f, hg: 0x2a2433, hi: 0.5, sc: 0xc08aa0, si: 0.25, lamp: 1 },
  { h: 21, sky: 0x0B1428, hs: 0x2a3a66, hg: 0x141a28, hi: 0.5, sc: 0x9fb4e0, si: 0.22, lamp: 1 },
  { h: 24, sky: 0x0B1428, hs: 0x2a3a66, hg: 0x141a28, hi: 0.5, sc: 0x9fb4e0, si: 0.22, lamp: 1 },
];
const _ca = new THREE.Color(), _cb = new THREE.Color();
function dnSample(hour) {
  let i = 0; while (i < DN_KEYS.length - 2 && DN_KEYS[i + 1].h <= hour) i++;
  const a = DN_KEYS[i], b = DN_KEYS[i + 1], t = clamp((hour - a.h) / (b.h - a.h), 0, 1), s = t * t * (3 - 2 * t);
  const col = k => new THREE.Color(a[k]).lerp(_cb.set(b[k]), s);
  return { sky: col('sky'), hs: col('hs'), hg: col('hg'), sc: col('sc'), hi: a.hi + (b.hi - a.hi) * s, si: a.si + (b.si - a.si) * s, lamp: a.lamp + (b.lamp - a.lamp) * s };
}
/** Applies time-of-day lighting to a scene's hemisphere + sun lights and lamp materials. */
function applyDayNight(hour, sc, hemiL, sunL, center, radius, lamps) {
  const d = dnSample(((hour % 24) + 24) % 24);
  FX.lamp = d.lamp; FX.hour = hour;
  sc.background = d.sky;
  hemiL.color.copy(d.hs); hemiL.groundColor.copy(d.hg); hemiL.intensity = d.hi;
  sunL.color.copy(d.sc); sunL.intensity = d.si;
  const h = ((hour % 24) + 24) % 24;
  if (h >= 5.5 && h <= 18.5) { const t = (h - 6) / 12; sunL.position.set(center.x + Math.cos(Math.PI * t) * radius, radius * 0.25 + Math.max(0.12, Math.sin(Math.PI * t)) * radius, center.z + radius * 0.35); }
  else sunL.position.set(center.x - radius * 0.4, radius * 0.9, center.z - radius * 0.3);
  sunL.target.position.copy(center); sunL.target.updateMatrixWorld();
  if (lamps) { lamps.headMat.color.copy(_ca.set(0x9aa0a8).lerp(_cb.set(PAL.lamp), d.lamp)); lamps.poolMat.opacity = d.lamp * 0.85; }
  winMat.color.copy(_ca.set(PAL.glass).lerp(_cb.set(PAL.window), d.lamp));
  if (FX.bloom) { FX.bloom.strength = 0.06 + d.lamp * 0.55; FX.bloom.threshold = 0.97 - d.lamp * 0.33; }
}
sun.target.position.set(0, 0, 0); scene.add(sun.target);

// ---------- bloom (high quality only) ----------
function fxInitComposer() {
  if (FX.composer || !THREE.EffectComposer || !THREE.UnrealBloomPass || !THREE.RenderPass) return;
  try {
    const sz = renderer.getSize(new THREE.Vector2()), pr = renderer.getPixelRatio();
    let rt;
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget) rt = new THREE.WebGLMultisampleRenderTarget(Math.max(1, sz.x * pr), Math.max(1, sz.y * pr), { format: THREE.RGBAFormat });
    const comp = new THREE.EffectComposer(renderer, rt);
    FX.renderPass = new THREE.RenderPass(scene, camera); comp.addPass(FX.renderPass);
    FX.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(sz.x, sz.y), 0.2, 0.45, 0.86); comp.addPass(FX.bloom);
    FX.composer = comp;
  } catch (e) { FX.composer = null; FX.bloom = null; }
}
function fxSetQuality(q) {
  FX.quality = q; if (state) state.quality = q;
  const hi = q === 'high';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, hi ? 2 : 1.5));
  const want = hi ? 2048 : 1024;
  [sun].concat(TVIS && TVIS.lights ? [TVIS.lights.s] : []).forEach(L => { if (L.shadow.mapSize.x !== want) { L.shadow.mapSize.set(want, want); if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; } } });
  if (hi) fxInitComposer();
  resize();
  const b = $('#qualityBtn'); if (b) { b.textContent = hi ? 'กราฟิก: สูง (bloom + เงาคมชัด)' : 'กราฟิก: ประหยัดแบตเตอรี่'; b.setAttribute('aria-pressed', String(hi)); }
}
function fxRender(sc) {
  if (FX.quality === 'high' && FX.composer) { FX.renderPass.scene = sc; FX.composer.render(); }
  else renderer.render(sc, camera);
}
function fxResize(w, h) { if (FX.composer) FX.composer.setSize(w, h); }

// ---------- floating billboard icons (pooled sprites, constant screen size, tappable) ----------
const BB_TEX = {};
function bbTexture(kind) {
  if (BB_TEX[kind]) return BB_TEX[kind];
  const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d');
  const num = /^num(\d+)$/.exec(kind), numOff = /^off(\d+)$/.exec(kind);
  const bg = { repair: PAL.yellow, depot: PAL.yellow, platform: PAL.yellow, ready: PAL.green, wait: PAL.navy7, crowd: PAL.navy7 }[kind] || (num ? PAL.yellow : '#8D97A8');
  const fg = (bg === PAL.yellow) ? PAL.navy : '#ffffff';
  if (bg === PAL.yellow || bg === PAL.green) { const gl = g.createRadialGradient(64, 64, 30, 64, 64, 64); gl.addColorStop(0, bg + 'aa'); gl.addColorStop(1, bg + '00'); g.fillStyle = gl; g.fillRect(0, 0, S, S); }
  g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 40, 0, 7); g.fill();
  g.lineWidth = 5; g.strokeStyle = 'rgba(255,255,255,0.9)'; g.stroke();
  g.strokeStyle = fg; g.fillStyle = fg; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (kind === 'repair' || kind === 'depot') { g.moveTo(48, 80); g.lineTo(70, 58); g.stroke(); g.beginPath(); g.arc(76, 52, 11, Math.PI * 0.75, Math.PI * 2.25); g.stroke(); if (kind === 'repair') { g.fillStyle = PAL.red; g.beginPath(); g.arc(86, 84, 9, 0, 7); g.fill(); } }
  else if (kind === 'ready') { g.moveTo(46, 66); g.lineTo(59, 79); g.lineTo(84, 50); g.stroke(); }
  else if (kind === 'wait') { g.arc(64, 64, 20, 0, 7); g.stroke(); g.beginPath(); g.moveTo(64, 52); g.lineTo(64, 65); g.lineTo(73, 70); g.stroke(); }
  else if (kind === 'crowd') { [[50, 58], [64, 52], [78, 58]].forEach(([x, y]) => { g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); g.beginPath(); g.arc(x, y + 20, 10, Math.PI, 0); g.fill(); }); }
  else if (kind === 'platform') { g.moveTo(64, 44); g.lineTo(64, 78); g.stroke(); g.beginPath(); g.moveTo(52, 68); g.lineTo(64, 80); g.lineTo(76, 68); g.stroke(); g.lineWidth = 5; g.beginPath(); g.moveTo(46, 88); g.lineTo(82, 88); g.stroke(); }
  else if (num || numOff) { g.font = '700 40px "Chakra Petch", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((num || numOff)[1], 64, 67); }
  const tex = new THREE.CanvasTexture(c); return (BB_TEX[kind] = tex);
}
function makeBB(group) { return { group, live: new Map(), pool: [] }; }
const BB_NET = makeBB(new THREE.Group()); scene.add(BB_NET.group);
/** items: [{key, kind, x, y, z, tap, pulse, px}] — diffed by key; sprites are pooled. */
function bbSync(B, items, time) {
  const seen = new Set(), worldPerPx = (camera.top - camera.bottom) / camera.zoom / Math.max(1, canvas.clientHeight);
  for (const it of items) {
    seen.add(it.key);
    let sp = B.live.get(it.key);
    if (!sp) { sp = B.pool.pop() || new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true })); sp.renderOrder = 20; B.group.add(sp); B.live.set(it.key, sp); sp.userData.kind = ''; }
    if (sp.userData.kind !== it.kind) { sp.material.map = bbTexture(it.kind); sp.material.needsUpdate = true; sp.userData.kind = it.kind; }
    sp.userData.tap = it.tap;
    const pulse = it.pulse ? 1 + Math.sin(time * 5 + (it.x + it.z) * 0.3) * 0.1 : 1, s = (it.px || (narrow() ? 46 : 40)) * worldPerPx * pulse;
    sp.position.set(it.x, it.y, it.z); sp.scale.set(s, s, 1); sp.visible = true;
  }
  for (const [k, sp] of B.live) if (!seen.has(k)) { sp.visible = false; B.group.remove(sp); B.pool.push(sp); B.live.delete(k); }
}
function bbPick(B) {
  if (!B.live.size) return null;
  const hits = ray.intersectObjects(B.group.children, false);
  const h = hits.find(x => x.object.visible && x.object.userData.tap);
  return h ? h.object.userData.tap : null;
}
function netBillboards(time) {
  const items = [];
  for (const tr of state.trains) {
    if (offLine(tr)) continue;
    const r = RT.trains[tr.id]; if (!r || !r.group.visible) continue;
    const c = r.cars[Math.floor(r.cars.length / 2)].position;
    if (tr.broken && tr.repair <= 0) items.push({ key: 't' + tr.id, kind: 'repair', x: c.x, y: 4.6, z: c.z, pulse: true, tap: () => { if (state.money >= 6000) trainAction('repair', tr); else select({ type: 'train', id: tr.id }); } });
    else if (tr.cond < 30 && !tr.leased) items.push({ key: 't' + tr.id, kind: 'depot', x: c.x, y: 4.6, z: c.z, pulse: true, tap: () => { sendToDepot(tr, false); RT.staticDirty = true; } });
    else if (tr.holding) items.push({ key: 't' + tr.id, kind: 'wait', x: c.x, y: 4.6, z: c.z, px: 32, tap: () => select({ type: 'train', id: tr.id }) });
  }
  for (const d of STATIONS) {
    const st = state.stations[d.id]; if (!st.unlocked) continue;
    const cap = stationCap(st);
    if (st.pax > cap * 0.85 || st.cargo > cap * 0.85) items.push({ key: 's' + d.id, kind: 'crowd', x: d.x, y: 11.4, z: d.z, px: 34, tap: () => select({ type: 'station', id: d.id }) });
  }
  bbSync(BB_NET, MAP2D.on ? [] : items, time);
  edgeIndicators(MAP2D.on ? [] : items);
}

// ---------- route preview: glowing dots that flow along a proposed / selected route ----------
const PV_N = 90;
const pvMat = new THREE.MeshBasicMaterial({ color: 0xFFC20E, transparent: true, opacity: 0.95, depthWrite: false });
const pvMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.42, 8, 6), pvMat, PV_N);
pvMesh.visible = false; pvMesh.renderOrder = 6; scene.add(pvMesh);
function previewPath() {
  if (RT.preview) { const ev = evalLine(RT.preview.a, RT.preview.b); return ev.ok ? buildPath(RT.preview.a, RT.preview.b, ev.mode) : null; }
  if ($('#panel').classList.contains('open') && drawerTab === 'stations') { const a = $('#lineA').value, b = $('#lineB').value, ev = evalLineCached(); return ev.ok ? buildPath(a, b, ev.mode) : null; }
  if ($('#panel').classList.contains('open') && drawerTab === 'trains') { const l = lineById($('#buyLine').value); return l && RT.lines[l.id] ? RT.lines[l.id].path : null; }
  return null;
}
function updatePreview(time) {
  const P = previewPath(); FX.previewP = P;
  if (!P || MAP2D.on) { pvMesh.visible = false; return; }
  pvMesh.visible = true;
  dummy.rotation.set(0, 0, 0);
  const n = Math.min(PV_N, Math.max(12, Math.floor(P.len / 2.4)));
  for (let i = 0; i < PV_N; i++) {
    if (i >= n) { dummy.scale.set(0.0001, 0.0001, 0.0001); dummy.updateMatrix(); pvMesh.setMatrixAt(i, dummy.matrix); continue; }
    const s = ((i / n) * P.len + time * 9) % P.len, p = pathAt(P, s), k = 0.75 + 0.35 * Math.sin(time * 6 - i * 0.6);
    dummy.position.set(p.x, 0.9, p.z); dummy.scale.set(k, k, k); dummy.updateMatrix(); pvMesh.setMatrixAt(i, dummy.matrix);
  }
  pvMesh.instanceMatrix.needsUpdate = true;
}

// ---------- wayfinding: yellow arrows on the screen edge pointing at offscreen trains that need the player ----------
const EDGE_ELS = [];
const EDGE_KINDS = { platform: 1, repair: 1, depot: 1, ready: 1 };
function edgeIndicators(items) {
  const w = canvas.clientWidth, h = canvas.clientHeight, top = 18, bottom = narrow() ? 92 : 100, side = 18;
  let n = 0;
  for (const it of items) {
    if (!EDGE_KINDS[it.kind]) continue;
    tmpV.set(it.x, it.y, it.z).project(camera);
    const sx = (tmpV.x + 1) / 2 * w, sy = (1 - tmpV.y) / 2 * h;
    if (sx > 0 && sx < w && sy > 0 && sy < h) continue;
    let el = EDGE_ELS[n];
    if (!el) {
      el = document.createElement('button'); el.className = 'edge-arrow'; el.setAttribute('aria-label', 'ไปยังขบวนที่ต้องจัดการ');
      el.innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 12h11M12 6l6 6-6 6"/></svg>';
      el.addEventListener('click', () => { const t = el._t; if (t) { cam.tx = t.x; cam.tz = t.z; cam.follow = null; } });
      $('#edgeArrows').appendChild(el); EDGE_ELS.push(el);
    }
    const cx = w / 2, cy = h / 2, dx = sx - cx, dy = sy - cy;
    const kx = (w / 2 - side - 22) / Math.max(1e-6, Math.abs(dx)), ky = (dy < 0 ? h / 2 - top - 22 : h / 2 - bottom - 22) / Math.max(1e-6, Math.abs(dy));
    const k = Math.min(kx, ky), x = cx + dx * k, y = cy + dy * k;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    el.firstChild.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
    el.classList.toggle('go', it.kind === 'ready');
    el._t = { x: it.x, z: it.z }; el.hidden = false; n++;
  }
  for (let i = n; i < EDGE_ELS.length; i++) EDGE_ELS[i].hidden = true;
}
