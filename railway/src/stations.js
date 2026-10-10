// =================== Real stations: 3D scene builder, timetable-driven platform game, UI ===================
const STN_SAVE = 'railtrack-stn-v1';
const STN_RATE = 30;                       // game seconds per real second at 1×
const STN_END = { CMI: ['', 'กรุงเทพ · ลำปาง →'], UBN: ['', 'กรุงเทพ · ศรีสะเกษ →'], NKI: ['← อุดรธานี · กรุงเทพ', 'สะพานมิตรภาพไทย–ลาว →'], HDY: ['← กรุงเทพ · ทุ่งสง', 'ปาดังเบซาร์ · สุไหงโก-ลก →'], KRT: ['← สายใต้ (นครปฐม)', 'สายเหนือ · สายอีสาน →'] };
const STN = { cur: null, built: {}, st: {}, sel: null, sheet: null, acc: 0, uiAcc: 0, sig: '', cardSig: '' };
const camStn = { tx: 0, tz: 10, az: Math.PI / 4, azT: Math.PI / 4, zoom: 0.8, follow: null, view: 360, near: -3000, far: 3000, zmin: 0.25, zmax: 7, bounds: [-1000, 1000, -500, 500],
  home() { const d = STN_DEFS[STN.cur]; if (!d) return; this.tx = (d.P0 + d.P1) / 2; this.tz = 6; this.zoom = (narrow() ? 0.62 : 1) * (d.id === 'KRT' ? 1.0 : 1.7); this.azT = Math.PI / 4; } };
const stnDef = () => STN_DEFS[STN.cur];
const stnState = () => STN.st[STN.cur];
const hm = s => { const m = Math.floor(((s % 86400) + 86400) % 86400 / 60); return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
const toSec = t => { const [h, m] = t.split(':').map(Number); return h * 3600 + m * 60; };

// ---------- geometry helpers ----------
const SM = {
  ground: mat(0xDCD1B8, { roughness: 1 }), ballast: mat(0xA79F92), sleeper: mat(0x6B5646), rail: mat(0x59626e, { metalness: 0.5, roughness: 0.4 }),
  plat: mat(0xD9DEE5), edge: mat(0xF1C232), buffer: mat(0xD33B3B), white: mat(0xF7F3EA), cream: mat(0xF0E4C6), tile: mat(0x8A3B2A, { roughness: 0.8 }), tileO: mat(0xC2622D, { roughness: 0.8 }),
  wood: mat(0x7A4B2A), dark: mat(0x2B313A), glass: new THREE.MeshStandardMaterial({ color: 0x86A9CC, roughness: 0.12, metalness: 0.35, emissive: 0x0b1a30 }),
  glassRoof: new THREE.MeshStandardMaterial({ color: 0xD4E4F4, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 }),
  steel: mat(0x8A96A8, { metalness: 0.5, roughness: 0.4 }), concrete: mat(0xC8C4BC), grass: mat(0x7FB069, { roughness: 1 }), water: new THREE.MeshStandardMaterial({ color: 0x5E8FA8, roughness: 0.15, metalness: 0.2, emissive: 0x0a1f2c }),
  road: mat(0x4A4F57, { roughness: 0.95 }), red: mat(0xC8102E), navy: mat(0x13294B), blueSign: mat(0x1F4FD1), yellow: mat(0xF5B400),
};
function mkPath(pts) { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y, pts[i].z - pts[i - 1].z)); return { pts, cum, len: cum[cum.length - 1] }; }
function pAtS(P, s) {
  s = clamp(s, 0, P.len); let lo = 0, hi = P.cum.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P.cum[mid] <= s) lo = mid; else hi = mid - 1; }
  const a = P.pts[lo], b = P.pts[lo + 1], seg = (P.cum[lo + 1] - P.cum[lo]) || 1e-6, t = (s - P.cum[lo]) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t, dx: (b.x - a.x) / seg, dz: (b.z - a.z) / seg };
}
const revPath = P => mkPath(P.pts.slice().reverse());
function sOfX(P, x, z) { for (let i = 0; i < P.pts.length - 1; i++) { const a = P.pts[i], b = P.pts[i + 1]; if (Math.abs(a.z - z) < 0.01 && Math.abs(b.z - z) < 0.01 && (x - a.x) * (x - b.x) <= 0) return P.cum[i] + Math.abs(x - a.x); } return null; }
const mainZ = d => { const t = d.tracks.filter(x => !x.siding); return t.reduce((a, x) => a + x.z, 0) / t.length; };
/** Full track path from the east approach (+x) through the platform to the buffer (terminus) or out to the west approach (through station). */
function stnTrackPath(d, t) {
  const y = d.deck || 0, zm = mainZ(d), pts = [], far = 900, thr = 170;
  const curve = (x0, x1, z0, z1) => { for (let i = 1; i < 16; i++) { const u = i / 16, k = u * u * (3 - 2 * u); pts.push({ x: x0 + (x1 - x0) * u, y, z: z0 + (z1 - z0) * k }); } };
  pts.push({ x: d.P1 + far, y, z: zm }, { x: d.P1 + thr, y, z: zm }); curve(d.P1 + thr, d.P1 + 25, zm, t.z); pts.push({ x: d.P1 + 25, y, z: t.z });
  if (d.kind === 'T') pts.push({ x: d.P0 + 1, y, z: t.z });
  else { pts.push({ x: d.P0 - 25, y, z: t.z }); curve(d.P0 - 25, d.P0 - thr, t.z, zm); pts.push({ x: d.P0 - thr, y, z: zm }, { x: d.P0 - far, y, z: zm }); }
  return mkPath(pts);
}
const hasPlat = (d, t) => !t.siding && d.platforms.some(p => Math.abs(Math.abs(t.z - p.z) - p.w / 2) <= 3);
function railInstances(scene, paths, y0) {
  let nSeg = 0, nSl = 0; paths.forEach(P => { nSeg += P.pts.length - 1; nSl += Math.floor(P.len / 1.2); });
  const ball = new THREE.InstancedMesh(unitBox, SM.ballast, nSeg), rails = new THREE.InstancedMesh(unitBox, SM.rail, nSeg * 2), sl = new THREE.InstancedMesh(unitBox, SM.sleeper, nSl);
  ball.receiveShadow = sl.receiveShadow = true; let i = 0, k = 0;
  paths.forEach((P, pi) => {
    for (let j = 0; j < P.pts.length - 1; j++) {
      const a = P.pts[j], b = P.pts[j + 1], dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1e-6, nx = -dz / L, nz = dx / L;
      dummy.rotation.set(0, Math.atan2(dx, dz), 0);
      dummy.position.set((a.x + b.x) / 2, a.y + 0.15 + pi * 0.002, (a.z + b.z) / 2); dummy.scale.set(3.4, 0.3, L + 0.4); dummy.updateMatrix(); ball.setMatrixAt(i, dummy.matrix);
      [-0.52, 0.52].forEach((o, q) => { dummy.position.set((a.x + b.x) / 2 + nx * o, a.y + 0.47, (a.z + b.z) / 2 + nz * o); dummy.scale.set(0.09, 0.14, L + 0.05); dummy.updateMatrix(); rails.setMatrixAt(i * 2 + q, dummy.matrix); });
      i++;
    }
    const n = Math.floor(P.len / 1.2);
    for (let j = 0; j < n; j++) { const p = pAtS(P, (j + 0.5) * 1.2); dummy.rotation.set(0, Math.atan2(p.dx, p.dz), 0); dummy.position.set(p.x, p.y + 0.34, p.z); dummy.scale.set(1.9, 0.1, 0.25); dummy.updateMatrix(); sl.setMatrixAt(k++, dummy.matrix); }
  });
  scene.add(ball, rails, sl);
}
function gable(len, w, h, m) {
  const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); g.translate(0, 0, -len / 2); g.rotateY(Math.PI / 2);
  const o = new THREE.Mesh(g, m); o.castShadow = true; o.receiveShadow = true; return o;
}
const bx = (sc, w, h, d, m, x, y, z) => { const o = box(w, h, d, m); o.position.set(x, y, z); sc.add(o); return o; };
const STN_VEH = {};
function stnVehGeo(t) {
  if (STN_VEH[t]) return STN_VEH[t];
  const P = [], add = (w, h, d, c, x, y, z) => P.push({ w, h, d, c: new THREE.Color(c), x, y, z });
  add(2.5, 0.7, 18.6, 0x2b313a, 0, 1.05, 0); [-6.4, 6.4].forEach(z => add(2.2, 0.75, 2.8, 0x1f242b, 0, 0.92, z));
  if (t === 'cnr') { add(2.85, 3.0, 19, 0xF4F5F8, 0, 2.9, 0); add(2.88, 0.3, 19.02, 0xC8102E, 0, 1.75, 0); add(2.88, 0.16, 19.02, 0x13294B, 0, 2.05, 0); add(2.88, 0.7, 17, 0x203047, 0, 3.3, 0); add(2.6, 0.4, 19, 0x8f99a6, 0, 4.55, 0); }
  else if (t === 'red') { add(2.85, 3.0, 19, 0xF4F5F8, 0, 2.9, 0); add(2.88, 1.1, 19.02, 0xC8102E, 0, 1.95, 0); add(2.88, 0.8, 17, 0x203047, 0, 3.4, 0); add(2.6, 0.3, 19, 0xb7bfca, 0, 4.5, 0); }
  else if (t === 'frt') { add(2.6, 0.25, 19, 0x7c8693, 0, 1.55, 0); add(2.5, 2.5, 8.6, [0x13294b, 0xf5b400, 0xc62f3c, 0x2f6bff][Math.floor(Math.random() * 4)], 0, 2.95, -4.6); add(2.5, 2.5, 8.6, [0x8a96a8, 0x14a37f, 0xe2772b][Math.floor(Math.random() * 3)], 0, 2.95, 4.6); }
  const pos = [], nor = [], col = [], idx = [];
  for (const q of P) { const g = new THREE.BoxGeometry(q.w, q.h, q.d); g.translate(q.x, q.y, q.z); const b = pos.length / 3, A = g.attributes.position.array, N = g.attributes.normal.array; for (let i = 0; i < A.length; i++) { pos.push(A[i]); nor.push(N[i]); } for (let i = 0; i < A.length / 3; i++) col.push(q.c.r, q.c.g, q.c.b); for (const i of g.index.array) idx.push(b + i); g.dispose(); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.setIndex(idx);
  return (STN_VEH[t] = geo);
}
function stnVehMesh(t) { return trainModel(t); }
const isCab = t => /^(THN|NKF|APD|ASR|red|cab)$/.test(t);
function steamDisplay(sc, x, z, label) {   // preserved steam locomotive on a plinth (e.g. at Ubon Ratchathani)
  const g = new THREE.Group(), blk = mat(0x1D232B), red = mat(0x8E2B2B);
  bx(g, 2.6, 0.5, 16, SM.concrete, 0, 0.25, 0); bx(g, 2.2, 2.2, 9, blk, 0, 2.2, 1.5); bx(g, 2.6, 2.8, 3.2, blk, 0, 2.6, -4.4); bx(g, 2.7, 0.3, 3.4, red, 0, 4.1, -4.4);
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 9, 16), blk); boiler.rotation.x = Math.PI / 2; boiler.position.set(0, 2.6, 1.5); g.add(boiler);
  const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 1.2, 10), blk); chim.position.set(0, 4.1, 5.2); g.add(chim);
  for (const zz of [-1.6, 0.6, 2.8]) for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 16), red); w.rotation.z = Math.PI / 2; w.position.set(s * 1.05, 1.35, zz); g.add(w); }
  g.position.set(x, 0, z); g.rotation.y = Math.PI / 2; sc.add(g);
  if (label) { const lb = tLabel(label, 'รถจักรไอน้ำจัดแสดง', 300); lb.scale.set(20, 6.4, 1); lb.position.set(x, 11, z); sc.add(lb); }
}
function turntable(sc, x, z) { const pit = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.4, 40), SM.concrete); pit.position.set(x, 0.1, z); sc.add(pit); bx(sc, 21, 0.5, 3, SM.steel, x, 0.45, z).rotation.y = 0.4; const lb = tLabel('วงเวียนกลับรถจักร', '', 260); lb.scale.set(16, 5, 1); lb.position.set(x, 8, z); sc.add(lb); }

