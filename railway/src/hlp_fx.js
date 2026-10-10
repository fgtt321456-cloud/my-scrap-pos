
// =================== Hua Lamphong: polish + direct 3D control (tap junctions, tap train → tap platform) ===================
const BB_TERM = makeBB(new THREE.Group()); tScene.add(BB_TERM.group);
const TNODE = {}, TEDGE = {}, TNODE_PICK = [];
let TERM_LAMPS = null, tEdgeAcc = 0;
const ROUTE_COL = { rt: new THREE.Color(0x2EE08A), sh: new THREE.Color(0xFFB020), occ: new THREE.Color(0xFF4D57), pv: new THREE.Color(0x3A9BFF) };
function tFxBuild() {
  TM.ground.color.set(PAL.terrain); TM.ballast.color.set(0x8C8476); TM.sleeper.color.set(0x5B4636); TM.rail.color.set(0x3A3F47);
  TM.plat.color.set(0xC9D0DA); TM.building.color.set(0xF2E6CE); TM.city.color.set(0xffffff);
  const lamps = [];
  PLATFORMS_Z.forEach(z => { for (let x = 60; x <= 250; x += 38) lamps.push([x, z]); });
  for (let x = 300; x <= 640; x += 55) lamps.push([x, 36.2], [x, 49.6]);
  for (let z = -10; z <= 96; z += 18) lamps.push([-40, z]);
  for (let z = -14; z <= 100; z += 19) lamps.push([-101, z], [-127.5, z]);
  TERM_LAMPS = makeLamps(lamps, 6.5, tScene);
  sun2Target();
  for (const e of Object.values(G.edges)) {
    const m = new THREE.Mesh(unitBox, new THREE.MeshBasicMaterial({ color: 0x2EE08A, transparent: true, opacity: 0.9, depthWrite: false }));
    m.position.set((e.ax + e.bx) / 2, 0.66, (e.az + e.bz) / 2); m.rotation.y = Math.atan2(e.bx - e.ax, e.bz - e.az);
    m.scale.set(1.3, 0.08, e.len + 0.4); m.visible = false; m.renderOrder = 4; tScene.add(m); TEDGE[e.id] = m;
  }
  for (const N of Object.values(G.nodes)) {
    if ((N.kind !== 'switch' && N.kind !== 'slip') || /^R[ab]/.test(N.id)) continue; // throat junctions only; buffer-end crossovers are shunting detail
    const r = N.kind === 'slip' ? 2.3 : 1.6;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x0F2240 }));
    disc.position.set(N.x, 0.74, N.z); ring.position.set(N.x, 0.75, N.z); disc.renderOrder = ring.renderOrder = 5;
    disc.userData.node = N.id; tScene.add(disc, ring); TNODE[N.id] = { disc, ring, r }; TNODE_PICK.push(disc);
  }
}
function sun2Target() { if (TVIS.lights) { TVIS.lights.s.target.position.set(300, 0, 45); } }
function heldConsist() { return tstate.consists.filter(c => c.job === 'approach').sort((a, b) => b.s - a.s)[0] || null; }
function allowedTrack(T) { return trackFree(T) && !arrivalRule(T, nextArrivalSvc()); }
function tAssignStart() { TRT.assign = true; toast('แตะหมายเลขชานชาลาสีเหลืองเพื่อรับขบวนเข้า (เทาคือรับไม่ได้)'); }
function termBillboards(time) {
  const items = [];
  if (!tstate.routes.some(r => r.from === 'HA')) {
    const c = heldConsist();
    if (c) { const p = pAt(c, c.s - 4); items.push({ key: 'held', kind: 'platform', x: p.x, y: 9, z: p.z, pulse: true, tap: tAssignStart }); }
  } else TRT.assign = false;
  for (const s of tstate.services) {
    if (s.phase !== 'dwell' || s.state !== 'ready' || tstate.routes.some(r => r.from === 'ST' + s.track)) continue;
    const c = tCons(s.cid); if (!c) continue;
    const p = pAt(c, c.s - 4);
    items.push({ key: 'r' + s.id, kind: 'ready', x: p.x, y: 9, z: p.z, pulse: tstate.now >= s.schedDep - 30, tap: () => { requestDeparture(s.track, false); } });
  }
  if (TRT.assign) for (let T = 1; T <= 14; T++) {
    const ok = allowedTrack(T);
    items.push({ key: 'pm' + T, kind: (ok ? 'num' : 'off') + T, x: 172, y: 3.2, z: TZ(T), px: ok ? 40 : 30, pulse: ok,
      tap: ok ? () => { if (requestArrival(T, false)) TRT.assign = false; } : () => { const svc = nextArrivalSvc(), why = arrivalRule(T, svc); toast(why ? 'ระเบียบสถานี: ' + why : `ราง ${T} ไม่ว่าง`); } });
  }
  bbSync(BB_TERM, items, time);
  edgeIndicators(items);
}
function tFxUpdate(time, dt) {
  tBeautyTick(time, dt);
  applyDayNight(tstate.now / 3600, tScene, TVIS.lights.h, TVIS.lights.s, { x: 300, y: 0, z: 45 }, 420, TERM_LAMPS);
  termBillboards(time);
  const worldPerPx = (camera.top - camera.bottom) / camera.zoom / Math.max(1, canvas.clientHeight);
  for (const id in TNODE) {
    const n = TNODE[id], ns = tstate.nodes[id], locked = !!tstate.nlock[id];
    n.disc.material.color.set(ns.mv > 0 ? (Math.sin(time * 14) > 0 ? 0xFFC20E : 0xffffff) : ns.pos > 0 ? 0x3A7BD5 : 0xffffff);
    n.ring.material.color.set(locked ? 0x1FA463 : 0x0F2240);
    const k = Math.max(1, ((n.r > 2 ? 11 : 8) * worldPerPx) / n.r); n.disc.scale.set(k, 1, k); n.ring.scale.set(k, 1, k);
  }
  tEdgeAcc += dt; if (tEdgeAcc < 0.12) return; tEdgeAcc = 0;
  for (const id in TEDGE) {
    const m = TEDGE[id], lk = tstate.elock[id], r = lk && tstate.routes.find(x => x.id === lk);
    let col = null;
    if (OCC[id]) col = r ? ROUTE_COL.occ : null;
    else if (r) col = r.kind === 'shunt' ? ROUTE_COL.sh : ROUTE_COL.rt;
    if (OCC[id] && G.edges[id].kind === 'throat') col = ROUTE_COL.occ;
    const pv = !col && TRT.prev && TRT.prev.has(id); if (pv) col = ROUTE_COL.pv;
    m.visible = !!col; if (col) { m.material.color.copy(col); m.material.opacity = pv ? 0.5 + 0.35 * Math.abs(Math.sin(time * 4)) : r && r.state === 'setting' ? 0.45 + 0.4 * Math.abs(Math.sin(time * 6)) : 0.9; }
  }
}
function tFxPick() {
  const tap = bbPick(BB_TERM); if (tap) { tap(); return true; }
  const hit = ray.intersectObjects(TNODE_PICK, false)[0];
  if (hit) { throwSwitch(hit.object.userData.node); return true; }
  return false;
}
