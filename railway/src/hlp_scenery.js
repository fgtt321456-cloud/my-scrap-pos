// =================== Hua Lamphong: façade, forecourt, fountain, Rama IV traffic, khlong boats ===================
const TB = { cars: null, carState: [], jets: [], boats: [], people: null, walkers: [], flags: [], clock: null };
function thaiFlagTex() {
  const c = document.createElement('canvas'); c.width = 60; c.height = 40; const g = c.getContext('2d');
  [['#A51931', 0, 6.67], ['#F4F5F8', 6.67, 6.67], ['#2D2A4A', 13.33, 13.34], ['#F4F5F8', 26.67, 6.66], ['#A51931', 33.33, 6.67]].forEach(([col, y, h]) => { g.fillStyle = col; g.fillRect(0, y, 60, h); });
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}
function tBeautify() {
  const cz = 42.75, add = (m, x, y, z) => { m.position.set(x, y, z); tScene.add(m); return m; };
  const stone = mat(0xEFE3C8), stoneDk = mat(0xD9C9A6), trim = mat(0xC9B48A), glass = new THREE.MeshStandardMaterial({ color: 0x8FB4D8, roughness: 0.15, metalness: 0.3, emissive: 0x0b1a30 });
  // --- main hall barrel vault and the great arched window (the station's signature front) ---
  const vault = new THREE.Mesh(new THREE.CylinderGeometry(17, 17, 34, 48), mat(0xD8C7A0, { roughness: 0.6 }));
  vault.rotation.z = Math.PI / 2; vault.castShadow = true; add(vault, -78, 16.6, cz);
  for (let x = -94; x <= -62; x += 8) { const rib = new THREE.Mesh(new THREE.TorusGeometry(17.25, 0.35, 6, 40, Math.PI), trim); rib.rotation.y = Math.PI / 2; add(rib, x, 16.6, cz); }
  const arch = new THREE.Mesh(new THREE.CircleGeometry(14.6, 40, 0, Math.PI), glass); arch.rotation.y = -Math.PI / 2; add(arch, -95.15, 16.6, cz);
  const frame = new THREE.Mesh(new THREE.TorusGeometry(15.2, 0.7, 8, 40, Math.PI), stone); frame.rotation.y = -Math.PI / 2; add(frame, -95.3, 16.6, cz);
  for (let k = -3; k <= 3; k++) { const mul = new THREE.Mesh(unitBox, trim); mul.scale.set(0.25, 14.6 * Math.cos(Math.asin(Math.min(0.99, Math.abs(k) * 4.2 / 14.6))), 0.3); mul.position.set(-95.05, 16.6 + mul.scale.y / 2, cz + k * 4.2); tScene.add(mul); }
  // clock in the arch
  const face = add(new THREE.Mesh(new THREE.CircleGeometry(3.1, 40), mat(0xFBF7EC)), -94.9, 25.5, cz); face.rotation.y = -Math.PI / 2;
  const ring = add(new THREE.Mesh(new THREE.TorusGeometry(3.15, 0.25, 6, 40), mat(0x2B313A)), -94.88, 25.5, cz); ring.rotation.y = -Math.PI / 2;
  const hand = (len, w) => { const g = new THREE.Group(), m = new THREE.Mesh(unitBox, mat(0x1D232B)); m.scale.set(0.12, len, w); m.position.y = len / 2; g.add(m); g.position.set(-94.8, 25.5, cz); g.rotation.order = 'YXZ'; tScene.add(g); return g; };
  TB.clock = { h: hand(1.8, 0.32), m: hand(2.6, 0.22) };
  // colonnade, entablature and steps
  for (let k = -4; k <= 4; k++) { if (!k) continue; const c = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 11.6, 14), stone); c.castShadow = true; add(c, -98, 5.8, cz + k * 3.6); }
  const ent = new THREE.Mesh(unitBox, stone); ent.scale.set(3.6, 1.8, 33); ent.castShadow = true; add(ent, -98, 12.5, cz);
  const ped = new THREE.Mesh(unitBox, stoneDk); ped.scale.set(3.8, 0.5, 34); add(ped, -98, 13.6, cz);
  [0, 1, 2].forEach(i => { const s = new THREE.Mesh(unitBox, stoneDk); s.scale.set(2, 0.32, 36 - i * 2); s.receiveShadow = true; add(s, -100.4 + i * 1.4, 0.16 + i * 0.32, cz); });
  // wing windows and cornices on the façade
  TB.winMat = mat(0x2A3A52, { roughness: 0.25 }); TB.glass = glass;
  const winGeo = new THREE.InstancedMesh(unitBox, TB.winMat, 64); let wi = 0;
  for (const side of [-1, 1]) for (let z = 22; z <= 58; z += 4.5) for (const y of [4.6, 10.2]) {
    dummy.rotation.set(0, 0, 0); dummy.position.set(-96.05, y, cz + side * z); dummy.scale.set(0.2, 3.3, 2.2); dummy.updateMatrix(); winGeo.setMatrixAt(wi++, dummy.matrix);
  }
  winGeo.count = wi; tScene.add(winGeo); TB.windows = winGeo;
  [7.6, 13.6, 16.2].forEach(y => { const c = new THREE.Mesh(unitBox, trim); c.scale.set(0.8, 0.45, 124.5); add(c, -96.2, y, cz); });
  for (const side of [-1, 1]) {
    const pav = new THREE.Mesh(unitBox, stone); pav.scale.set(14, 20, 12); pav.castShadow = true; add(pav, -84, 10, cz + side * 58);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(9.4, 6, 4), mat(0x9A6B4F)); roof.rotation.y = Math.PI / 4; add(roof, -84, 23, cz + side * 58);
    const door = new THREE.Mesh(new THREE.CircleGeometry(3.2, 24, 0, Math.PI), glass); door.rotation.y = -Math.PI / 2; add(door, -91.05, 8, cz + side * 58);
  }
  // --- forecourt plaza with lawns and the fountain ---
  const plaza = new THREE.Mesh(unitBox, mat(0xE6DCC6, { roughness: 0.9 })); plaza.scale.set(32, 0.3, 126); plaza.receiveShadow = true; add(plaza, -112, 0.15, cz);
  const grass = mat(0x7FB069, { roughness: 1 });
  for (const side of [-1, 1]) { const l = new THREE.Mesh(unitBox, grass); l.scale.set(20, 0.4, 30); l.receiveShadow = true; add(l, -113, 0.2, cz + side * 36); }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(7.2, 7.6, 1.1, 40), stoneDk); basin.castShadow = true; add(basin, -112, 0.55, cz);
  const water = new THREE.Mesh(new THREE.CircleGeometry(6.7, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4FA3D9, roughness: 0.1, metalness: 0.2, emissive: 0x0d3550 })); add(water, -112, 1.06, cz);
  add(new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 2.4, 16), stone), -112, 1.2, cz);
  // three-headed elephant fountain in front of the station
  const ele = mat(0x8E949C, { roughness: 0.55, metalness: 0.25 });
  add(new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), ele), -112, 3.6, cz).scale.set(1, 0.85, 1);
  for (let k = 0; k < 3; k++) {
    const a = k / 3 * Math.PI * 2 + Math.PI, hx = -112 + Math.cos(a) * 1.3, hz = cz + Math.sin(a) * 1.3;
    add(new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), ele), hx, 4.1, hz);
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.24, 2, 8), ele); tr.position.set(hx + Math.cos(a) * 0.6, 3.2, hz + Math.sin(a) * 0.6); tr.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45); tScene.add(tr);
    for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.CircleGeometry(0.6, 10), ele); ear.position.set(hx - Math.sin(a) * s * 0.7, 4.2, hz + Math.cos(a) * s * 0.7); ear.rotation.y = -a; tScene.add(ear); }
  }
  add(new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.4, 10), mat(0xD4A017, { metalness: 0.6, roughness: 0.3 })), -112, 5.4, cz);
  const jetMat = new THREE.MeshBasicMaterial({ color: 0xE8F6FF, transparent: true, opacity: 0.55, depthWrite: false });
  for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, j = new THREE.Mesh(new THREE.ConeGeometry(0.35, 1, 8), jetMat); j.position.set(-112 + Math.cos(a) * 4.2, 1.6, cz + Math.sin(a) * 4.2); tScene.add(j); TB.jets.push(j); }
  const top = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1, 10), jetMat); top.position.set(-112, 3.5, cz); tScene.add(top); TB.jets.push(top);
  // flags
  const flagMat = new THREE.MeshStandardMaterial({ map: thaiFlagTex(), side: THREE.DoubleSide, roughness: 0.8 });
  for (const z of [cz - 22, cz + 22]) {
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 16, 8), mat(0xC9CED6, { metalness: 0.6 })), -122, 8, z);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(6, 4, 8, 1), flagMat); f.rotation.y = Math.PI / 2; f.position.set(-122, 14, z - 3.1); tScene.add(f); TB.flags.push(f);
  }
  // --- road (Rama IV / Rong Mueang) with traffic ---
  const road = new THREE.Mesh(unitBox, mat(0x4A4F57, { roughness: 0.95 })); road.scale.set(9, 0.2, 520); road.receiveShadow = true; add(road, -132.5, 0.1, 80);
  const dash = new THREE.InstancedMesh(unitBox, new THREE.MeshBasicMaterial({ color: 0xF2F2E8 }), 60);
  for (let i = 0; i < 60; i++) { dummy.rotation.set(0, 0, 0); dummy.position.set(-132.5, 0.22, -175 + i * 8.6); dummy.scale.set(0.25, 0.02, 4); dummy.updateMatrix(); dash.setMatrixAt(i, dummy.matrix); }
  tScene.add(dash);
  const carCols = [0xE8559A, 0xE8559A, 0x9BCB3C, 0xF2D338, 0xF4F5F8, 0xC62F3C, 0x2F6BFF, 0x1D232B, 0xF4F5F8, 0x14A37F].map(c => new THREE.Color(c));
  const N = 18, body = new THREE.InstancedMesh(unitBox, mat(0xffffff, { roughness: 0.45, metalness: 0.2 }), N), cab = new THREE.InstancedMesh(unitBox, mat(0x22303F, { roughness: 0.2 }), N);
  body.castShadow = true;
  for (let i = 0; i < N; i++) { body.setColorAt(i, carCols[i % carCols.length]); TB.carState.push({ lane: i % 2 ? 1 : -1, z: -170 + rng() * 380, v: 9 + rng() * 7, tuk: i % 7 === 3 }); }
  TB.cars = { body, cab, N }; tScene.add(body, cab);
  // Khlong Phadung Krung Kasem alongside the station
  const kh = new THREE.Mesh(new THREE.PlaneGeometry(24, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4E93C2, roughness: 0.15, metalness: 0.25, emissive: 0x0a2236 }));
  add(kh, -150, 0.22, 45);
  for (const x of [-137.6, -162.4]) { const bank = new THREE.Mesh(unitBox, stoneDk); bank.scale.set(1.2, 0.7, 800); add(bank, x, 0.35, 45); }
  // long-tail boats on the khlong
  for (let i = 0; i < 2; i++) {
    const g = new THREE.Group(), hull = new THREE.Mesh(unitBox, mat(0x7A4B2A)); hull.scale.set(1.8, 0.7, 9); hull.position.y = 0.45; g.add(hull);
    const rf = new THREE.Mesh(unitBox, mat(0xF4F5F8)); rf.scale.set(2, 0.15, 5); rf.position.y = 2; g.add(rf);
    g.position.set(-150 + (i ? 4 : -4), 0, -100 + i * 160); tScene.add(g); TB.boats.push({ g, v: i ? -3 : 3.5 });
  }
  // trees: rain trees and palms along the forecourt and the far bank
  const tp = []; for (let z = -16; z <= 102; z += 11) { tp.push([-126, z, z % 22 ? 'p' : 'r']); tp.push([-170, z * 1.6 - 30, 'r']); }
  for (let z = -60; z <= 150; z += 18) tp.push([-178, z, 'r']);
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 1, 6), mat(0x6B4F3A), tp.length);
  const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), mat(0xffffff, { roughness: 0.9 }), tp.length);
  trunk.castShadow = crown.castShadow = true;
  const g1 = new THREE.Color(0x4E8B3A), g2 = new THREE.Color(0x6FA34B), g3 = new THREE.Color(0x3C7A35);
  tp.forEach(([x, z, k], i) => {
    const palm = k === 'p', h = palm ? 9 + rng() * 3 : 4 + rng() * 2;
    dummy.rotation.set(0, 0, 0); dummy.position.set(x, h / 2, z); dummy.scale.set(1, h, 1); dummy.updateMatrix(); trunk.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, h + (palm ? 0.4 : 1.6), z); if (palm) dummy.scale.set(3.2, 1.1, 3.2); else { const s = 3.4 + rng() * 1.8; dummy.scale.set(s * 1.3, s * 0.75, s * 1.3); } dummy.updateMatrix(); crown.setMatrixAt(i, dummy.matrix);
    crown.setColorAt(i, palm ? g3 : (i % 2 ? g1 : g2));
  });
  tScene.add(trunk, crown);
  // people strolling across the forecourt
  const NP = 70; TB.people = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.3, 0.34, 1.75, 6), mat(0xffffff), NP);
  const pc = [0xF4F5F8, 0x2F6BFF, 0xF2A516, 0x14A37F, 0xE2556B, 0xFFB4C8, 0x5B2A86].map(c => new THREE.Color(c));
  for (let i = 0; i < NP; i++) { TB.people.setColorAt(i, pc[i % pc.length]); TB.walkers.push({ x: -124 + rng() * 26, z: cz - 60 + rng() * 120, vx: (rng() - 0.5) * 1.2, vz: (rng() - 0.5) * 2.4 }); }
  tScene.add(TB.people);
  tBeautyTick(0, 0);
}
function tBeautyTick(time, dt) {
  if (!TB.cars) return;
  const { body, cab, N } = TB.cars;
  for (let i = 0; i < N; i++) {
    const c = TB.carState[i]; c.z += c.lane * c.v * dt * 2; if (c.z > 210) c.z = -170; if (c.z < -170) c.z = 210;
    const x = -132.5 + c.lane * 2.2, L = c.tuk ? 2.6 : 4.2;
    dummy.rotation.set(0, 0, 0); dummy.position.set(x, c.tuk ? 0.9 : 0.75, c.z); dummy.scale.set(c.tuk ? 1.4 : 1.8, c.tuk ? 1.2 : 0.9, L); dummy.updateMatrix(); body.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, c.tuk ? 1.75 : 1.45, c.z - c.lane * 0.2); dummy.scale.set(c.tuk ? 1.45 : 1.6, c.tuk ? 0.18 : 0.6, L * (c.tuk ? 0.9 : 0.5)); dummy.updateMatrix(); cab.setMatrixAt(i, dummy.matrix);
  }
  body.instanceMatrix.needsUpdate = cab.instanceMatrix.needsUpdate = true;
  TB.jets.forEach((j, k) => { const s = 1.6 + Math.sin(time * 3 + k) * 0.5; j.scale.set(1, s * (k === TB.jets.length - 1 ? 2.2 : 1), 1); j.position.y = (k === TB.jets.length - 1 ? 3 : 1.1) + j.scale.y / 2; });
  TB.boats.forEach(b => { b.g.position.z += b.v * dt * 2; if (b.g.position.z > 230) b.g.position.z = -150; if (b.g.position.z < -150) b.g.position.z = 230; b.g.rotation.y = b.v > 0 ? 0 : Math.PI; });
  TB.flags.forEach((f, k) => { const p = f.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 3; p.setZ(i, Math.sin(time * 4 + x * 1.3 + k) * 0.18 * x); } p.needsUpdate = true; });
  const cz = 42.75;
  for (let i = 0; i < TB.walkers.length; i++) {
    const w = TB.walkers[i]; w.x += w.vx * dt; w.z += w.vz * dt;
    if (w.x < -126 || w.x > -99) w.vx *= -1; if (w.z < cz - 62 || w.z > cz + 62) w.vz *= -1;
    if (Math.hypot(w.x + 112, w.z - cz) < 8.5) { w.vx *= -1; w.vz *= -1; w.x += w.vx * dt * 2; }
    dummy.rotation.set(0, 0, 0); dummy.position.set(w.x, 1.17, w.z); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); TB.people.setMatrixAt(i, dummy.matrix);
  }
  TB.people.instanceMatrix.needsUpdate = true;
  if (tstate) {
    const hr = tstate.now / 3600 % 24, night = hr < 5.8 || hr > 18.4 ? 1 : hr < 6.6 ? (6.6 - hr) / 0.8 : hr > 17.6 ? (hr - 17.6) / 0.8 : 0;
    trainsNight(night);
    if (TB.night !== night) { TB.night = night; TB.winMat.emissive.setRGB(1.0 * night, 0.78 * night, 0.42 * night); TB.glass.emissive.setRGB(0.05 + 0.75 * night, 0.1 + 0.6 * night, 0.19 + 0.3 * night); }
  }
  if (TB.clock && tstate) { const m = tstate.now / 60 % 60, h = tstate.now / 3600 % 12; TB.clock.m.rotation.x = m / 60 * Math.PI * 2; TB.clock.h.rotation.x = h / 12 * Math.PI * 2; }
}