// ---------- buildings by real style ----------
function buildLanna(sc, d) {      // Chiang Mai: single-storey hall with layered Thai gable roofs and a porch
  const z = d.bz, cx = 150;
  bx(sc, 40, 7, d.bd, SM.white, cx, 3.5, z);
  const r1 = gable(46, d.bd + 4, 7, SM.tile); r1.position.set(cx, 7, z); sc.add(r1);
  const r2 = gable(30, d.bd - 4, 5, SM.tile); r2.position.set(cx, 11.5, z); sc.add(r2);
  for (const s of [-1, 1]) {
    bx(sc, 30, 5.2, d.bd - 4, SM.white, cx + s * 36, 2.6, z);
    const r = gable(34, d.bd, 4.6, SM.tile); r.position.set(cx + s * 36, 5.2, z); sc.add(r);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 6), SM.yellow); fin.position.set(cx + s * 23, 13.4, z - d.bd / 2 + 2); fin.rotation.z = s * 0.5; sc.add(fin);
  }
  for (let k = -3; k <= 3; k++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 6, 10), SM.white); c.position.set(cx + k * 4, 3, z - d.bd / 2 - 4); c.castShadow = true; sc.add(c); }
  const porch = gable(30, 9, 3.4, SM.tile); porch.position.set(cx, 6, z - d.bd / 2 - 4); sc.add(porch);
  for (let k = -6; k <= 6; k++) if (Math.abs(k) > 1) bx(sc, 2.2, 2.6, 0.2, SM.glass, cx + k * 5.6, 3.4, z - d.bd / 2 - 0.05);
  const sign = tLabel('สถานีเชียงใหม่', 'CHIANG MAI', 360); sign.scale.set(30, 8, 1); sign.position.set(cx, 24, z - 6); sc.add(sign);
}
function buildModern(sc, d) {     // Nong Khai: modern terminal with a broad canopy and a customs block
  const z = d.bz, cx = -40;
  bx(sc, d.bw, 6.5, d.bd, SM.cream, cx, 3.25, z);
  for (let k = 0; k < 12; k++) bx(sc, 4.2, 4.2, 0.2, SM.glass, cx - d.bw / 2 + 4 + k * 5.6, 3.2, z - d.bd / 2 - 0.05);
  const roof = gable(d.bw + 8, d.bd + 10, 6, SM.tileO); roof.position.set(cx, 6.5, z); sc.add(roof);
  const can = bx(sc, d.bw + 30, 0.5, 12, SM.steel, cx, 6.2, z - d.bd / 2 - 6); can.castShadow = true;
  for (let k = -5; k <= 5; k++) bx(sc, 0.5, 6, 0.5, SM.steel, cx + k * 9, 3, z - d.bd / 2 - 11.5);
  const sign = tLabel('สถานีหนองคาย', 'NONG KHAI', 360); sign.scale.set(28, 7.5, 1); sign.position.set(cx, 18, z - 4); sc.add(sign);
  // customs & immigration
  bx(sc, 26, 5, 14, SM.white, 60, 2.5, z - 2); const cr = gable(28, 16, 3, SM.tileO); cr.position.set(60, 5, z - 2); sc.add(cr);
  const cs = tLabel('ด่านพรมแดน', 'ตม. · ศุลกากร', 260); cs.scale.set(16, 6, 1); cs.position.set(60, 13, z - 2); sc.add(cs);
}
function buildMid(sc, d) {        // Ubon Ratchathani: two-storey mid-century concrete hall with a clock tower
  const z = d.bz, cx = 150;
  bx(sc, d.bw, 10, d.bd, SM.cream, cx, 5, z);
  for (const y of [3, 7.6]) for (let k = 0; k < 14; k++) bx(sc, 4, 2, 0.2, SM.glass, cx - d.bw / 2 + 4 + k * 6, y, z - d.bd / 2 - 0.05);
  bx(sc, d.bw + 3, 0.6, d.bd + 3, SM.concrete, cx, 10.3, z);
  bx(sc, 9, 20, 9, SM.white, cx, 10, z - d.bd / 2 + 4);
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.6, 32), mat(0xFBF7EC)); face.position.set(cx, 16.5, z - d.bd / 2 - 0.6); face.rotation.y = Math.PI; sc.add(face);
  bx(sc, 60, 0.45, 8, SM.concrete, cx, 5, z - d.bd / 2 - 4);
  const sign = tLabel('สถานีอุบลราชธานี', 'UBON RATCHATHANI', 400); sign.scale.set(32, 7.6, 1); sign.position.set(cx, 26, z - 4); sc.add(sign);
}
function buildColonial(sc, d) {   // Hat Yai Junction: two-storey colonial building with arched verandas
  const z = d.bz, cx = 0;
  bx(sc, d.bw, 11, d.bd, mat(0xEAD9A8), cx, 5.5, z);
  for (const y of [3.5, 8.3]) for (let k = 0; k < 18; k++) {
    const a = new THREE.Mesh(new THREE.CircleGeometry(1.7, 16, 0, Math.PI), SM.dark); a.position.set(cx - d.bw / 2 + 4 + k * 6, y + 0.6, z - d.bd / 2 - 0.06); a.rotation.y = Math.PI; sc.add(a);
    bx(sc, 3.4, 1.2, 0.12, SM.dark, cx - d.bw / 2 + 4 + k * 6, y, z - d.bd / 2 - 0.06);
  }
  bx(sc, d.bw + 2, 0.6, d.bd + 2, SM.white, cx, 6.6, z);
  const roof = gable(d.bw + 4, d.bd + 4, 4.5, SM.tileO); roof.position.set(cx, 11, z); sc.add(roof);
  const ped = gable(18, 10, 5, SM.white); ped.rotation.y = 0; ped.position.set(cx, 11, z - d.bd / 2 + 2); sc.add(ped);
  const face = new THREE.Mesh(new THREE.CircleGeometry(1.9, 32), mat(0xFBF7EC)); face.position.set(cx, 13.4, z - d.bd / 2 - 1.2); face.rotation.y = Math.PI; sc.add(face);
  const sign = tLabel('สถานีชุมทางหาดใหญ่', 'HAT YAI JUNCTION', 400); sign.scale.set(34, 8, 1); sign.position.set(cx, 25, z - 4); sc.add(sign);
}
function buildGrand(sc, d) {      // Krung Thep Aphiwat: three-level hall, long-distance + Red Line on level 2, vaulted roof
  const y = d.deck, x0 = -300, x1 = 300, z0 = -26, z1 = 196, cx = 0, cz = (z0 + z1) / 2;
  bx(sc, x1 - x0, y - 0.4, z1 - z0, SM.concrete, cx, (y - 0.4) / 2, cz);
  bx(sc, x1 - x0, 0.4, z1 - z0, mat(0xBFC4CC), cx, y - 0.2, cz);
  for (let x = x0; x <= x1; x += 30) for (const z of [z0, z1]) bx(sc, 1.6, 30, 1.6, SM.white, x, 15, z);
  for (let x = x0 + 30; x < x1; x += 60) for (let z = z0 + 26; z < z1; z += 52) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 22, 10), SM.white); c.position.set(x, y + 11, z); sc.add(c); }
  for (let z = z0; z < z1; z += 37) {
    const v = new THREE.Mesh(new THREE.CylinderGeometry(18.5, 18.5, x1 - x0, 32, 1, true, 0, Math.PI), SM.glassRoof);
    v.rotation.z = Math.PI / 2; v.scale.x = 0.4; v.position.set(cx, 30, z + 18.5); sc.add(v);
    bx(sc, x1 - x0, 0.8, 1.2, SM.white, cx, 30, z);
  }
  // front façade (south) with glass curtain wall and entrance canopy
  for (let x = x0 + 20; x < x1; x += 40) bx(sc, 36, 18, 0.4, SM.glass, x, y + 9, z0 - 0.6);
  bx(sc, 200, 1, 18, SM.white, cx, 8, z0 - 10);
  const sign = tLabel('สถานีกลางกรุงเทพอภิวัฒน์', 'KRUNG THEP APHIWAT CENTRAL TERMINAL', 560); sign.scale.set(90, 15, 1); sign.position.set(cx, 46, z0 - 4); sc.add(sign);
  // MRT Bang Sue entrance
  bx(sc, 14, 4, 8, SM.blueSign, -180, 2, z0 - 46); const ms = tLabel('MRT', 'บางซื่อ', 200); ms.scale.set(10, 4.5, 1); ms.position.set(-180, 9, z0 - 46); sc.add(ms);
  // Red Line and high-speed sections (labels)
  const rl = tLabel('รถไฟฟ้าสายสีแดง', 'ชานชาลา 4 ราง', 320); rl.scale.set(28, 8, 1); rl.position.set(230, y + 16, 97); sc.add(rl);
  const hs = tLabel('รถไฟความเร็วสูง', '10 ชานชาลา · สำรองอนาคต', 360); hs.scale.set(32, 8, 1); hs.position.set(230, y + 16, 152); sc.add(hs);
}
function stnExtras(sc, d) {
  const ex = d.extras || [];
  if (ex.includes('mountains')) {
    const g = [mat(0x5E8C4A), mat(0x6E9A56), mat(0x7FA668)];
    for (let i = 0; i < 16; i++) { const h = 60 + rng() * 90, m = new THREE.Mesh(new THREE.ConeGeometry(70 + rng() * 60, h, 7), g[i % 3]); m.position.set(-330 - rng() * 220, h / 2 - 4, -260 + i * 40 + rng() * 20); m.castShadow = true; sc.add(m); }
    const ds = tLabel('ดอยสุเทพ', 'ทิศตะวันตก', 260); ds.scale.set(24, 9, 1); ds.position.set(-420, 140, 40); sc.add(ds);
  }
  if (ex.includes('hills')) for (let i = 0; i < 10; i++) { const h = 30 + rng() * 40, m = new THREE.Mesh(new THREE.ConeGeometry(60 + rng() * 40, h, 7), mat(0x6E9A56)); m.position.set(-400 + i * 90, h / 2 - 3, 330 + rng() * 80); sc.add(m); }
  if (ex.includes('mekong')) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(420, 1400).rotateX(-Math.PI / 2), SM.water); r.position.set(d.P1 + 700, 0.1, 0); sc.add(r);
    const lb = tLabel('แม่น้ำโขง', 'MEKONG', 240); lb.scale.set(22, 9, 1); lb.position.set(d.P1 + 700, 18, -120); sc.add(lb);
  }
  if (ex.includes('bridge')) {
    const zm = mainZ(d);
    bx(sc, 470, 1.2, 12, SM.concrete, d.P1 + 700, 3.4, zm);
    for (let x = d.P1 + 480; x <= d.P1 + 920; x += 44) { bx(sc, 3, 3.4, 8, SM.concrete, x, 1.7, zm); bx(sc, 0.6, 7, 0.6, SM.steel, x, 7.4, zm - 6); bx(sc, 0.6, 7, 0.6, SM.steel, x, 7.4, zm + 6); }
    bx(sc, 470, 0.6, 0.6, SM.steel, d.P1 + 700, 10.6, zm - 6); bx(sc, 470, 0.6, 0.6, SM.steel, d.P1 + 700, 10.6, zm + 6);
  }
  if (ex.includes('mun')) { const r = new THREE.Mesh(new THREE.PlaneGeometry(2400, 120).rotateX(-Math.PI / 2), SM.water); r.position.set(150, 0.1, 300); sc.add(r); const lb = tLabel('แม่น้ำมูล', 'ฝั่งเมืองอุบลฯ', 260); lb.scale.set(22, 8, 1); lb.position.set(150, 16, 300); sc.add(lb); }
  if (ex.includes('locoshed')) {
    const sx = d.kind === 'T' ? 120 : -60, sz = Math.max(...d.tracks.map(t => t.z)) + 22;
    bx(sc, 70, 9, 16, mat(0xB7A68A), sx, 4.5, sz); const r = gable(74, 18, 4, SM.steel); r.position.set(sx, 9, sz); sc.add(r);
    const lb = tLabel('โรงรถจักร', '', 200); lb.scale.set(14, 5, 1); lb.position.set(sx, 18, sz); sc.add(lb);
    const loco = stnVehMesh(pickOne(['GEK', 'ALS', 'HID'])); loco.position.set(sx + 40, 0, sz); loco.rotation.y = Math.PI / 2; sc.add(loco);
  }
  if (ex.includes('footbridge')) {
    const zs = d.platforms.map(p => p.z), zMin = Math.min(...zs) - 2, zMax = Math.max(...zs) + 2;
    bx(sc, 4, 0.7, zMax - zMin, SM.steel, 20, 7.5, (zMin + zMax) / 2); bx(sc, 4, 2.6, zMax - zMin, SM.glassRoof, 20, 9.2, (zMin + zMax) / 2);
    zs.forEach(z => bx(sc, 3, 7.5, 3, SM.steel, 20, 3.75, z));
  }
  if (ex.includes('steam')) steamDisplay(sc, d.id === 'UBN' ? 120 : 150, d.bz - d.bd / 2 - 22, d.id === 'UBN' ? 'NBL หมายเลข 180' : '');
  if (ex.includes('turntable')) turntable(sc, 60, Math.max(...d.tracks.map(t => t.z)) + 40);
  if (ex.includes('redline')) {}
  if (ex.includes('songthaew')) { for (let i = 0; i < 8; i++) { const c = bx(sc, 2, 2, 4.4, mat(0xC8102E), 110 + i * 7, 1, d.bz - d.bd / 2 - 24); c.castShadow = true; } }
  if (ex.includes('city') || d.id === 'KRT') {
    const n = 90, city = new THREE.InstancedMesh(unitBox, mat(0xffffff), n), cc = [0xffffff, 0xdfe8f7, 0xeef1f5, 0xcfdcf2, 0xf6efe4].map(c => new THREE.Color(c)); city.castShadow = true;
    let ci = 0; for (let k = 0; k < 300 && ci < n; k++) { const x = -800 + rng() * 1600, z = rng() < 0.5 ? -170 - rng() * 260 : 260 + rng() * 240, h = 10 + rng() * rng() * 110; dummy.rotation.set(0, 0, 0); dummy.position.set(x, h / 2, z); dummy.scale.set(18 + rng() * 30, h, 18 + rng() * 30); dummy.updateMatrix(); city.setMatrixAt(ci, dummy.matrix); city.setColorAt(ci, cc[ci % 5]); ci++; }
    city.count = ci; sc.add(city);
  }
  if (ex.includes('trees')) {
    const pts = []; for (let x = d.P0 - 60; x <= d.P1 + 60; x += 14) { pts.push([x, d.bz - d.bd / 2 - 30 - rng() * 30]); if (rng() < 0.6) pts.push([x + 5, Math.max(...d.tracks.map(t => t.z)) + 45 + rng() * 60]); }
    const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.45, 1, 6), SM.wood, pts.length), cr = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 9, 7), mat(0xffffff, { roughness: 0.9 }), pts.length);
    const g1 = new THREE.Color(0x4E8B3A), g2 = new THREE.Color(0x6FA34B); tr.castShadow = cr.castShadow = true;
    pts.forEach(([x, z], i) => { const h = 4 + rng() * 3, s = 3 + rng() * 2; dummy.rotation.set(0, 0, 0); dummy.position.set(x, h / 2, z); dummy.scale.set(1, h, 1); dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix); dummy.position.set(x, h + 1.4, z); dummy.scale.set(s * 1.3, s * 0.8, s * 1.3); dummy.updateMatrix(); cr.setMatrixAt(i, dummy.matrix); cr.setColorAt(i, i % 2 ? g1 : g2); });
    sc.add(tr, cr);
  }
}
function stnBuild(id) {
  if (STN.built[id]) return STN.built[id];
  const d = STN_DEFS[id], sc = new THREE.Scene(), y = d.deck || 0;
  const h = new THREE.HemisphereLight(0xffffff, 0xb9c4d4, 0.8); sc.add(h);
  const s = new THREE.DirectionalLight(0xffffff, 0.7); s.position.set((d.P0 + d.P1) / 2 + 160, 260, 160); s.target.position.set((d.P0 + d.P1) / 2, 0, 20); sc.add(s.target);
  s.castShadow = true; s.shadow.mapSize.set(2048, 2048); Object.assign(s.shadow.camera, { left: -500, right: 500, top: 360, bottom: -360, near: 10, far: 1200 }); s.shadow.bias = -0.0008; sc.add(s);
  const ground = box(3200, 2, 1400, SM.ground); ground.position.set((d.P0 + d.P1) / 2, -1, 40); ground.castShadow = false; sc.add(ground);
  const paths = d.tracks.map(t => stnTrackPath(d, t));
  // draw: each track inside the throats, plus the main line(s) once
  const inner = paths.map(P => mkPath(P.pts.filter(p => p.x <= d.P1 + 170.01 && (d.kind === 'T' || p.x >= d.P0 - 170.01))));
  const zm = mainZ(d), mains = [mkPath([{ x: d.P1 + 170, y, z: zm }, { x: d.P1 + 900, y, z: zm }])];
  if (d.kind === 'X') mains.push(mkPath([{ x: d.P0 - 900, y, z: zm }, { x: d.P0 - 170, y, z: zm }]));
  if (d.split) mains.push(mkPath([{ x: d.P1 + 260, y, z: zm }, { x: d.P1 + 420, y, z: zm + 40 }, { x: d.P1 + 900, y, z: zm + 160 }]));
  if (d.red) d.red.forEach(z => mains.push(mkPath([{ x: -900, y, z }, { x: 900, y, z }])));
  if (d.hsr) d.hsr.forEach(z => mains.push(mkPath([{ x: -260, y, z }, { x: 260, y, z }])));
  railInstances(sc, inner.concat(mains));
  if (y) {   // viaduct approaches and throat decks outside the hall
    for (let x = -900; x <= 900; x += 30) if (x < -300 || x > 300) bx(sc, 6, y - 0.3, 5, SM.concrete, x, (y - 0.3) / 2, zm);
    bx(sc, 520, 0.6, 12, SM.concrete, -640, y - 0.1, zm); bx(sc, 520, 0.6, 12, SM.concrete, 640, y - 0.1, zm);
    const zs = d.tracks.map(t => t.z), za = Math.min(...zs) - 4, zb = Math.max(...zs) + 4;
    for (const sx of [-1, 1]) { bx(sc, 100, 0.6, zb - za, SM.concrete, sx * 340, y - 0.1, (za + zb) / 2); for (let x = 300; x <= 390; x += 30) for (let z = za + 4; z < zb; z += 20) bx(sc, 3, y - 0.3, 3, SM.concrete, sx * x, (y - 0.3) / 2, z); }
  }
  // platforms, edges and canopies
  const pl0 = d.kind === 'T' ? d.P0 - 2 : d.P0, pl1 = d.P1;
  d.platforms.forEach(p => {
    const pb = box(pl1 - pl0, 1, p.w, SM.plat); pb.position.set((pl0 + pl1) / 2, y + 0.5, p.z); pb.castShadow = false; sc.add(pb);
    [-1, 1].forEach(sd => { const e = box(pl1 - pl0, 0.04, 0.35, SM.edge); e.position.set((pl0 + pl1) / 2, y + 1.02, p.z + sd * (p.w / 2 - 0.3)); e.castShadow = false; sc.add(e); });
    if (!d.deck && p.w >= 5) {
      const len = Math.min(180, pl1 - pl0 - 20), cx = d.kind === 'T' ? pl0 + len / 2 + 6 : (pl0 + pl1) / 2;
      const cm = SM.canopy || (SM.canopy = {}), key = d.style === 'lanna' ? 'tile' : d.style === 'colonial' ? 'tileO' : 'steel';
      const cmat = cm[key] || (cm[key] = Object.assign(SM[key].clone(), { transparent: true, opacity: 0.5, depthWrite: false }));
      const roof = d.style === 'lanna' ? gable(len, p.w + 1.6, 1.6, cmat) : box(len, 0.35, p.w + 1.2, cmat); roof.castShadow = false;
      roof.position.set(cx, 5.2, p.z); sc.add(roof);
      for (let x = cx - len / 2 + 6; x < cx + len / 2; x += 18) bx(sc, 0.3, 4.2, 0.3, SM.steel, x, 3.1, p.z);
    }
  });
  d.tracks.forEach(t => { if (d.kind === 'T') bx(sc, 1.2, 1.5, 2.6, SM.buffer, d.P0 - 0.6, y + 0.9, t.z); const lb = tLabel(String(t.n)); lb.scale.set(5, 1.9, 1); lb.position.set((d.kind === 'T' ? d.P0 + 12 : d.P1 - 12), y + 5, t.z); sc.add(lb); });
  ({ lanna: buildLanna, modern: buildModern, midcentury: buildMid, colonial: buildColonial, grand: buildGrand })[d.style](sc, d);
  stnExtras(sc, d);
  const [wl, el] = STN_END[id] || ['', ''];
  if (el) { const l = tLabel(el, '', 420); l.scale.set(34, 7.5, 1); l.position.set(d.P1 + 260, y + 14, zm); sc.add(l); }
  if (wl) { const l = tLabel(wl, '', 420); l.scale.set(34, 7.5, 1); l.position.set(d.P0 - 260, y + 14, zm); sc.add(l); }
  const lampList = []; d.platforms.forEach(p => { for (let x = pl0 + 10; x <= pl1 - 10; x += 34) lampList.push([x, p.z]); });
  const lamps = makeLamps(lampList, 6.5 + y, sc);
  const root = new THREE.Group(); sc.add(root);
  const red = [];
  if (d.red) d.red.slice(0, 2).forEach((z, i) => { const g = new THREE.Group(); for (let k = 0; k < 6; k++) { const m = stnVehMesh(k === 0 || k === 5 ? 'red' : 'red_car'); m.rotation.y = k === 5 ? -Math.PI / 2 : Math.PI / 2; m.position.set(-k * 20.6, y, 0); g.add(m); } g.position.set(-700 + i * 600, 0, z); sc.add(g); red.push({ g, v: i ? -1 : 1, x: -700 + i * 600 }); });
  return (STN.built[id] = { sc, lights: { h, s }, paths, lamps, root, red, meshes: {} });
}

// ---------- simulation ----------
function stnNew(id) { return { v: 1, id, now: 6 * 3600, speed: 1, nextId: 1, crew: 3, genDay: -1, services: [], lockE: 0, lockW: 0, stats: { dep: 0, onTime: 0, rev: 0, holdMin: 0 }, log: [] }; }
function slog(S, text, kind = '') { S.log.unshift({ t: hm(S.now), text, kind }); S.log.length = Math.min(S.log.length, 40); }
function railKm(a, b) { const P = railPath(a, b); if (!P) return null; let L = 0; for (let i = 1; i < P.length; i++) L += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z); return L * UNIT_KM; }
/** Real timetable events at this station, including estimated passing times for trains that run through it. */
function stnEvents(id) {
  const out = [], d = STN_DEFS[id], seen = new Set();
  for (const t of TT) {
    if (t.no === '45') continue;   // runs attached to train 37 out of Krung Thep Aphiwat
    const dep = toSec(t.dep), arr0 = toSec(t.arr), arr = arr0 < dep ? arr0 + 86400 : arr0, name = `${t.cls} ${t.no}${t.no === '37' ? '/45' : ''}`;
    if (t.from === id) out.push({ name, cls: t.cls, mode: 'orig', t: dep, other: t.to, real: true });
    else if (t.to === id) out.push({ name, cls: t.cls, mode: 'term', t: arr0, other: t.from, real: true });
    else if (id === 'NKI' && (t.to === 'VTE' || t.from === 'VTE')) out.push({ name, cls: t.cls, mode: 'thru', t: (t.to === 'VTE' ? arr - 2100 : dep + 2100) % 86400, other: t.to === 'VTE' ? t.from : t.to, real: true, est: true, dirE: t.to === 'VTE' });
    else if (GEO.snap[t.from] != null && GEO.snap[t.to] != null && GEO.snap[id] != null) {
      const a = railKm(t.from, id), b = railKm(id, t.to), c = railKm(t.from, t.to);
      if (a && b && c && Math.abs(a + b - c) < c * 0.03) out.push({ name, cls: t.cls, mode: 'thru', t: Math.round(dep + (arr - dep) * a / c) % 86400, other: `${ttName(t.from)} → ${ttName(t.to)}`, real: true, est: true, dirE: true });
    }
  }
  return out;
}
const STN_EAST = { KRT: ['CMI', 'NKI', 'UBN', 'VTE', 'UDN'], HDY: ['PBR', 'SGK'], NKI: ['VTE'] };
const stnEastOf = (id, other) => (STN_EAST[id] || []).includes(other);
function stnMakeSvc(S, d, e, day) {
  const C = STN_CLS[e.cls] || { rev: 6000, kind: Math.random() < 0.5 ? 'LH' : 'PP', veh: [4, 7], car: 'coach' };
  const n = rint(C.veh[0], C.veh[1]);
  const loco = C.car === 'cnr' ? 'HID' : pickOne(e.real ? ['ALS', 'HID'] : ['GEK', 'ALS', 'HID']);
  const dmu = e.cls === 'ด่วนพิเศษ (ดีเซลราง)' ? 'ASR' : e.cls === 'Shuttle' ? 'APD' : pickOne(['THN', 'NKF']);
  const veh = C.kind === 'LH' ? [loco].concat(Array(n - 1).fill(C.car)) : [dmu].concat(Array(Math.max(1, n - 2)).fill(dmu + '_car'), [dmu]);
  const base = day * 86400 + e.t;
  const east = e.dirE != null ? e.dirE : stnEastOf(d.id, e.other);
  const sideIn = d.kind === 'T' ? 'E' : e.mode === 'thru' ? (east ? 'W' : 'E') : e.mode === 'orig' ? (east ? 'W' : 'E') : (east ? 'E' : 'W');
  const svc = { id: 'V' + (S.nextId++), name: e.name, cls: e.cls, real: !!e.real, est: !!e.est, mode: e.mode, other: e.other, kind: C.kind, veh, rev: C.rev, side: sideIn, phase: 'sched', track: 0, s: 0, hold: 0, lift: Math.random() < 0.25 };
  if (e.mode === 'orig') { svc.schedArr = base - 45 * 60; svc.schedDep = base; svc.label = `ไป ${ttName(e.other)}`; }
  else if (e.mode === 'term') { svc.schedArr = base; svc.schedDep = base + 25 * 60; svc.label = `จาก ${ttName(e.other)}`; }
  else { svc.schedArr = base - 6 * 60; svc.schedDep = base + 6 * 60; svc.label = typeof e.other === 'string' && e.other.includes('→') ? e.other : `${ttName(e.other)}`; }
  return svc;
}
function stnGenDay(S, day) {
  const d = STN_DEFS[S.id], ev = stnEvents(S.id), L = d.locals;
  let t = 5 * 3600 + rint(0, 30) * 60;
  while (t < 23.5 * 3600) {
    const mode = d.kind === 'T' ? (Math.random() < 0.5 ? 'term' : 'orig') : (Math.random() < 0.6 ? 'thru' : Math.random() < 0.5 ? 'term' : 'orig');
    const from = pickOne(L.from), no = pickOne(L.no) + 2 * rint(0, 3);
    ev.push({ name: `${L.prefix} ${no}`, cls: 'ท้องถิ่น', mode, t, other: from, real: false, dirE: d.kind === 'T' ? false : Math.random() < 0.5 });
    t += rint(L.gap[0], L.gap[1]) * 60;
  }
  ev.forEach(e => { const v = stnMakeSvc(S, d, e, day); if (v.schedArr >= S.now - 120) S.services.push(v); });
  S.genDay = day;
}
const stnCls = s => { const n = s.veh.length; return n <= 4 ? 0 : n <= 6 ? 1 : n <= 9 ? 2 : 3; };
const stnLen = s => s.veh.length * 20;
function stnTrackInfo(S, d, s, t) {
  if (!hasPlat(d, t)) return [false, 'ไม่มีชานชาลา'];
  if (stnCls(s) > t.cls) return [false, 'สั้นเกินไป'];
  const occ = S.services.find(o => o !== s && o.track === t.n && ['entering', 'dwell', 'ready', 'departing'].includes(o.phase));
  if (occ) return [false, `มี ${occ.name}`];
  if (S.services.some(o => o !== s && o.track === t.n && ['approach', 'held'].includes(o.phase))) return [false, 'จองให้ขบวนอื่นแล้ว'];
  if (d.kind === 'X' && s.mode === 'thru' && !t.thru) return [false, 'รางปลายตัน'];
  return [true, 'ว่าง'];
}
function stnPathFor(d, s, built) {
  const t = d.tracks.find(x => x.n === s.track) || d.tracks[0], P = built.paths[d.tracks.indexOf(t)];
  return s.side === 'E' ? P : (P._rev || (P._rev = revPath(P)));
}
function stnStopS(d, s, P) {
  const t = d.tracks.find(x => x.n === s.track) || d.tracks[0];
  const x = d.kind === 'T' ? d.P0 + 3 : s.side === 'E' ? d.P0 + 8 : d.P1 - 8;
  return sOfX(P, x, t.z) || P.len * 0.5;
}
const lockKey = side => (side === 'E' ? 'lockE' : 'lockW');
function stnStep(S, dt) {
  const d = STN_DEFS[S.id], B = STN.built[S.id];
  S.now += dt;
  const day = Math.floor(S.now / 86400);
  if (S.genDay < day) stnGenDay(S, day);
  if (S.genDay === day && S.now % 86400 > 20 * 3600) stnGenDay(S, day + 1);
  const homeS = 900 - 210;   // distance from the far end of the approach to the home signal
  const gr = ctrlOn('ground') ? 1.25 : 1;
  const dwellers = S.services.filter(s => s.phase === 'dwell').sort((a, b) => a.readyAt - b.readyAt);
  dwellers.forEach((s, i) => { if (i >= S.crew) s.readyAt += dt; else s.readyAt -= dt * (gr - 1); });
  for (const s of S.services) {
    if (s.phase === 'sched' && S.now >= s.schedArr - 300) { s.phase = 'approach'; s.s = 0; s.v = 16; }
    if (s.phase === 'approach' || s.phase === 'held') {
      if (!s.track && ctrlOn('app') && s.phase !== 'sched') { const t = d.tracks.filter(t => stnTrackInfo(S, d, s, t)[0]).sort((a, b) => a.cls - b.cls)[0]; if (t) s.track = t.n; }
      const k = lockKey(s.side), canGo = s.track && S[k] <= S.now;
      if (canGo && s.s > homeS - 260) { S[k] = S.now + 1e9; s.phase = 'entering'; s.lock = k; slog(S, `${s.name} ได้รับอาณัติเข้าราง ${s.track}`); }
      else if (s.phase === 'approach') { s.v = Math.min(16, Math.sqrt(2 * 0.5 * Math.max(0, homeS - s.s))); s.s = Math.min(homeS, s.s + s.v * dt); if (s.s >= homeS - 0.5) { s.phase = 'held'; slog(S, `${s.name} หยุดรอที่สัญญาณเข้า`, 'bad'); } }
      if (s.phase === 'held') { s.hold += dt; S.stats.holdMin += dt / 60; pay(1.5 * dt, 'penalty'); }
    }
    if (s.phase === 'entering') {
      const P = stnPathFor(d, s, B), stop = stnStopS(d, s, P), dist = stop - s.s;
      s.v = Math.max(1.2, Math.min(s.v + 0.6 * dt, 12, Math.sqrt(2 * 0.45 * Math.max(0, dist))));
      s.s = Math.min(stop, s.s + s.v * dt);
      if (s.s > 900 - 150 + stnLen(s) && S[s.lock] > S.now + 1e8) S[s.lock] = S.now + 30;
      if (stop - s.s < 0.3) { s.phase = 'dwell'; s.v = 0; s.arrAt = S.now; S[s.lock] = Math.min(S[s.lock], S.now + 20);
        s.readyAt = s.mode === 'term' ? S.now + 18 * 60 : s.mode === 'orig' ? Math.max(S.now + 15 * 60, s.schedDep - 90) : Math.max(S.now + 6 * 60, s.schedDep - 30);
        if (s.lift) s.readyAt += 3 * 60; }
    }
    if (s.phase === 'dwell' && S.now >= s.readyAt) { s.phase = 'ready'; slog(S, `${s.name} ${s.mode === 'term' ? 'ส่งผู้โดยสารลงครบ พร้อมเข้าศูนย์ซ่อม' : 'พร้อมออก'} (ราง ${s.track})`, 'good'); }
    if (s.phase === 'ready' && ctrlOn('dep') && S.now >= s.schedDep - 30) stnRelease(S, s, true);
    if (s.phase === 'departing') {
      s.v = Math.min(16, s.v + 0.5 * dt); s.s += s.v * dt;
      if (s.s > s.clearS && S[s.lock] > S.now + 1e8) S[s.lock] = S.now + 20;
      if (s.s >= s.P.len - 5) { s.phase = 'gone'; s.goneAt = S.now; }
    }
  }
  S.services = S.services.filter(s => s.phase !== 'gone' || S.now - s.goneAt < 5);
}
function stnRelease(S, s, quiet) {
  const d = STN_DEFS[S.id], B = STN.built[S.id];
  const out = d.kind === 'T' ? 'E' : (s.side === 'E' ? 'W' : 'E'), k = lockKey(out);
  if (S[k] > S.now) { if (!quiet) toast('คอขวดด้านทางออกมีขบวนอื่นใช้อยู่ รอสักครู่'); return false; }
  const Pin = stnPathFor(d, s, B), L = stnLen(s);
  if (d.kind === 'T') { s.P = revPath(Pin); s.s = Pin.len - s.s + L; s.dirFlip = true; }
  else { s.P = Pin; }
  s.clearS = d.kind === 'T' ? s.P.len - 900 + 180 + L : s.P.len - 900 + 180 + L;
  S[k] = S.now + 1e9; s.lock = k; s.phase = 'departing'; s.v = 2;
  const late = s.mode === 'term' ? Math.max(0, ((s.arrAt || S.now) - s.schedArr) / 60) : Math.max(0, (S.now - s.schedDep) / 60);
  const rev = Math.round(s.rev * Math.max(0.3, 1 - late * 0.02) * (s.real ? 1.2 : 1));
  earn(rev, 'term'); S.stats.dep++; S.stats.rev += rev; if (late <= 3) S.stats.onTime++;
  gainXP(late <= 3 ? 8 : 4);
  slog(S, `${s.name} ${s.mode === 'term' ? 'ออกไปศูนย์ซ่อม' : 'ออกจากราง ' + s.track} ${late > 3 ? `ช้า ${Math.round(late)} นาที` : 'ตรงเวลา'} · ${baht(rev)}`, late > 3 ? 'bad' : 'good');
  if (!quiet) { sfxCoin(); popupStn(s, '+' + baht(rev), late > 3); }
  return true;
}
function popupStn(s, text, bad) { const B = STN.built[STN.cur]; if (!B) return; const r = B.meshes[s.id]; const p = r && r.vs[0] ? r.vs[0].position : null; if (p) popup(new THREE.Vector3(p.x, p.y + 8, p.z), text, bad); }

// ---------- visuals ----------
function stnSync(S, dt) {
  const d = STN_DEFS[S.id], B = STN.built[S.id], alive = new Set();
  for (const s of S.services) {
    if (s.phase === 'sched' || s.phase === 'gone') continue;
    alive.add(s.id);
    let r = B.meshes[s.id];
    if (!r) { const g = new THREE.Group(), vs = s.veh.map(t => { const m = stnVehMesh(t); m.userData.svc = s.id; g.add(m); return m; }); B.root.add(g); r = B.meshes[s.id] = { g, vs }; }
    const P = s.phase === 'departing' ? s.P : stnPathFor(d, s.track ? s : Object.assign({}, s, { track: d.tracks[0].n }), B);
    s.veh.forEach((t, i) => {
      const f = pAtS(P, s.s - i * 20 - 1), b = pAtS(P, s.s - i * 20 - 19), m = r.vs[i];
      m.position.set((f.x + b.x) / 2, (f.y + b.y) / 2, (f.z + b.z) / 2);
      m.rotation.y = Math.atan2(f.x - b.x, f.z - b.z) + (isCab(t) && i > 0 && i === s.veh.length - 1 ? Math.PI : 0);
    });
  }
  for (const id in B.meshes) if (!alive.has(id)) { B.root.remove(B.meshes[id].g); delete B.meshes[id]; }
  B.red.forEach(r => { r.x += r.v * dt * 60; if (r.x > 900) r.x = -900; if (r.x < -900) r.x = 900; r.g.position.x = r.x; });
}
function stnFrame(raw) {
  const S = stnState(), B = STN.built[STN.cur]; if (!S || !B) return;
  let rem = raw * S.speed * STN_RATE;
  while (rem > 1e-6) { const dd = Math.min(0.5, rem); stnStep(S, dd); rem -= dd; }
  cam.az += (cam.azT - cam.az) * Math.min(1, raw * 6);
  if (cam.follow) { const r = B.meshes[cam.follow]; if (r && r.vs[0]) { const p = r.vs[Math.floor(r.vs.length / 2)].position; cam.tx += (p.x - cam.tx) * Math.min(1, raw * 3); cam.tz += (p.z - cam.tz) * Math.min(1, raw * 3); } else cam.follow = null; }
  placeCam();
  stnSync(S, raw);
  const d = stnDef();
  { const hr = S.now / 3600 % 24; trainsNight(hr < 5.8 || hr > 18.4 ? 1 : hr < 6.6 ? (6.6 - hr) / 0.8 : hr > 17.6 ? (hr - 17.6) / 0.8 : 0); }
  applyDayNight(S.now / 3600 % 24, B.sc, B.lights.h, B.lights.s, { x: (d.P0 + d.P1) / 2, y: 0, z: 20 }, 520, B.lamps);
  fxRender(B.sc); updatePops(raw);
  STN.uiAcc += raw; if (STN.uiAcc > 0.25) { STN.uiAcc = 0; stnUI(); }
}
function stnPick(e) {
  const B = STN.built[STN.cur]; if (!B) return;
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  const hit = ray.intersectObject(B.root, true).find(h => h.object.userData.svc);
  svSelect(hit ? hit.object.userData.svc : null);
}

// ---------- UI (list, card and platform sheet are shared: see station_view.js) ----------
$('#termStatus').insertAdjacentHTML('afterend', `<div class="topstat" id="stnStatus" hidden>
  <div class="stat money"><span>เงินทุน</span><b id="ssMoney">฿0</b></div><div class="stat"><span>เวลาสถานี</span><b id="ssClock">—</b></div>
  <div class="stat"><span>ออกตรงเวลา</span><b id="ssOnTime">—</b></div><div class="stat"><span>ในชานชาลา</span><b id="ssIn">0</b></div>
  <div class="stat"><span>รอสัญญาณเข้า</span><b id="ssHeld">0</b></div><div class="stat"><span>รายได้สถานี</span><b id="ssRev">฿0</b></div></div>`);
const sAlert = (S, s) => s.phase === 'held' || (s.phase === 'approach' && !s.track) || (s.phase === 'ready' && S.now >= s.schedDep - 60);
const sPhase = s => ({ sched: 'ตามกำหนด', approach: 'กำลังเข้าเขต', held: 'รอสัญญาณเข้า', entering: 'เข้าชานชาลา', dwell: s.mode === 'term' ? 'ส่งผู้โดยสารลง' : s.mode === 'orig' ? 'รับผู้โดยสาร' : 'จอดรับส่ง', ready: s.mode === 'term' ? 'พร้อมเข้าศูนย์ซ่อม' : 'พร้อมออก', departing: 'กำลังออก', gone: 'ออกแล้ว' })[s.phase];
function stnUI() {   // status bar only; the train list/card/sheet are drawn by station_view.js
  const S = stnState(), d = stnDef(); if (!S || MODE !== 'stn') return;
  $('#ssMoney').textContent = baht(state.money); $('#ssClock').textContent = hm(S.now);
  $('#ssOnTime').textContent = S.stats.dep ? Math.round(S.stats.onTime / S.stats.dep * 100) + '%' : '—';
  $('#ssIn').textContent = S.services.filter(s => ['entering', 'dwell', 'ready'].includes(s.phase)).length + '/' + d.tracks.filter(t => hasPlat(d, t)).length;
  const held = S.services.filter(s => s.phase === 'held').length; $('#ssHeld').textContent = held; $('#ssHeld').classList.toggle('neg', held > 0);
  $('#ssRev').textContent = baht(S.stats.rev);
}
function stnShowUI(on) { $('#stnStatus').hidden = !on; }
function stnInfoModal() {
  const d = stnDef();
  modal('sinfo', () => mSet(d.name, `${d.en} · ${d.line}${d.km ? ` · ${fmt(d.km)} กม. จากกรุงเทพ` : ''}`,
    `<h4 class="msec">อ้างอิงสถานที่จริง</h4><ul class="realnotes">${d.real.map(r => `<li>${r}</li>`).join('')}</ul>
     <h4 class="msec">ผังในเกม</h4><p class="info">${d.kind === 'T' ? 'สถานีปลายทาง (รางปลายตัน) ขบวนเข้า-ออกทางเดียว' : 'สถานีผ่าน ขบวนเข้าได้ทั้งสองด้าน'} · ${d.tracks.length} ราง (มีชานชาลา ${d.tracks.filter(t => hasPlat(d, t)).length} ราง) · ชานชาลา ${d.platforms.length} แห่ง</p>
     <p class="info">โมเดลอาคารและผังรางเป็นแบบย่อส่วน จัดตามลักษณะเด่นของสถานีจริง (ชนิดชานชาลา ด้านที่ตั้งอาคาร รูปแบบสถาปัตยกรรม และภูมิทัศน์รอบสถานี) ไม่ใช่แบบก่อสร้างจริง</p>`));
}
function hlpInfoModal() { const d = HLP_REAL; modal('sinfo', () => mSet(d.name, `${d.en} · ${d.line}`, `<h4 class="msec">อ้างอิงสถานที่จริง</h4><ul class="realnotes">${d.real.map(r => `<li>${r}</li>`).join('')}</ul><p class="info">กดปุ่ม ★ ด้านขวาเพื่อดูหน้าสถานี ลานน้ำพุ และถนนพระรามที่ 4 · โมเดลเป็นแบบย่อส่วนตามลักษณะเด่นของสถานีจริง</p>`)); }
function stnBoardModal() {
  const d = stnDef(), b = ttBoard(d.id), S = stnState();
  modal('sboard', () => mSet(`ตารางเดินรถ · ${d.name}`, 'ข้อมูลจริงจากคู่มือการเดินรถ รฟท. + ขบวนผ่าน (เวลาประมาณ)',
    `<div class="board">${stnEvents(d.id).sort((a, b) => a.t - b.t).map(e => `<div class="bd-r ${e.mode === 'orig' ? 'dep' : 'arr'}"><time>${hm(e.t)}</time><span>${e.name}</span><span>${e.mode === 'orig' ? 'ออกไป' : e.mode === 'term' ? 'มาถึงจาก' : 'ผ่าน ·'} ${typeof e.other === 'string' && e.other.includes('→') ? e.other : ttName(e.other)}${e.est ? ' (ประมาณ)' : ''}</span></div>`).join('') || '<p class="info">ไม่มีขบวนในตาราง</p>'}</div>
     <p class="info">นอกจากขบวนจริงแล้ว เกมเพิ่มขบวนท้องถิ่นจำลองเพื่อให้สถานีมีการเดินรถต่อเนื่อง (แสดงเป็นรายการที่ไม่มีป้าย "จริง")</p>`));
}
function stnCrewModal() {
  const S = stnState();
  modal('screw', () => mSet('ทีมบริการชานชาลา', `ทำงานพร้อมกันได้ ${S.crew} ขบวน`, `<div class="slots">${Array.from({ length: S.crew }, () => '<i class="slot free"></i>').join('')}</div><p class="info">ทีมหนึ่งดูแลการส่งลง ทำความสะอาด และรับขึ้นของขบวนที่จอดอยู่ได้ทีละขบวน ขบวนเกินจำนวนทีมจะต้องรอคิว</p>`, null, `<div class="acts"><button class="primary" data-shire ${state.money < 20000 * S.crew ? 'disabled' : ''}>จ้างเพิ่ม 1 ทีม ${baht(20000 * S.crew)}</button></div>`));
}
$('#mmodal').addEventListener('click', e => { const b = e.target.closest('[data-shire]'); if (!b || b.disabled) return; const S = stnState(); if (spend(20000 * S.crew)) { S.crew++; toast(`ทีมบริการเป็น ${S.crew} ทีม`); MCACHE.body = null; stnCrewModal(); } });
const HLP_REAL = { name: 'สถานีกรุงเทพ (หัวลำโพง)', en: 'Bangkok (Hua Lamphong)', line: 'ต้นทางขบวนธรรมดาและรถชานเมือง', km: 0, kind: 'T', tracks: Array.from({ length: 14 }, (_, i) => ({ n: i + 1, z: i })), platforms: Array(8),
  real: ['เปิดใช้งาน 25 มิถุนายน 2459 (ค.ศ. 1916) ด้านหน้าออกแบบโดยมาริโอ ตามัญโญ ร่วมกับอันนิบาเล ริก็อตติ แบบอิตาเลียนนีโอเรอเนสซองส์', 'โถงหลักหลังคาโค้งและหน้าต่างกระจกโค้งบานใหญ่ด้านหน้า มีนาฬิกาอยู่กลางซุ้มโค้ง', 'สถานีปลายตัน 14 ชานชาลา ใต้หลังคาโรงคลุมชานชาลาโค้ง ขบวนเข้า-ออกผ่านคอขวดด้านเดียว', 'ด้านหน้าคือถนนพระรามที่ 4 และมีคลองผดุงกรุงเกษมเลียบข้างสถานี (ลานน้ำพุในเกมเป็นการตกแต่ง ยังไม่ได้ตรวจกับของจริง)', 'ตั้งแต่มกราคม 2566 ขบวนทางไกลย้ายไปกรุงเทพอภิวัฒน์ หัวลำโพงยังรับขบวนธรรมดา รถชานเมือง ขบวนนำเที่ยว และสายตะวันออก'] };
function stnTool(k) { if (k === 'sinfo' && MODE === 'term') hlpInfoModal(); else if (k === 'sinfo') stnInfoModal(); else if (k === 'sboard') stnBoardModal(); else if (k === 'screw') stnCrewModal(); }
TOOLS.stn = [['sinfo', 'ข้อมูลจริง'], ['sboard', 'ตารางจริง'], ['screw', 'ทีมบริการ'], ['ctrl', 'ห้องควบคุม'], ['contracts', 'สัญญา']];
Object.assign(ICONS, { sinfo: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', sboard: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>', screw: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 15.5c.9-.3 1.9-.5 3-.5 2.5 0 4 1.5 4 4"/>' });

// ---------- enter / save ----------
function stnLoad() { try { const o = JSON.parse(localStorage.getItem(STN_SAVE)); if (o && typeof o === 'object') for (const k in o) if (STN_DEFS[k] && o[k].v === 1) STN.st[k] = o[k]; } catch (e) {} }
function stnSave() { try { localStorage.setItem(STN_SAVE, JSON.stringify(STN.st, (k, v) => (k === 'P' ? undefined : v))); } catch (e) {} }
function stnEnter(id) {
  if (!STN_DEFS[id]) return;
  if (!STN.st[id]) STN.st[id] = stnNew(id);
  const S = STN.st[id];
  S.services.forEach(s => { if (s.phase === 'departing') s.phase = 'gone', s.goneAt = S.now; });
  STN.cur = id; svSelect(null);
  stnBuild(id); camStn.home(); camStn.az = camStn.azT;
  setMode('stn');
  if (!S.hinted) { S.hinted = true; toast(`${STN_DEFS[id].name}: เลือกชานชาลาให้ขบวนที่มีเครื่องหมาย ! แล้วปล่อยรถเมื่อพร้อม`); }
}
const stnStars = id => { const S = STN.st[id]; if (!S) return 1; const s = S.stats; return 1 + (s.dep >= 5) + (s.dep >= 5 && s.onTime / s.dep >= 0.8) + (s.dep >= 30) + (s.dep >= 10 && s.holdMin / s.dep < 2); };
stnLoad();
