// =====================================================================
// สถานีหัวลำโพง: คอขวด ประแจ อาณัติสัญญาณ NX/รีเลย์ ETCS และการกลับขบวน
// =====================================================================
const TRATE = 6;               // วินาทีในเกมต่อ 1 วินาทีจริงที่ความเร็ว 1×
const VL = 20;                 // ความยาวรถ 1 คัน (ม.)
const THROW_T = 5;             // เวลากลับประแจ (วินาที)
const SPD = { far: 25, main: 22, turn: 8.3, plat: 8.3, stub: 4.2, shunt: 6.9 };   // ม./วินาที
const ACC = 0.45, B_CURVE = 0.5, B_MAX = 0.9;   // เร่ง / โค้งเบรกที่ใช้คำนวณ / เบรกสูงสุดของพนักงานขับ
const TZ = i => Math.floor((i - 1) / 2) * 13.5 + ((i - 1) % 2) * 4.5;
const partnerOf = i => (i % 2 ? i + 1 : i - 1);
const PLATFORMS_Z = [-4.5, 9, 22.5, 36, 49.5, 63, 76.5, 90];
const G = { nodes: {}, edges: {} };
const gN = (id, x, z, kind, label) => { G.nodes[id] = { id, x, z, kind, label: label || id, pairs: [], adj: [] }; };
const gE = (id, u, v, speed, o = {}) => {
  const a = G.nodes[u], b = G.nodes[v], len = Math.hypot(b.x - a.x, b.z - a.z);
  G.edges[id] = { id, u, v, len, speed, rev: !!o.rev, track: o.track || 0, kind: o.kind || 'line', label: o.label || id, ax: a.x, az: a.z, bx: b.x, bz: b.z };
  a.adj.push(id); b.adj.push(id);
};
const gP = (n, ...p) => { G.nodes[n].pairs = p; };
(() => {
  const LX = { 1: 380, 2: 398, 3: 434, 4: 452, 5: 488, 6: 506, 9: 446, 10: 428, 11: 392, 12: 374, 13: 338, 14: 320 };
  for (let i = 1; i <= 14; i++) {
    const z = TZ(i);
    gN('B' + i, -30, z, 'buffer', `กันชนราง ${i}`);
    gN('Ra' + i, 12, z, 'switch', `ประแจ ${i}ก`);
    gN('Rb' + i, 30, z, 'switch', `ประแจ ${i}ข`);
    gN('ST' + i, 280, z, 'signal', `S${i}`);
    if (LX[i]) gN('L' + i, LX[i], z, (i === 1 || i === 14) ? 'plain' : 'switch', `ประแจ ${100 + i}`);
  }
  for (let p = 0; p < 7; p++) gN('X' + p, 21, (TZ(2 * p + 1) + TZ(2 * p + 2)) / 2, 'diamond', `ทางตัด ${2 * p + 1}/${2 * p + 2}`);
  gN('DSN', 542, 40.5, 'slip', 'ประแจสลับคู่ 201');
  gN('DSS', 482, 45, 'slip', 'ประแจสลับคู่ 202');
  gN('SWN', 560, 45, 'switch', 'ประแจ 121');
  gN('SWS', 500, 40.5, 'switch', 'ประแจ 122');
  gN('HA', 640, 40.5, 'signal', 'H'); gN('AE', 1400, 40.5, 'end', 'ปลายทางเข้า');
  gN('DX', 640, 45, 'signal', 'ทางออก'); gN('DE', 1400, 45, 'end', 'ปลายทางออก');
  const peEnd = i => i === 7 ? 'SWS' : i === 8 ? 'DSS' : 'L' + i;
  for (let i = 1; i <= 14; i++) {
    gE('stub' + i, 'B' + i, 'Ra' + i, SPD.stub, { rev: true, track: i, kind: 'stub', label: `ปลายราง ${i}` });
    gE('mid' + i, 'Ra' + i, 'Rb' + i, SPD.turn, { track: i, label: `ประแจหลีก ${i}` });
    gE('pw' + i, 'Rb' + i, 'ST' + i, SPD.plat, { track: i, kind: 'plat', label: `ชานชาลา ${i}` });
    gE('pe' + i, 'ST' + i, peEnd(i), SPD.plat, { track: i, label: `ทางเข้าราง ${i}` });
    gP('ST' + i, ['pw' + i, 'pe' + i]);
  }
  for (let p = 0; p < 7; p++) {
    const o = 2 * p + 1, e = o + 1;
    gE('c1a' + p, 'Rb' + o, 'X' + p, SPD.turn, { label: `ทางหลีก ${o}→${e}` });
    gE('c1b' + p, 'X' + p, 'Ra' + e, SPD.turn, { label: `ทางหลีก ${o}→${e}` });
    gE('c2a' + p, 'Rb' + e, 'X' + p, SPD.turn, { label: `ทางหลีก ${e}→${o}` });
    gE('c2b' + p, 'X' + p, 'Ra' + o, SPD.turn, { label: `ทางหลีก ${e}→${o}` });
    gP('Ra' + o, ['stub' + o, 'mid' + o], ['stub' + o, 'c2b' + p]);
    gP('Rb' + o, ['pw' + o, 'mid' + o], ['pw' + o, 'c1a' + p]);
    gP('Ra' + e, ['stub' + e, 'mid' + e], ['stub' + e, 'c1b' + p]);
    gP('Rb' + e, ['pw' + e, 'mid' + e], ['pw' + e, 'c2a' + p]);
    gP('X' + p, ['c1a' + p, 'c1b' + p], ['c2a' + p, 'c2b' + p]);
  }
  const lad = (id, u, v, rev) => gE(id, u, v, SPD.turn, { rev, kind: 'throat', label: 'คอขวด ' + id });
  lad('lnD', 'SWN', 'DSN'); lad('lnA', 'DSN', 'L6', true); lad('ln65', 'L6', 'L5'); lad('ln54', 'L5', 'L4', true);
  lad('ln43', 'L4', 'L3'); lad('ln32', 'L3', 'L2', true); lad('ln21', 'L2', 'L1');
  lad('lsA', 'SWS', 'DSS'); lad('lsB', 'DSS', 'L9', true); lad('ls910', 'L9', 'L10'); lad('ls1011', 'L10', 'L11', true);
  lad('ls1112', 'L11', 'L12'); lad('ls1213', 'L12', 'L13', true); lad('ls1314', 'L13', 'L14');
  gP('L6', ['lnA', 'ln65'], ['lnA', 'pe6']); gP('L5', ['ln65', 'ln54'], ['ln65', 'pe5']); gP('L4', ['ln54', 'ln43'], ['ln54', 'pe4']);
  gP('L3', ['ln43', 'ln32'], ['ln43', 'pe3']); gP('L2', ['ln32', 'ln21'], ['ln32', 'pe2']); gP('L1', ['ln21', 'pe1']);
  gP('L9', ['lsB', 'ls910'], ['lsB', 'pe9']); gP('L10', ['ls910', 'ls1011'], ['ls910', 'pe10']); gP('L11', ['ls1011', 'ls1112'], ['ls1011', 'pe11']);
  gP('L12', ['ls1112', 'ls1213'], ['ls1112', 'pe12']); gP('L13', ['ls1213', 'ls1314'], ['ls1213', 'pe13']); gP('L14', ['ls1314', 'pe14']);
  gE('aFar', 'AE', 'HA', SPD.far, { kind: 'main', label: 'ทางประธานขาเข้า' });
  gE('aMain', 'HA', 'DSN', SPD.main, { rev: true, kind: 'main', label: 'ทางประธานขาเข้า (ในเขตสถานี)' });
  gE('aMid', 'DSN', 'SWS', SPD.turn, { kind: 'throat', label: 'คอขวด aMid' });
  gE('dMid', 'DSS', 'SWN', SPD.turn, { kind: 'throat', label: 'คอขวด dMid' });
  gE('dMain', 'SWN', 'DX', SPD.main, { rev: true, kind: 'main', label: 'ทางประธานขาออก (ในเขตสถานี)' });
  gE('dFar', 'DX', 'DE', SPD.far, { kind: 'main', label: 'ทางประธานขาออก' });
  gP('HA', ['aFar', 'aMain']); gP('DX', ['dMain', 'dFar']);
  gP('DSN', ['aMain', 'aMid'], ['lnD', 'lnA'], ['aMain', 'lnA'], ['lnD', 'aMid']);
  gP('DSS', ['dMid', 'pe8'], ['lsA', 'lsB'], ['dMid', 'lsB'], ['lsA', 'pe8']);
  gP('SWN', ['dMain', 'dMid'], ['dMain', 'lnD']);
  gP('SWS', ['aMid', 'pe7'], ['aMid', 'lsA']);
})();
const ePt = (e, d) => { const t = clamp(d / e.len, 0, 1); return { x: e.ax + (e.bx - e.ax) * t, z: e.az + (e.bz - e.az) * t, tx: (e.bx - e.ax) / e.len, tz: (e.bz - e.az) / e.len }; };
const SLIP_POS = ['ตรงทางประธาน', 'ตรงทางแยก', 'สลับ: ทางประธาน → ทางแยก', 'สลับ: ทางแยก → ทางประธาน'];
const posName = (N, p) => N.kind === 'slip' ? SLIP_POS[p] : (p ? 'ทางแยก (R)' : 'ปกติ (N)');

function nextSteps(eid, dir) {
  const e = G.edges[eid], nid = dir > 0 ? e.v : e.u, N = G.nodes[nid], out = [];
  N.pairs.forEach((p, pi) => {
    const f = p[0] === eid ? p[1] : p[1] === eid ? p[0] : null;
    if (f) out.push({ e: f, dir: G.edges[f].u === nid ? 1 : -1, node: nid, pi });
  });
  return out;
}
// Dijkstra บนกราฟแบบมีทิศทาง (ห้ามกลับทิศกลางประแจ) อนุญาตกลับทิศ 1 ครั้งบนรางที่กำหนดเมื่อ allowRev
function findPath(start, isGoal, allowRev, blocked) {
  const K = (e, d, r) => e + '|' + d + '|' + r, best = {}, prev = {};
  const open = [{ e: start.e, dir: start.dir, r: 0, c: 0 }]; best[K(start.e, start.dir, 0)] = 0;
  let goal = null;
  while (open.length) {
    let bi = 0; for (let i = 1; i < open.length; i++) if (open[i].c < open[bi].c) bi = i;
    const cur = open.splice(bi, 1)[0], ck = K(cur.e, cur.dir, cur.r);
    if (cur.c > best[ck]) continue;
    if (cur.c > 0 && isGoal(cur)) { goal = cur; break; }
    const moves = nextSteps(cur.e, cur.dir).map(n => ({ e: n.e, dir: n.dir, r: cur.r, c: cur.c + G.edges[n.e].len, node: n.node, pi: n.pi }));
    if (allowRev && !cur.r && cur.c > 0 && G.edges[cur.e].rev) moves.push({ e: cur.e, dir: -cur.dir, r: 1, c: cur.c + 80, rev: true });
    for (const m of moves) {
      if (blocked && !m.rev && blocked(m.e, m.dir)) continue;
      const k = K(m.e, m.dir, m.r);
      if (best[k] === undefined || m.c < best[k]) { best[k] = m.c; prev[k] = { k: ck, m }; open.push(m); }
    }
  }
  if (!goal) return null;
  const out = []; let k = K(goal.e, goal.dir, goal.r);
  while (prev[k]) { out.push(prev[k].m); k = prev[k].k; }
  out.push({ e: start.e, dir: start.dir });
  return out.reverse();
}

// ---------- terminal state ----------
let tstate = null;
const TRT = { cons: {}, sel: null, nxSel: null, busy: {}, arsAcc: 0 };
let OCC = {};
const tCons = id => tstate.consists.find(c => c.id === id);
const tSvc = id => tstate.services.find(s => s.id === id);
const tClock = t => { const m = Math.floor(t / 60); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
function tlog(text, kind = '') { tstate.log.unshift({ t: tClock(tstate.now), text, kind }); tstate.log.length = Math.min(tstate.log.length, 60); TRT.logDirty = true; }
function tNew() {
  const ts = { v: 1, now: 6.5 * 3600, t0: 6.5 * 3600, speed: 1, nextId: 1, ars: { arr: false, dep: false }, res: { staff: 4, crew: 3, truck: 2, water: 2, lav: 1, cater: 1, parcel: 1, lift: 1, repair: 1 },
    nodes: {}, elock: {}, nlock: {}, routes: [], consists: [], services: [], log: [], hinted: false,
    stats: { arr: 0, dep: 0, onTime: 0, delayMin: 0, rev: 0, holdMin: 0 } };
  Object.keys(G.nodes).forEach(id => { ts.nodes[id] = { pos: 0, mv: 0 }; });
  return ts;
}
// Hua Lamphong now handles ordinary and commuter trains (long-distance expresses start at Krung Thep Aphiwat).
const HLP_LH = [[201, 'พิษณุโลก'], [207, 'นครสวรรค์'], [209, 'บ้านตาคลี'], [211, 'ตะพานหิน'], [233, 'สุรินทร์'], [275, 'อรัญประเทศ'], [279, 'อรัญประเทศ'], [283, 'จุกเสม็ด']];
const HLP_PP = [[301, 'ลพบุรี'], [303, 'ลพบุรี'], [313, 'ชุมทางบ้านภาชี'], [317, 'ลพบุรี'], [339, 'ชุมทางแก่งคอย'], [341, 'ชุมทางแก่งคอย'], [367, 'ฉะเชิงเทรา'], [371, 'ปราจีนบุรี'], [379, 'ฉะเชิงเทรา'], [389, 'ฉะเชิงเทรา']];
const pickOne = a => a[Math.floor(Math.random() * a.length)];
const rint = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
function makeService(arrT, kind) {
  kind = kind || (Math.random() < 0.5 ? 'LH' : 'PP');
  const id = 'S' + (tstate.nextId++);
  const base = { id, kind, schedArr: arrT, lateIn: rollDelay(arrT), phase: 'sched', track: 0, prio: 0, hold: 0, state: '', pax: rint(160, 420), paxOut: rint(160, 420) };
  if (kind === 'LH') {
    const [out, from] = pickOne(HLP_LH);
    return Object.assign(base, { name: `ธรรมดา ${out + 1}`, outName: `ธรรมดา ${out}`, from, coaches: rint(6, 9), pax: rint(300, 560), paxOut: rint(280, 560), schedDep: arrT + 45 * 60 });
  }
  const [out, from] = pickOne(HLP_PP);
  return Object.assign(base, { name: `ชานเมือง ${out + 1}`, outName: `ชานเมือง ${out}`, from, cars: rint(2, 4), schedDep: arrT + 28 * 60 });
}
function vehOf(svc) {
  const ty = svcType(svc);
  if (svc.kind === 'LH') return [{ t: ty, f: 1 }].concat(Array.from({ length: svc.coaches }, () => ({ t: 'coach', f: 1 })));
  return [{ t: ty, f: 1 }].concat(Array.from({ length: svc.cars }, () => ({ t: ty + '_car', f: 1 })), [{ t: ty, f: -1 }]);
}
function newConsist(veh, steps, s, sid) {
  const c = { id: 'C' + (tstate.nextId++), sid, veh, len: veh.length * VL, steps, s, v: 0, moving: false, stopS: 0, mode: 'SB', job: null, routeId: null, base: 0 };
  tstate.consists.push(c); return c;
}

// ---------- consist path geometry ----------
function pcum(c) { if (!c._cum) { const a = [0]; for (const st of c.steps) a.push(a[a.length - 1] + G.edges[st.e].len); c._cum = a; } return c._cum; }
function locate(c, s) { const cum = pcum(c); let i = 0; while (i < c.steps.length - 1 && cum[i + 1] <= s) i++; return i; }
function pAt(c, s) {
  const cum = pcum(c), i = locate(c, s), st = c.steps[i], e = G.edges[st.e];
  const local = clamp(s - cum[i], 0, e.len), p = ePt(e, st.dir > 0 ? local : e.len - local);
  return { x: p.x, z: p.z, tx: p.tx * st.dir, tz: p.tz * st.dir };
}
function occIdx(c) { const cum = pcum(c), a = c.s - c.len, b = c.s, out = []; for (let i = 0; i < c.steps.length; i++) if (cum[i + 1] > a + 0.01 && cum[i] < b - 0.01) out.push(i); return out; }
function slicePath(c) { const idx = occIdx(c); if (!idx.length) return; const cum = pcum(c); c.s -= cum[idx[0]]; c.steps = c.steps.slice(idx[0], idx[idx.length - 1] + 1); c._cum = null; }
function reverseConsist(c) {
  slicePath(c);
  const total = pcum(c)[c.steps.length], tail = c.s - c.len;
  c.steps = c.steps.slice().reverse().map(st => ({ e: st.e, dir: -st.dir })); c._cum = null;
  c.s = total - tail;
  c.veh.reverse(); c.veh.forEach(v => { v.f = -v.f; });
  c.veh.forEach((v, i) => { if (v.t === 'loco') v.f = i === 0 ? 1 : -1; });
}
function extendPath(c, steps) { slicePath(c); c.base = c.steps.length; c.steps = c.steps.concat(steps.map(s => ({ e: s.e, dir: s.dir }))); c._cum = null; }
const headStep = c => { const st = c.steps[locate(c, c.s - 0.01)]; return { e: st.e, dir: st.dir }; };
function computeOcc() {
  OCC = {};
  for (const c of tstate.consists) {
    const cum = pcum(c), a = c.s - c.len, b = c.s;
    for (let i = 0; i < c.steps.length; i++) {
      const s0 = cum[i], s1 = cum[i + 1]; if (s1 <= a + 0.01 || s0 >= b - 0.01) continue;
      const st = c.steps[i], e = G.edges[st.e], lo = Math.max(a, s0) - s0, hi = Math.min(b, s1) - s0;
      (OCC[st.e] || (OCC[st.e] = [])).push({ cid: c.id, d0: st.dir > 0 ? lo : e.len - hi, d1: st.dir > 0 ? hi : e.len - lo });
    }
  }
}
function obstacleAhead(c) {
  const cum = pcum(c); let best = null;
  for (let i = locate(c, c.s - 0.01); i < c.steps.length; i++) {
    if (cum[i] - c.s > 1500) break;
    const st = c.steps[i], e = G.edges[st.e];
    for (const o of OCC[st.e] || []) {
      if (o.cid === c.id) continue;
      const p0 = cum[i] + (st.dir > 0 ? o.d0 : e.len - o.d1);
      if (p0 >= c.s - 0.5 && (!best || p0 < best.s)) best = { s: p0, cid: o.cid };
    }
  }
  return best;
}

// ---------- ETCS-style supervision: เส้นโค้งเบรกไปยังจุดสิ้นสุดอาณัติ (EoA) ----------
function drive(c, dt) {
  if (!c.moving) { c.v = 0; c.P = 0; c.tg = null; return; }
  const cum = pcum(c);
  let vlim = Infinity; for (const i of occIdx(c)) vlim = Math.min(vlim, G.edges[c.steps[i].e].speed);
  if (c.mode === 'SH') vlim = Math.min(vlim, SPD.shunt);
  const targets = [{ s: c.stopS, v: 0, k: 'eoa' }];
  for (let i = locate(c, c.s - 0.01) + 1; i < c.steps.length && cum[i] - c.s < 2500; i++) {
    let sp = G.edges[c.steps[i].e].speed; if (c.mode === 'SH') sp = Math.min(sp, SPD.shunt);
    targets.push({ s: cum[i], v: sp, k: 'lim' });
  }
  const ob = obstacleAhead(c);
  if (ob) targets.push({ s: ob.s - (c.couple === ob.cid ? 0 : 12), v: 0, k: 'obs', cid: ob.cid });
  let P = vlim, tg = null, stopT = null;
  for (const t of targets) {
    const p = Math.sqrt(t.v * t.v + 2 * B_CURVE * Math.max(0, t.s - c.s));
    if (p < P) { P = p; tg = t; }
    if (t.v === 0 && (!stopT || t.s < stopT.s)) stopT = t;
  }
  const dStop = stopT.s - c.s;
  let want = Math.min(P * 0.95, P - 0.25);
  if (dStop > 0.15) want = Math.max(want, Math.min(0.7, dStop * 0.4)); else want = 0;   // release speed ช่วงสุดท้าย
  if (c.v < want) c.v = Math.min(want, c.v + ACC * dt); else c.v = Math.max(want, c.v - B_MAX * dt);
  const step = Math.min(c.v * dt, Math.max(0, dStop));
  c.s += step;
  c.P = P; c.vlim = vlim; c.tg = tg ? { v: tg.v, d: Math.max(0, tg.s - c.s), k: tg.k } : null;
  if (dStop - step <= 0.15 && c.v < 0.3) { c.v = 0; tOnStop(c, stopT); }
}
function tOnStop(c, t) {
  const svc = c.sid ? tSvc(c.sid) : null;
  if (c.job === 'approach') { if (svc && svc.phase === 'approach') { svc.phase = 'held'; tlog(`${svc.name} หยุดรอที่สัญญาณเข้า H`, 'bad'); } return; }
  if (t.k === 'obs') { if (c.job === 'leg3' && t.cid === c.couple) finishLeg(c); return; }
  if (c.job === 'arr') {
    releaseRoute(c.routeId); c.routeId = null; c.moving = false; c.job = null; c.mode = 'SB';
    if (svc) {
      svc.phase = 'dwell'; svc.state = 'work'; svc.arrAt = tstate.now; svc.tasks = newTasks(svc);
      if (svc.kind === 'LH') svc.ra = { st: 'detach', t: 60 };
      tstate.stats.arr++;
      const late = (tstate.now - svc.schedArr) / 60;
      tlog(`${svc.name} เข้าชานชาลา ${svc.track}${late > 3 ? ` ช้า ${Math.round(late)} นาที` : ' ตรงเวลา'}`);
    }
  } else if (c.job === 'leg1' || c.job === 'leg2') finishLeg(c);
}

// ---------- interlocking: route locking, sectional release ----------
function routeCheck(steps, ignore) {
  for (const st of steps) {
    const e = G.edges[st.e];
    if (tstate.elock[st.e]) return `${e.label} ถูกจองในเส้นทางอื่น`;
    if (OCC[st.e] && !ignore.has(st.e)) return `วงจรราง ${e.label} แจ้งว่ามีรถ`;
    if (st.node) {
      if (tstate.nlock[st.node]) return `${G.nodes[st.node].label} ถูกล็อกในเส้นทางอื่น`;
      if (tstate.nodes[st.node].mv > 0) return `${G.nodes[st.node].label} กำลังเคลื่อนที่`;
    }
  }
  return null;
}
function makeRoute(kind, from, steps, extra = {}) {
  const r = Object.assign({ id: 'R' + (tstate.nextId++), kind, from, steps: steps.map(s => ({ e: s.e, dir: s.dir, node: s.node, pi: s.pi })), state: 'setting', cid: null, used: false, base: 0 }, extra);
  for (const st of r.steps) {
    tstate.elock[st.e] = r.id;
    if (!st.node) continue;
    tstate.nlock[st.node] = r.id;
    const N = G.nodes[st.node], ns = tstate.nodes[st.node];
    if ((N.kind === 'switch' || N.kind === 'slip') && ns.pos !== st.pi) { ns.pos = st.pi; ns.mv = THROW_T; }
  }
  tstate.routes.push(r);
  return r;
}
function releaseRoute(id) {
  const r = tstate.routes.find(x => x.id === id); if (!r) return;
  for (const st of r.steps) {
    if (tstate.elock[st.e] === id) delete tstate.elock[st.e];
    if (st.node && tstate.nlock[st.node] === id) delete tstate.nlock[st.node];
  }
  tstate.routes = tstate.routes.filter(x => x !== r);
}
function assignRoute(r, c) { extendPath(c, r.steps); r.base = c.base; r.used = true; r.cid = c.id; c.routeId = r.id; c.moving = true; }
function tryAssign(r) {
  if (r.kind === 'arr') {
    const c = tstate.consists.filter(x => x.job === 'approach').sort((a, b) => b.s - a.s)[0]; if (!c) return;
    assignRoute(r, c); c.job = 'arr'; c.mode = 'FS'; c.stopS = pcum(c)[c.steps.length] - 6;
    const svc = tSvc(c.sid); if (svc) { if (svc.plan === r.track) gainXP(2); svc.track = r.track; svc.phase = 'entering'; tlog(`${svc.name} ได้รับอาณัติเข้าราง ${r.track}`); }
  } else if (r.kind === 'dep') {
    const svc = tstate.services.find(s => s.phase === 'dwell' && s.track === r.track && s.state === 'ready' && tstate.now >= s.schedDep - 30);
    if (!svc) return;
    const c = tCons(svc.cid); assignRoute(r, c); c.job = 'dep'; c.mode = 'FS'; c.stopS = pcum(c)[c.steps.length] + 60;
    svc.phase = 'departing';
    const late = Math.max(0, (tstate.now - svc.schedDep) / 60);
    const rev = Math.round(Math.max(1000, Math.round((svc.kind === 'LH' ? 12000 : 7000) - late * 400)) * (svc.special ? 2 : 1));
    if (svc.special) { gainXP(10); addCoins(1); }
    earn(rev, 'term'); tstate.stats.dep++; gainXP(late <= 3 ? 8 : 4); routeContractTick(svc, late); tstate.stats.rev += rev; tstate.stats.delayMin += late; if (late <= 3) tstate.stats.onTime++;
    const p = pAt(c, c.s); popup(new THREE.Vector3(p.x, 9, p.z), '+' + baht(rev), late > 3);
    tlog(`${svc.outName} ออกจากราง ${svc.track} ไป${svc.from} ${late > 3 ? `ช้า ${Math.round(late)} นาที` : 'ตรงเวลา'} · ${baht(rev)}`, late > 3 ? 'bad' : 'good');
  } else if (r.kind === 'shunt') {
    const c = tCons(r.cid); if (!c) { releaseRoute(r.id); return; }
    assignRoute(r, c); c.mode = 'SH';
    const cum = pcum(c), n = c.steps.length;
    c.stopS = c.job === 'leg1' ? cum[n] - 3 : c.job === 'leg2' ? cum[n - 1] + c.len + 5 : cum[n] - 2;
  }
}
function routeTick() {
  for (const r of tstate.routes.slice()) {
    if (r.state === 'setting' && r.steps.every(st => !st.node || tstate.nodes[st.node].mv <= 0)) r.state = 'set';
    if (r.state !== 'set') continue;
    if (!r.used) { tryAssign(r); continue; }
    const c = tCons(r.cid); if (!c) { releaseRoute(r.id); continue; }
    const cum = pcum(c), tail = c.s - c.len;
    r.steps.forEach((st, k) => {
      const idx = r.base + k; if (idx >= c.steps.length) return;
      if (st.node && tail > cum[idx] + 0.5 && tstate.nlock[st.node] === r.id) delete tstate.nlock[st.node];
      if (tail > cum[idx + 1] && tstate.elock[st.e] === r.id) delete tstate.elock[st.e];
    });
    if (r.steps.every(st => tstate.elock[st.e] !== r.id && (!st.node || tstate.nlock[st.node] !== r.id))) tstate.routes = tstate.routes.filter(x => x !== r);
  }
}
function sigAspect(id) {
  const r = tstate.routes.find(x => x.from === id && x.kind !== 'shunt');
  if (!r || r.state !== 'set') return 'red';
  if (r.used) { const c = tCons(r.cid); if (c && c.s > pcum(c)[r.base] + 1) return 'red'; }
  return id === 'HA' ? 'yellow' : 'green';
}

// ---------- requests (NX panel / ARS) ----------
const trackSvc = T => tstate.services.find(s => (s.phase === 'dwell' || s.phase === 'entering') && s.track === T);
const lhPending = s => s && s.kind === 'LH' && (s.phase === 'entering' || !s.ra || s.ra.st !== 'done');
function arrivalRule(T, svc) {
  if (svc && trainClass(svc) > platClass(T)) return `ราง ${T} สั้นเกินไป: รับได้ถึงขนาด ${CLS[platClass(T)]} แต่ขบวนนี้ขนาด ${CLS[trainClass(svc)]}`;
  if (!svc || svc.kind !== 'LH') return null;
  const Q = partnerOf(T), o = trackSvc(Q);
  if (lhPending(o)) return `ราง ${Q} (รางคู่) มีขบวนหัวรถจักรที่ยังสับหลีกไม่เสร็จ ถ้ารับเข้าจะติดตายกันทั้งคู่`;
  if (OCC['stub' + Q]) return `ปลายราง ${Q} มีหัวรถจักรจอดอยู่`;
  return null;
}
function nextArrivalSvc() {
  const c = tstate.consists.filter(x => x.job === 'approach').sort((a, b) => b.s - a.s)[0];
  if (c) return tSvc(c.sid);
  return tstate.services.filter(s => s.phase === 'sched').sort((a, b) => a.schedArr - b.schedArr)[0];
}
function requestArrival(T, quiet) {
  const fail = m => { if (!quiet) toast(m); return false; };
  if (tstate.routes.some(r => r.from === 'HA')) return fail('สัญญาณ H มีเส้นทางตั้งอยู่แล้ว');
  const svc = nextArrivalSvc();
  const rule = arrivalRule(T, svc); if (rule) return fail('ระเบียบสถานี: ' + rule);
  const path = findPath({ e: 'aFar', dir: 1 }, s => s.e === 'pw' + T && s.dir === -1, false);
  if (!path) return fail('ไม่มีทางเดินรถไปราง ' + T);
  const steps = path.slice(1), err = routeCheck(steps, new Set());
  if (err) return fail('ตั้งเส้นทางไม่ได้: ' + err);
  makeRoute('arr', 'HA', steps, { track: T });
  if (!quiet) {
    const o = trackSvc(partnerOf(T));
    toast(lhPending(o) ? `ตั้งเส้นทาง H → ราง ${T} แล้ว ระวัง: ขบวนนี้จะขวางการสับหลีกของราง ${partnerOf(T)}` : `ตั้งเส้นทาง H → ราง ${T} · กำลังกลับประแจ`);
  }
  tlog(`ตั้งเส้นทาง H → ราง ${T}${quiet ? ' (ARS)' : ''}`);
  return true;
}
function requestDeparture(T, quiet) {
  const fail = m => { if (!quiet) toast(m); return false; };
  if (tstate.routes.some(r => r.from === 'ST' + T)) return fail(`สัญญาณ S${T} มีเส้นทางตั้งอยู่แล้ว`);
  const svc = trackSvc(T);
  if (!svc || svc.phase !== 'dwell') return fail(`ราง ${T} ไม่มีขบวนที่จอดอยู่`);
  if (svc.kind === 'LH' && svc.ra.st !== 'done') return fail('หัวรถจักรยังไม่ได้ต่อท้ายขบวน (สับหลีกยังไม่เสร็จ)');
  if (svc.kind === 'PP' && svc.tasks.turn.st !== 'done') return fail('พนักงานขับยังย้ายไปห้องขับอีกด้านไม่เสร็จ');
  const path = findPath({ e: 'pw' + T, dir: 1 }, s => s.e === 'dFar' && s.dir === 1, false);
  if (!path) return fail('ไม่มีทางเดินรถออกจากราง ' + T);
  const steps = path.slice(1), err = routeCheck(steps, new Set());
  if (err) return fail('ตั้งเส้นทางไม่ได้: ' + err);
  makeRoute('dep', 'ST' + T, steps, { track: T });
  if (!quiet) toast(svc.state === 'ready' ? `ตั้งเส้นทาง S${T} → ทางออก` : `ตั้งเส้นทาง S${T} แล้ว ขบวนจะออกเมื่อกลับขบวนเสร็จและถึงเวลา`);
  tlog(`ตั้งเส้นทาง S${T} → ทางออก${quiet ? ' (ARS)' : ''}`);
  return true;
}
function cancelRoute(r) {
  if (r.used) { toast('ยกเลิกไม่ได้: ขบวนรถได้รับอาณัติ (MA) แล้ว เส้นทางถูกล็อกจนกว่าจะผ่าน'); return; }
  releaseRoute(r.id); toast('ยกเลิกเส้นทางแล้ว'); tlog(`ยกเลิกเส้นทางจาก ${r.from === 'HA' ? 'H' : r.from.replace('ST', 'S')}`);
}
function throwSwitch(id) {
  const N = G.nodes[id], ns = tstate.nodes[id];
  if (N.kind !== 'switch' && N.kind !== 'slip') return;
  if (tstate.nlock[id]) return toast(`${N.label} ถูกล็อกในเส้นทาง (route locking)`);
  if (ns.mv > 0) return toast(`${N.label} กำลังเคลื่อนที่`);
  if (N.adj.some(e => OCC[e])) return toast(`${N.label} มีรถอยู่บนตอนราง (track locking)`);
  ns.pos = (ns.pos + 1) % N.pairs.length; ns.mv = THROW_T;
  toast(`${N.label} → ${posName(N, ns.pos)}`);
}
function trackFree(T) { return !OCC['pw' + T] && !OCC['pe' + T] && !tstate.elock['pw' + T] && !tstate.elock['pe' + T] && !trackSvc(T); }
function arsTick() {
  const waiting = tstate.ars.arr && !tstate.routes.some(r => r.from === 'HA') && tstate.consists.some(c => c.job === 'approach');
  if (!waiting) TRT.arsAt = null; else if (TRT.arsAt == null) TRT.arsAt = tstate.now + arsReact();   // ARS reacts with a short delay
  if (waiting && tstate.now >= TRT.arsAt) {
    const svc = nextArrivalSvc(), cand = [];
    for (let T = 1; T <= 14; T++) {
      if (!trackFree(T) || arrivalRule(T, svc)) continue;
      const o = trackSvc(partnerOf(T)); let sc = Math.random() * 0.5;
      if (svc && svc.plan === T) sc -= 100;
      if (svc.kind === 'LH') sc += o ? 3 : 0; else sc += lhPending(o) ? 8 : o ? 0 : 1;
      cand.push({ T, sc });
    }
    cand.sort((a, b) => a.sc - b.sc);
    for (const { T } of cand) if (requestArrival(T, true)) break;
  }
  if (tstate.ars.dep) for (const s of tstate.services) {
    if (s.phase === 'dwell' && s.state === 'ready' && tstate.now >= s.schedDep - 30 + (s.lag == null ? (s.lag = arsLag()) : s.lag) && !tstate.routes.some(r => r.from === 'ST' + s.track)) requestDeparture(s.track, true);
  }
}

// ---------- turnaround: run-around shunting / push-pull / tasks ----------
const RA_P = { detach: 0.08, leg1: 0.25, leg2: 0.5, leg3: 0.75, couple: 0.92, done: 1 };
function newTasks(svc) {
  const lh = svc.kind === 'LH';
  const q = tstate.now, k = {
    alight: { st: 'queue', p: 0, dur: svc.pax / 150 * 60, res: 'staff', q },
    turn: { st: 'run', p: 0, dur: lh ? 1 : 180 },
    clean: { st: 'wait', p: 0, dur: lh ? 600 : 360, res: 'crew', q: 0 },
    fuel: { st: lh ? 'wait' : 'queue', p: 0, dur: lh ? 420 : 300, res: 'truck', q },
    water: { st: 'wait', p: 0, dur: lh ? 300 : 180, res: 'water', q: 0 },
    board: { st: 'wait', p: 0, dur: svc.paxOut / 150 * 60, res: 'staff', q: 0 },
  };
  // long-haul extras: toilets, dining car stores and parcels; random wheelchair lift / defects on any service
  if (lh) k.lav = { st: 'wait', p: 0, dur: 360, res: 'lav', q: 0 };
  if (lh && /ด่วน/.test(svc.name)) k.cater = { st: 'queue', p: 0, dur: 420, res: 'cater', q };
  if (lh && Math.random() < 0.6) k.parcel = { st: 'queue', p: 0, dur: 300, res: 'parcel', q };
  if (Math.random() < 0.25) k.lift = { st: 'wait', p: 0, dur: 180, res: 'lift', q: 0 };
  if (Math.random() < 0.12) k.repair = { st: 'queue', p: 0, dur: 600, res: 'repair', q };
  return k;
}
function finishLeg(L) {
  const svc = tSvc(L.sid);
  releaseRoute(L.routeId); L.routeId = null; L.moving = false; L.v = 0; L.mode = 'SB';
  const job = L.job; L.job = null;
  if (!svc || !svc.ra) return;
  const ra = svc.ra; ra.rid = null; ra.try = 0;
  if (job === 'leg1') { reverseConsist(L); ra.st = 'leg2'; }
  else if (job === 'leg2') { reverseConsist(L); ra.st = 'leg3'; }
  else if (job === 'leg3') { ra.st = 'couple'; ra.t = 60; L.couple = null; }
}
function mergeConsists(R, L) {
  reverseConsist(L); reverseConsist(R);
  const cumR = pcum(R), lastR = R.steps[R.steps.length - 1], firstL = L.steps[0];
  const dup = lastR.e === firstL.e && lastR.dir === firstL.dir;
  const off = dup ? cumR[R.steps.length - 1] : cumR[R.steps.length];
  R.steps = R.steps.concat(dup ? L.steps.slice(1) : L.steps); R._cum = null;
  R.s = off + L.s; R.veh = L.veh.concat(R.veh); R.len = R.veh.length * VL;
  R.veh.forEach((v, i) => { if (v.t === 'loco') v.f = i === 0 ? 1 : -1; });
  tstate.consists = tstate.consists.filter(c => c !== L);
}
function raTick(svc, dt) {
  const ra = svc.ra, T = svc.track, Q = partnerOf(T);
  if (ra.st === 'done') return;
  const rake = tCons(svc.cid); if (!rake) return;
  if (ra.st === 'detach') {
    ra.t -= dt; if (ra.t > 0) return;
    const L = newConsist([rake.veh[0]], rake.steps.slice(), rake.s, svc.id);
    rake.veh = rake.veh.slice(1); rake.len -= VL; rake.s -= VL; rake._cum = null;
    L.job = 'leg1'; ra.lid = L.id; ra.st = 'leg1'; ra.rid = null; ra.try = 0;
    tlog(`${svc.name}: ปลดหัวรถจักร เริ่มสับหลีกผ่านราง ${Q}`);
    return;
  }
  const L = tCons(ra.lid); if (!L) { ra.st = 'done'; return; }
  if (ra.st === 'couple') {
    ra.t -= dt; if (ra.t > 0) return;
    mergeConsists(rake, L); ra.st = 'done';
    tlog(`${svc.name}: ต่อหัวรถจักรด้านท้ายแล้ว พร้อมเป็น ${svc.outName}`, 'good');
    return;
  }
  if (ra.rid) { if (!tstate.routes.some(r => r.id === ra.rid)) ra.rid = null; return; }
  if (L.moving) return;
  ra.try -= dt; if (ra.try > 0) return; ra.try = 4;
  const blocked = goal => (e, d) => (OCC[e] || []).some(o => o.cid !== L.id) && !(goal && e === goal.e && d === goal.dir);
  let steps;
  if (ra.st === 'leg1') {
    const p = findPath(headStep(L), s => s.e === 'stub' + Q && s.dir === -1, false, blocked(null));
    if (!p) { ra.why = `ปลายราง ${Q} ไม่ว่าง`; return; }
    steps = p.slice(1);
  } else if (ra.st === 'leg2') {
    const goal = { e: 'pw' + T, dir: -1 };
    const p = findPath(headStep(L), s => s.e === goal.e && s.dir === goal.dir && s.r === 1, true, blocked(goal));
    if (!p) { ra.why = `รอราง ${Q} ว่างเพื่อวิ่งหลีก`; return; }
    const k = p.findIndex(s => s.rev);
    ra.leg3 = p.slice(k + 1).map(s => ({ e: s.e, dir: s.dir, node: s.node, pi: s.pi }));
    steps = p.slice(1, k);
  } else steps = ra.leg3;
  const ignore = new Set(occIdx(L).map(i => L.steps[i].e)); if (ra.st === 'leg3') ignore.add('pw' + T);
  const err = routeCheck(steps, ignore); if (err) { ra.why = err; return; }
  const r = makeRoute('shunt', 'SH', steps, { track: T }); r.cid = L.id;
  L.job = ra.st; if (ra.st === 'leg3') L.couple = rake.id;
  ra.rid = r.id; ra.why = '';
}
function svcTick(svc, dt) {
  if (svc.phase === 'held') { svc.hold += dt; pay(2.5 * dt, 'penalty'); tstate.stats.holdMin += dt / 60; return; }
  if (svc.phase !== 'dwell') return;
  const k = svc.tasks, lh = svc.kind === 'LH';
  const gr = ctrlOn('ground') ? 1.25 : 1, sr = ctrlOn('shunt') ? 1.3 : 1;
  const run = (t, m = gr) => { t.p = Math.min(1, t.p + dt * m / t.dur); if (t.p >= 1) t.st = 'done'; return t.st === 'done'; };
  const qd = n => { const t = k[n]; if (t && t.st === 'wait') { t.st = 'queue'; t.q = tstate.now; } };
  if (k.alight.st === 'run') run(k.alight);
  if (lh) { raTick(svc, dt); k.turn.p = RA_P[svc.ra.st]; if (svc.ra.st === 'done') k.turn.st = 'done'; }
  else if (k.turn.st === 'run' && run(k.turn, sr)) { const c = tCons(svc.cid); if (c) reverseConsist(c); tlog(`${svc.name}: พนักงานขับย้ายไปห้องขับอีกด้าน (push-pull)`); }
  if (k.alight.st === 'done') { qd('clean'); qd('water'); qd('lav'); }
  if (!lh || svc.ra.st === 'done') qd('fuel');
  if (k.clean.st === 'done') qd('lift');
  for (const n in k) if (n !== 'alight' && n !== 'turn' && n !== 'board' && k[n].st === 'run') run(k[n]);
  if (k.board.st === 'wait' && k.clean.st === 'done' && k.turn.st === 'done' && (!k.lift || k.lift.st === 'done')) { k.board.st = k.board.res ? 'queue' : 'run'; k.board.q = tstate.now; }
  if (k.board.st === 'run') run(k.board);
  if (svc.state !== 'ready' && Object.keys(k).every(n => k[n].st === 'done')) { svc.state = 'ready'; tlog(`${svc.outName} พร้อมออกจากราง ${svc.track} (กำหนด ${tClock(svc.schedDep)})`, 'good'); }
}
function allocRes() {
  const busy = {}, q = [];
  for (const k in GS) { busy[k] = 0; if (tstate.res[k] == null) tstate.res[k] = GS[k].start; }
  for (const s of tstate.services) {
    if (s.phase !== 'dwell') continue;
    for (const n in s.tasks) { const t = s.tasks[n]; if (!t.res) continue; if (t.st === 'run') busy[t.res]++; else if (t.st === 'queue') q.push({ s, t }); }
  }
  q.sort((a, b) => (b.s.prio - a.s.prio) || (a.t.q - b.t.q));
  for (const { t } of q) if (busy[t.res] < tstate.res[t.res]) { busy[t.res]++; t.st = 'run'; }
  TRT.busy = busy;
}
function tSpawnTick() {
  let last = Math.max(tstate.now, ...tstate.services.map(s => s.schedArr));
  const ramp = Math.max(0.55, 1 - (tstate.now - tstate.t0) / (6 * 3600));
  while (tstate.services.filter(s => s.phase === 'sched').length < 6) { last += (5 + Math.random() * 4) * 60 * ramp * (tstate.now - tstate.t0 > 3600 ? rushFactor(last) : 1); tstate.services.push(makeService(last)); }   // no peak in the first game hour
  const due = s => s.schedArr + (s.lateIn || 0) * 60;
  const svc = tstate.services.filter(s => s.phase === 'sched' && tstate.now >= due(s) - 40).sort((a, b) => due(a) - due(b))[0];
  if (!svc || (OCC.aFar || []).some(o => o.d0 < 260)) return;
  const veh = vehOf(svc), len = veh.length * VL;
  const c = newConsist(veh, [{ e: 'aFar', dir: 1 }], len + 2, svc.id);
  c.v = 20; c.moving = true; c.job = 'approach'; c.mode = 'FS'; c.stopS = G.edges.aFar.len - 12;
  svc.phase = 'approach'; svc.cid = c.id;
  tlog(`${svc.name} จาก${svc.from} เข้าเขตสถานี`);
}
function despawn(c) {
  const svc = tSvc(c.sid);
  releaseRoute(c.routeId);
  tstate.consists = tstate.consists.filter(x => x !== c);
  if (svc) tstate.services = tstate.services.filter(s => s !== svc);
  if (TRT.sel && TRT.sel.sid === c.sid) tSelect(null);
  if (camTerm.follow === c.id) camTerm.follow = null;
}
function tStep(dt) {
  tstate.now += dt;
  for (const k in tstate.nodes) { const n = tstate.nodes[k]; if (n.mv > 0) n.mv = Math.max(0, n.mv - dt); }
  computeOcc();
  tSpawnTick();
  routeTick();
  allocRes();
  for (const s of tstate.services.slice()) svcTick(s, dt);
  computeOcc();
  for (const c of tstate.consists.slice()) drive(c, dt);
  for (const c of tstate.consists.slice()) if (c.job === 'dep' && c.s >= pcum(c)[c.steps.length] - 220) despawn(c);
  TRT.arsAcc += dt; if (TRT.arsAcc > 2) { TRT.arsAcc = 0; arsTick(); }
}
function tScenario() {
  tstate = newTStateSeeded();
}
function newTStateSeeded() {
  tstate = tNew();
  const place = (svc, T, ago) => {
    svc.track = T; svc.phase = 'dwell'; svc.state = 'work'; svc.arrAt = tstate.now - ago; svc.tasks = newTasks(svc);
    const c = newConsist(vehOf(svc), [{ e: 'pw' + T, dir: -1 }], 244, svc.id); svc.cid = c.id;
    if (svc.kind === 'LH') svc.ra = { st: 'detach', t: 25 };
    tstate.services.push(svc); return c;
  };
  const done = t => { t.st = 'done'; t.p = 1; };
  const a = makeService(tstate.now - 300, 'LH'); a.coaches = Math.min(a.coaches, 7); place(a, 9, 300); a.tasks.alight.p = 0.7;
  const b = makeService(tstate.now - 1100, 'PP'); const cb = place(b, 4, 1100);
  done(b.tasks.alight); done(b.tasks.turn); reverseConsist(cb);
  b.tasks.clean.st = 'run'; b.tasks.clean.p = 0.5; b.tasks.fuel.st = 'run'; b.tasks.fuel.p = 0.6;
  const d = makeService(tstate.now - 1500, 'PP'); const cd = place(d, 13, 1500);
  ['alight', 'turn', 'clean', 'fuel', 'board'].forEach(n => done(d.tasks[n])); reverseConsist(cd);
  d.state = 'ready'; d.schedDep = tstate.now + 120;
  tstate.services.push(Object.assign(makeService(tstate.now + 30, 'LH'), { lateIn: 0 }));
  tstate.stats.arr = 3;
  return tstate;
}

// ---------- 3D: สถานีหัวลำโพง ----------
const tScene = new THREE.Scene();
const tRoot = new THREE.Group(); tScene.add(tRoot);
const TM = {
  ground: mat(0xeef1f5), ballast: mat(0xb3b9c2), sleeper: mat(0x8a7865), rail: mat(0x59626e, { metalness: 0.5, roughness: 0.4 }),
  plat: mat(0xdde3ea), platEdge: mat(0xf1c232), buffer: mat(0xd33b3b), water: mat(0x9cc4e6, { roughness: 0.3 }),
  glassRoof: new THREE.MeshStandardMaterial({ color: 0xcfe0f2, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, roughness: 0.2 }),
  rib: mat(0x7a8698, { metalness: 0.4 }), cream: mat(0xf1e6cf), maroon: mat(0x8e2b2b), white: mat(0xfbfcfe), blue: mat(0x1f4fd1), red: mat(0xd33b3b),
  loco: mat(0xe2772b), locoCab: mat(0xf0d9b0), stripe: mat(0x1d3a7a), glass: mat(0x203047, { roughness: 0.2 }), roof: mat(0x8f99a6), under: mat(0x2b313a), bogie: mat(0x1f242b),
  lampW: new THREE.MeshBasicMaterial({ color: 0xfff6d8 }), building: mat(0xf2ead8), buildRoof: mat(0x9a6b4f), city: mat(0xffffff), dark: mat(0x2b313a),
  off: mat(0x1d232b), onR: new THREE.MeshBasicMaterial({ color: 0xff3b47 }), onY: new THREE.MeshBasicMaterial({ color: 0xffc23d }), onG: new THREE.MeshBasicMaterial({ color: 0x22d17a }),
  vest: mat(0xf5c400), crowd: mat(0xffffff), tank: mat(0xe8edf2, { metalness: 0.3 }), marker: new THREE.MeshBasicMaterial({ color: 0x2f6bff }),
};
let tBuilt = false;
const TVIS = { tracks: {}, lamps: {}, marker: null };
var tThemeHook = d => {};
tThemeHook(isDark());
function tLabel(text, sub, w = 256) {
  const c = document.createElement('canvas'); c.width = w; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = 'rgba(21,32,48,0.88)'; g.beginPath(); if (g.roundRect) g.roundRect(2, 2, w - 4, 92, 18); else g.rect(2, 2, w - 4, 92); g.fill();
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 40px "Chakra Petch", "IBM Plex Sans Thai", sans-serif'; g.fillText(text, w / 2, sub ? 36 : 48, w - 20);
  if (sub) { g.font = '500 24px "IBM Plex Sans Thai", sans-serif'; g.fillStyle = '#c8d2df'; g.fillText(sub, w / 2, 72, w - 20); }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  sp.renderOrder = 10; return sp;
}
const VEH_GEO = {};
const vehMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 });
function vehGeo(t) {
  if (VEH_GEO[t]) return VEH_GEO[t];
  const parts = [];
  const add = (w, h, d, m, x, y, z) => parts.push({ w, h, d, c: m.color, x, y, z });
  add(2.5, 0.7, 18.6, TM.under, 0, 1.05, 0);
  [-6.4, 6.4].forEach(z => add(2.2, 0.75, 2.8, TM.bogie, 0, 0.92, z));
  if (t === 'loco') {
    add(2.8, 2.9, 13.2, TM.loco, 0, 2.85, -2.4); add(2.8, 3.4, 4.6, TM.locoCab, 0, 3.1, 6.6);
    add(2.6, 1.0, 0.06, TM.glass, 0, 3.9, 8.92); add(2.84, 0.35, 18.4, TM.stripe, 0, 1.75, 0);
    add(2.3, 0.25, 12.6, TM.roof, 0, 4.4, -2.4); add(0.9, 0.25, 0.06, TM.lampW, 0, 2.2, 8.93);
  } else if (t === 'coach') {
    add(2.85, 3.0, 19, TM.cream, 0, 2.9, 0); add(2.88, 0.55, 19.02, TM.maroon, 0, 1.75, 0);
    add(2.88, 0.85, 17, TM.glass, 0, 3.3, 0); add(2.6, 0.4, 19, TM.roof, 0, 4.55, 0);
  } else {
    add(2.85, 3.0, 19, TM.white, 0, 2.9, 0); add(2.88, 0.32, 19.02, TM.blue, 0, 1.95, 0); add(2.88, 0.18, 19.02, TM.red, 0, 1.6, 0);
    add(2.88, 0.8, t === 'cab' ? 15.5 : 17, TM.glass, 0, 3.35, t === 'cab' ? -1.2 : 0); add(2.6, 0.4, 19, TM.roof, 0, 4.55, 0);
    if (t === 'cab') { add(2.5, 1.0, 0.06, TM.glass, 0, 3.5, 9.52); add(2.86, 0.6, 0.08, TM.blue, 0, 2.3, 9.52); add(0.9, 0.22, 0.05, TM.lampW, 0, 2.0, 9.56); }
  }
  const pos = [], nor = [], col = [], idx = [];
  for (const q of parts) {
    const g = new THREE.BoxGeometry(q.w, q.h, q.d); g.translate(q.x, q.y, q.z);
    const base = pos.length / 3, P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) col.push(q.c.r, q.c.g, q.c.b);
    for (const i of g.index.array) idx.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return (VEH_GEO[t] = geo);
}
function tVehMesh(t) { return trainModel(t); }
function tBuildScene() {
  if (tBuilt) return; tBuilt = true;
  const h = new THREE.HemisphereLight(0xffffff, 0xb9c4d4, 0.8); tScene.add(h);
  const s = new THREE.DirectionalLight(0xffffff, 0.7);
  s.position.set(420, 260, 210); s.target.position.set(300, 0, 45); tScene.add(s.target);
  s.castShadow = true; s.shadow.mapSize.set(2048, 2048);
  Object.assign(s.shadow.camera, { left: -460, right: 460, top: 320, bottom: -320, near: 10, far: 1000 }); s.shadow.bias = -0.0008;
  tScene.add(s); TVIS.lights = { h, s }; tThemeHook(isDark());
  const ground = box(2400, 2, 800, TM.ground); ground.position.set(450, -1, 45); ground.castShadow = false; tScene.add(ground);
  const canal = box(26, 0.2, 800, TM.water); canal.position.set(-150, 0.05, 45); canal.castShadow = false; tScene.add(canal);
  // track bed
  const edges = Object.values(G.edges);
  const ball = new THREE.InstancedMesh(unitBox, TM.ballast, edges.length);
  const rails = new THREE.InstancedMesh(unitBox, TM.rail, edges.length * 2);
  let nS = 0; edges.forEach(e => { nS += Math.floor(e.len / 1.1); });
  const sl = new THREE.InstancedMesh(unitBox, TM.sleeper, nS);
  ball.receiveShadow = sl.receiveShadow = rails.receiveShadow = true;
  let k = 0;
  edges.forEach((e, i) => {
    const yaw = Math.atan2(e.bx - e.ax, e.bz - e.az), mx = (e.ax + e.bx) / 2, mz = (e.az + e.bz) / 2, nx = -(e.bz - e.az) / e.len, nz = (e.bx - e.ax) / e.len;
    dummy.rotation.set(0, yaw, 0);
    dummy.position.set(mx, 0.15, mz); dummy.scale.set(3.4, 0.3, e.len + 0.6); dummy.updateMatrix(); ball.setMatrixAt(i, dummy.matrix);
    [-0.52, 0.52].forEach((o, j) => { dummy.position.set(mx + nx * o, 0.47, mz + nz * o); dummy.scale.set(0.09, 0.14, e.len + 0.05); dummy.updateMatrix(); rails.setMatrixAt(i * 2 + j, dummy.matrix); });
    const n = Math.floor(e.len / 1.1);
    for (let j = 0; j < n; j++) { const p = ePt(e, (j + 0.5) * 1.1); dummy.position.set(p.x, 0.34, p.z); dummy.scale.set(1.9, 0.1, 0.25); dummy.updateMatrix(); sl.setMatrixAt(k++, dummy.matrix); }
  });
  tScene.add(ball, sl, rails);
  // platforms
  PLATFORMS_Z.forEach(z => {
    const w = (z < 0 || z > 86) ? 5 : 5.6;
    const p = box(236, 1.0, w, TM.plat); p.position.set(154, 0.5, z); p.castShadow = false; tScene.add(p);
    [-1, 1].forEach(sd => { const ed = box(236, 0.04, 0.35, TM.platEdge); ed.position.set(154, 1.02, z + sd * (w / 2 - 0.3)); ed.castShadow = false; tScene.add(ed); });
  });
  const conc = box(26, 1.0, 112, TM.plat); conc.position.set(-47, 0.5, 42.75); conc.castShadow = false; tScene.add(conc);
  for (let i = 1; i <= 14; i++) {
    const b = box(1.2, 1.5, 2.6, TM.buffer); b.position.set(-29.4, 0.9, TZ(i)); tScene.add(b);
    const lb = tLabel(String(i)); lb.scale.set(5, 1.9, 1); lb.position.set(-22, 5, TZ(i)); tScene.add(lb);
  }
  // arched train shed (โรงคลุมชานชาลาโค้ง)
  const R = 52, cz = 42.75;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 200, 56, 1, true, 0, Math.PI), TM.glassRoof);
  roof.rotation.z = Math.PI / 2; roof.scale.x = 0.45; roof.position.set(150, 2, cz); tScene.add(roof);
  for (let x = 50; x <= 250; x += 25) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(R, 0.22, 5, 56, Math.PI), TM.rib);
    rib.rotation.y = Math.PI / 2; rib.scale.y = 0.45; rib.position.set(x, 2, cz); rib.castShadow = true; tScene.add(rib);
  }
  [-9.3, 94.8].forEach(z => { const wall = box(200, 2.2, 0.6, TM.rib); wall.position.set(150, 1.1, z); tScene.add(wall); });
  // head house
  const hh = box(36, 16, 124, TM.building); hh.position.set(-78, 8, cz); tScene.add(hh);
  const hr = box(37, 1.2, 125, TM.buildRoof); hr.position.set(-78, 16.6, cz); tScene.add(hr);
  const arch = new THREE.Mesh(new THREE.CircleGeometry(15, 40, 0, Math.PI), TM.glass);
  arch.rotation.y = Math.PI / 2; arch.position.set(-59.9, 4, cz); tScene.add(arch);
  const tower = box(10, 8, 10, TM.building); tower.position.set(-78, 20.6, cz); tScene.add(tower);
  const clock = new THREE.Mesh(new THREE.CircleGeometry(3, 32), TM.white); clock.rotation.y = Math.PI / 2; clock.position.set(-72.9, 21, cz); tScene.add(clock);
  const name = tLabel('สถานีกรุงเทพ', 'หัวลำโพง', 360); name.scale.set(40, 10.7, 1); name.position.set(-78, 42, cz); tScene.add(name);
  // city blocks
  const city = new THREE.InstancedMesh(unitBox, TM.city, 170); city.castShadow = city.receiveShadow = true;
  const cc = [0xffffff, 0xdfe8f7, 0xeef1f5, 0xcfdcf2, 0xf6efe4].map(c => new THREE.Color(c));
  let ci = 0;
  for (let n = 0; n < 400 && ci < 170; n++) {
    const x = -260 + rng() * 1150, side = rng() < 0.5, z = side ? -70 - rng() * 220 : 150 + rng() * 220;
    if (x > -175 && x < -128) continue;
    const w = 12 + rng() * 26, d = 12 + rng() * 26, hgt = 6 + rng() * rng() * 55;
    dummy.rotation.set(0, 0, 0); dummy.position.set(x, hgt / 2, z); dummy.scale.set(w, hgt, d); dummy.updateMatrix();
    city.setMatrixAt(ci, dummy.matrix); city.setColorAt(ci, cc[Math.floor(rng() * cc.length)]); ci++;
  }
  city.count = ci; tScene.add(city);
  // signals
  const lamp = (x, y, z) => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), TM.off); m.position.set(x, y, z); tScene.add(m); return m; };
  { const pole = box(0.35, 7, 0.35, TM.dark); pole.position.set(642, 3.5, 36.8); tScene.add(pole);
    const head = box(0.7, 2.8, 1.0, TM.dark); head.position.set(642, 7.8, 36.8); tScene.add(head);
    TVIS.lamps.HA = { r: lamp(641.55, 8.7, 36.8), y: lamp(641.55, 7.8, 36.8), g: lamp(641.55, 6.9, 36.8) };
    const lb = tLabel('H', 'สัญญาณเข้า', 220); lb.scale.set(14, 6, 1); lb.position.set(642, 14, 36.8); tScene.add(lb); }
  for (let i = 1; i <= 14; i++) {
    const z = TZ(i) - 1.95, hd = box(0.5, 1.1, 0.5, TM.dark); hd.position.set(281, 0.85, z); tScene.add(hd);
    TVIS.lamps['ST' + i] = { r: lamp(280.7, 1.15, z), g: lamp(280.7, 0.65, z) };
  }
  // per-track activity props
  const crowdGeo = new THREE.CylinderGeometry(0.28, 0.32, 1.7, 6);
  const pc = [0xffffff, 0x2f6bff, 0xf2a516, 0x14a37f, 0xe2556b, 0x9fbcff].map(c => new THREE.Color(c));
  for (let i = 1; i <= 14; i++) {
    const side = i % 2 ? -1 : 1, z = TZ(i) + side * 2.55;
    const crowd = new THREE.InstancedMesh(crowdGeo, TM.crowd, 40); crowd.count = 0; crowd.castShadow = true;
    for (let j = 0; j < 40; j++) {
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1);
      dummy.position.set(62 + (j * 37 % 160) + rng() * 3, 1.85, z + (rng() - 0.5) * 1.2); dummy.updateMatrix();
      crowd.setMatrixAt(j, dummy.matrix); crowd.setColorAt(j, pc[j % pc.length]);
    }
    tScene.add(crowd);
    const cleaners = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(crowdGeo, TM.vest); m.visible = false; m.castShadow = true; tScene.add(m); return m; });
    const truck = new THREE.Group();
    const tk = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 5.5, 16), TM.tank); tk.rotation.x = Math.PI / 2; tk.position.set(0, 2.2, -0.8); truck.add(tk);
    const cab = box(2.1, 1.8, 1.9, TM.white); cab.position.set(0, 2.0, 2.8); truck.add(cab);
    const ch = box(2.1, 0.5, 7.6, TM.dark); ch.position.set(0, 1.3, 0); truck.add(ch);
    truck.visible = false; truck.scale.setScalar(0.8); tScene.add(truck);
    TVIS.tracks[i] = { crowd, cleaners, truck, z };
  }
  TVIS.marker = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.2, 4), TM.marker); TVIS.marker.rotation.x = Math.PI; TVIS.marker.visible = false; tScene.add(TVIS.marker);
  tFxBuild(); tBeautify();
}
function tReleaseCons(r) { r.vs.forEach(m => { r.group.remove(m); meshPool.put('tv_' + m.userData.vt, m); }); tRoot.remove(r.group); }
function tSyncMeshes() {
  const alive = new Set();
  for (const c of tstate.consists) {
    alive.add(c.id);
    const sig = c.veh.map(v => v.t).join(',');
    let r = TRT.cons[c.id];
    if (!r || r.sig !== sig) {
      if (r) tReleaseCons(r);
      const grp = new THREE.Group(), vs = c.veh.map(v => { const m = meshPool.get('tv_' + v.t, () => { const x = tVehMesh(v.t); x.userData.vt = v.t; return x; }); grp.add(m); return m; });
      grp.traverse(o => { if (o.isMesh) o.userData.cid = c.id; });
      tRoot.add(grp); r = TRT.cons[c.id] = { group: grp, vs, sig };
    }
    c.veh.forEach((v, i) => {
      const m = r.vs[i], f = pAt(c, c.s - i * VL - 3), b = pAt(c, c.s - i * VL - VL + 3);
      m.position.set((f.x + b.x) / 2, 0, (f.z + b.z) / 2);
      m.rotation.y = Math.atan2(f.x - b.x, f.z - b.z) + (v.f < 0 ? Math.PI : 0);
    });
  }
  for (const id in TRT.cons) if (!alive.has(id)) { tReleaseCons(TRT.cons[id]); delete TRT.cons[id]; }
}
function selConsist() {
  if (!TRT.sel) return null;
  const svc = tSvc(TRT.sel.sid); if (!svc) return null;
  if (svc.ra && svc.ra.lid && svc.ra.st !== 'done' && svc.ra.st !== 'detach') return tCons(svc.ra.lid) || tCons(svc.cid);
  return tCons(svc.cid);
}
let tClockT = 0;
function tVisuals(dt) {
  tClockT += dt;
  cam.az += (cam.azT - cam.az) * Math.min(1, dt * 6);
  if (cam.follow) {
    const c = tCons(cam.follow);
    if (c) { const p = pAt(c, c.s - Math.min(c.len, 60) / 2); cam.tx += (p.x - cam.tx) * Math.min(1, dt * 3); cam.tz += (p.z - cam.tz) * Math.min(1, dt * 3); } else cam.follow = null;
  }
  placeCam();
  tSyncMeshes();
  for (const id in TVIS.lamps) {
    const a = sigAspect(id), L = TVIS.lamps[id];
    L.r.material = a === 'red' ? TM.onR : TM.off; L.g.material = a === 'green' ? TM.onG : TM.off;
    if (L.y) L.y.material = a === 'yellow' ? TM.onY : TM.off;
  }
  for (let i = 1; i <= 14; i++) {
    const tv = TVIS.tracks[i], svc = tstate.services.find(s => s.phase === 'dwell' && s.track === i);
    let crowd = 0, clean = false, fuel = false;
    if (svc) {
      const k = svc.tasks;
      if (k.alight.st === 'run') crowd = Math.round(38 * (1 - k.alight.p));
      else if (k.board.st === 'run') crowd = Math.round(38 * (1 - k.board.p));
      else if (k.board.st === 'wait' && k.clean.st !== 'wait') crowd = 14 + Math.round(18 * k.clean.p);
      clean = k.clean.st === 'run'; fuel = k.fuel.st === 'run';
    }
    tv.crowd.count = crowd;
    const c = svc && tCons(svc.cid);
    tv.cleaners.forEach((m, j) => {
      m.visible = clean && !!c;
      if (m.visible) { const p = pAt(c, c.s - 6 - ((tClockT * 5 + j * 37) % Math.max(20, c.len - 12))); m.position.set(p.x, 1.85, tv.z); }
    });
    tv.truck.visible = fuel && !!c;
    if (tv.truck.visible) { const p = pAt(c, c.s - 8); tv.truck.position.set(p.x, 0.2, tv.z + (i % 2 ? -0.4 : 0.4)); tv.truck.rotation.y = Math.PI / 2; }
  }
  const sc = selConsist(), mk = TVIS.marker;
  if (sc) { const p = pAt(sc, sc.s - 4); mk.visible = true; mk.position.set(p.x, 8.5 + Math.sin(tClockT * 4) * 0.6, p.z); mk.rotation.y = tClockT; } else mk.visible = false;
  updatePops(dt);
  dmiUpdate(sc);
}
function tPick(e) {
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  if (tFxPick()) return;
  const hit = ray.intersectObject(tRoot, true).find(h => h.object.userData.cid);
  const c = hit && tCons(hit.object.userData.cid);
  tSelect(c && c.sid ? { sid: c.sid } : null);
}
function tSelect(s) {
  TRT.sel = s; SV.sel = s ? s.sid : null; SV.cardSig = '';
  $('#dmi').hidden = !s || MODE !== 'term';
  document.querySelectorAll('#tSvcList .card').forEach(el => el.classList.toggle('sel', !!s && el.dataset.sid === s.sid));
  if (s && $('#panel').classList.contains('open') && drawerTab === 'tsvc') { const el = document.querySelector(`#tSvcList .card[data-sid="${s.sid}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
  liveRender(true);
}

// ---------- ETCS DMI ----------
const DM = { cx: 90, cy: 90, r: 72 };
const dAng = v => (-144 + clamp(v, 0, 160) / 160 * 288) * Math.PI / 180;
const dPt = (r, v) => [DM.cx + r * Math.sin(dAng(v)), DM.cy - r * Math.cos(dAng(v))];
function dArc(r, v0, v1) {
  if (v1 - v0 < 0.5) return '';
  const [x0, y0] = dPt(r, v0), [x1, y1] = dPt(r, v1), large = (v1 - v0) / 160 * 288 > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
function dmiBuild() {
  let t = '';
  for (let v = 0; v <= 160; v += 10) {
    const [x0, y0] = dPt(64, v), [x1, y1] = dPt(v % 40 ? 59 : 55, v);
    t += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="#8b98a8" stroke-width="${v % 40 ? 1 : 1.8}"/>`;
    if (v % 40 === 0) { const [tx, ty] = dPt(45, v); t += `<text x="${tx.toFixed(1)}" y="${(ty + 3.5).toFixed(1)}" text-anchor="middle" font-size="10" fill="#b9c4d2">${v}</text>`; }
  }
  $('#dmi').innerHTML = `<div class="dmi-head"><b id="dmiName">—</b><span id="dmiMode">SB</span></div>
    <svg viewBox="0 0 180 170" aria-label="DMI แสดงความเร็ว">
      <path d="${dArc(72, 0, 160)}" stroke="#23344a" stroke-width="7" fill="none"/>
      <path id="dmiCsg" stroke="#7f8b9b" stroke-width="7" fill="none"/>
      <path id="dmiTsm" stroke="#e8c547" stroke-width="7" fill="none"/>
      <path id="dmiOver" stroke="#f08a24" stroke-width="7" fill="none"/>
      ${t}
      <line id="dmiNeedle" x1="90" y1="90" x2="90" y2="30" stroke="#f3f6fa" stroke-width="3.5" stroke-linecap="round"/>
      <circle cx="90" cy="90" r="17" fill="#0f1b29" stroke="#f3f6fa" stroke-width="2"/>
      <text id="dmiV" x="90" y="95" text-anchor="middle" font-size="15" font-weight="600" fill="#f3f6fa" font-family="IBM Plex Mono, monospace">0</text>
      <text x="90" y="140" text-anchor="middle" font-size="9" fill="#8b98a8">กม./ชม.</text>
    </svg>
    <div class="dmi-tgt"><div class="dmi-bar"><i id="dmiBar"></i></div><span id="dmiTgt">ไม่มีเป้าหมาย</span></div>
    <div class="dmi-msg" id="dmiMsg"></div>`;
}
function dmiUpdate(c) {
  const el = $('#dmi'); if (el.hidden || !el.firstChild) return;
  const svc = TRT.sel && tSvc(TRT.sel.sid);
  if (!c || !svc) { $('#dmiName').textContent = '—'; return; }
  const v = c.v * 3.6, P = c.moving ? (c.P || 0) * 3.6 : 0, vl = (c.vlim && isFinite(c.vlim) ? c.vlim : 0) * 3.6;
  const tsm = c.moving && c.tg && P < vl - 1;
  $('#dmiName').textContent = svc.name + (c.veh.length === 1 && c.veh[0].t === 'loco' ? ' · หัวรถจักร' : '');
  $('#dmiMode').textContent = c.moving ? c.mode : 'SB';
  $('#dmiCsg').setAttribute('d', dArc(72, 0, Math.min(P, 160)));
  $('#dmiTsm').setAttribute('d', tsm ? dArc(72, c.tg.v * 3.6, Math.min(P, 160)) : '');
  $('#dmiOver').setAttribute('d', v > P + 2 ? dArc(72, P, v) : '');
  const [nx, ny] = dPt(60, v);
  const nd = $('#dmiNeedle'); nd.setAttribute('x2', nx.toFixed(1)); nd.setAttribute('y2', ny.toFixed(1));
  nd.setAttribute('stroke', v > P + 5 ? '#e5484d' : v > P + 2 ? '#f08a24' : tsm && v > c.tg.v * 3.6 + 1 ? '#e8c547' : '#f3f6fa');
  $('#dmiV').textContent = Math.round(v);
  if (c.moving && c.tg) {
    $('#dmiTgt').textContent = `เป้าหมาย ${Math.round(c.tg.v * 3.6)} กม./ชม. อีก ${fmt(c.tg.d)} ม.`;
    $('#dmiBar').style.width = Math.min(100, Math.log10(1 + c.tg.d) / 3 * 100) + '%';
  } else { $('#dmiTgt').textContent = c.moving ? `ความเร็วจำกัด ${Math.round(vl)} กม./ชม.` : 'จอดนิ่ง'; $('#dmiBar').style.width = '0%'; }
  const T = svc.track, Q = partnerOf(T || 1);
  const msg = { approach: 'MA สิ้นสุดที่สัญญาณ H · รอตั้งเส้นทาง', arr: `MA ถึงชานชาลา ${T} · โค้งเบรกเข้าชานชาลา`, dep: 'MA ถึงทางประธานขาออก',
    leg1: `SH: หัวรถจักรไปปลายราง ${Q}`, leg2: `SH: วิ่งราง ${Q} ออกไปกลับรถที่คอขวด`, leg3: `SH: กลับเข้าราง ${T} ต่อท้ายขบวน` }[c.job];
  $('#dmiMsg').textContent = msg || (svc.phase === 'dwell' ? `จอดชานชาลา ${T} · กลับขบวน` : '');
}

// ---------- NX control panel ----------
const NXX = x => 40 + (Math.min(x, 700) + 35) * 1.27, NXZ = z => 30 + z * 2.6;
function nxBuild() {
  let s = `<svg viewBox="0 0 1000 285" role="img" aria-label="แผงควบคุม NX สถานีหัวลำโพง">`;
  PLATFORMS_Z.forEach(z => { s += `<rect class="nxplat" x="${NXX(36).toFixed(1)}" y="${(NXZ(z) - 3.2).toFixed(1)}" width="${(NXX(272) - NXX(36)).toFixed(1)}" height="6.4" rx="2"/>`; });
  s += `<text class="nxlbl" x="${NXX(150)}" y="18">ชานชาลา</text><text class="nxlbl" x="${NXX(460)}" y="18">คอขวด (throat)</text><text class="nxlbl" x="${NXX(15)}" y="18">ทางหลีก</text>`;
  for (const e of Object.values(G.edges)) s += `<line class="nxe" data-e="${e.id}" x1="${NXX(e.ax).toFixed(1)}" y1="${NXZ(e.az).toFixed(1)}" x2="${NXX(e.bx).toFixed(1)}" y2="${NXZ(e.bz).toFixed(1)}"/>`;
  for (let i = 1; i <= 14; i++) {
    const y = NXZ(TZ(i));
    s += `<text class="nxtag" id="nxt${i}" x="${NXX(48).toFixed(1)}" y="${(y - 2.6).toFixed(1)}"></text>`;
    s += `<g class="nxb" data-nx="P${i}"><title>ทางออก: ชานชาลา ${i}</title><rect x="4" y="${(y - 5.5).toFixed(1)}" width="26" height="11" rx="3"/><text x="17" y="${(y + 3.3).toFixed(1)}">${i}</text></g>`;
    const x = NXX(280), y0 = y - 6.5;
    s += `<g class="nxb sig" data-nx="ST${i}"><title>ทางเข้า: สัญญาณออก S${i}</title><polygon id="nxs${i}" points="${x - 4},${y0 - 4} ${x + 5},${y0} ${x - 4},${y0 + 4}"/></g>`;
  }
  const hx = NXX(640), hy = NXZ(40.5) - 8;
  s += `<g class="nxb sig" data-nx="HA"><title>ทางเข้า: สัญญาณเข้า H</title><polygon id="nxsHA" points="${hx + 6},${hy - 6} ${hx - 6},${hy} ${hx + 6},${hy + 6}"/><text x="${hx + 15}" y="${hy + 4}">H</text></g>`;
  s += `<text class="nxlbl" x="${NXX(690)}" y="${NXZ(40.5) - 5}">← เข้า</text>`;
  s += `<g class="nxb" data-nx="EX"><title>ทางออก: ทางประธานขาออก</title><rect x="962" y="${NXZ(45) + 2}" width="34" height="13" rx="3"/><text x="979" y="${NXZ(45) + 11.5}">ออก</text></g>`;
  for (const N of Object.values(G.nodes)) {
    if (N.kind !== 'switch' && N.kind !== 'slip') continue;
    s += `<circle class="nxn${N.kind === 'slip' ? ' slip' : ''}" data-nx="N:${N.id}" cx="${NXX(N.x).toFixed(1)}" cy="${NXZ(N.z).toFixed(1)}" r="${N.kind === 'slip' ? 4.6 : 2.8}"><title>${N.label}</title></circle>`;
  }
  $('#nxBody').innerHTML = s + '</svg>';
  TRT.nxE = [...document.querySelectorAll('#nxBody .nxe')].map(el => [el.dataset.e, el]);
  TRT.nxN = [...document.querySelectorAll('#nxBody .nxn')].map(el => [el.dataset.nx.slice(2), el]);
}
function nxClick(id) {
  if (id.startsWith('N:')) { throwSwitch(id.slice(2)); return; }
  if (id === 'HA' || id.startsWith('ST')) {
    const ex = tstate.routes.find(r => r.from === id);
    if (ex) { cancelRoute(ex); TRT.nxSel = null; return; }
    TRT.nxSel = TRT.nxSel === id ? null : id; return;
  }
  if (!TRT.nxSel) { toast('กดปุ่มทางเข้าก่อน: H (ขาเข้า) หรือสามเหลี่ยม S1–S14 (ขาออก)'); return; }
  if (TRT.nxSel === 'HA' && id.startsWith('P')) requestArrival(+id.slice(1), false);
  else if (TRT.nxSel.startsWith('ST') && id === 'EX') requestDeparture(+TRT.nxSel.slice(2), false);
  else toast(TRT.nxSel === 'HA' ? 'ทางออกของสัญญาณ H คือปุ่มเลขชานชาลาด้านซ้าย' : 'ทางออกของสัญญาณ S คือปุ่ม "ออก" ด้านขวา');
  TRT.nxSel = null;
}
function nxUpdate() {
  if (!TRT.nxE) return;
  for (const [id, el] of TRT.nxE) {
    const lk = tstate.elock[id], r = lk && tstate.routes.find(x => x.id === lk);
    let cls = 'nxe';
    if (OCC[id]) cls += ' occ'; else if (r) cls += r.kind === 'shunt' ? ' sh' : ' rt';
    if (r && r.state === 'setting') cls += ' setting';
    if (el.__c !== cls) { el.setAttribute('class', cls); el.__c = cls; }
  }
  for (const [id, el] of TRT.nxN) {
    const ns = tstate.nodes[id];
    const cls = 'nxn' + (G.nodes[id].kind === 'slip' ? ' slip' : '') + (ns.pos > 0 ? ' rev' : '') + (ns.mv > 0 ? ' mv' : '') + (tstate.nlock[id] ? ' lk' : '');
    if (el.__c !== cls) { el.setAttribute('class', cls); el.__c = cls; }
  }
  const sigs = ['HA'].concat(Array.from({ length: 14 }, (_, i) => 'ST' + (i + 1)));
  for (const id of sigs) {
    const el = document.getElementById(id === 'HA' ? 'nxsHA' : 'nxs' + id.slice(2)); if (!el) continue;
    el.setAttribute('class', 'sig-' + sigAspect(id));
    el.parentNode.classList.toggle('on', TRT.nxSel === id);
  }
  for (let i = 1; i <= 14; i++) {
    const svc = trackSvc(i), el = document.getElementById('nxt' + i);
    const txt = svc ? `${svc.name}${svc.state === 'ready' ? ' · พร้อม' : svc.phase === 'entering' ? ' · กำลังเข้า' : ''}` : '';
    if (el.textContent !== txt) el.textContent = txt;
  }
  $('#nxHint').textContent = TRT.nxSel ? (TRT.nxSel === 'HA' ? 'เลือกชานชาลาปลายทาง (ปุ่มเลขด้านซ้าย)' : `เลือกทางออกของ S${TRT.nxSel.slice(2)} (ปุ่ม "ออก" ด้านขวา)`) : 'กดทางเข้า (H หรือ S) แล้วกดทางออก · กดทางเข้าซ้ำเพื่อยกเลิก · กดวงกลมเพื่อกลับประแจ';
  $('#arsArr').setAttribute('aria-pressed', String(tstate.ars.arr));
  $('#arsDep').setAttribute('aria-pressed', String(tstate.ars.dep));
}

// ---------- terminal side panel ----------
function tSwitchTab(n) { openDrawer(n); }
function tSwitchTabRaw(n) {
  document.querySelectorAll('#termPanel [data-ttab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.ttab === n)));
  document.querySelectorAll('#termPanel [data-tbody]').forEach(b => { b.hidden = b.dataset.tbody !== n; });
}
const TASKS = ['alight', 'turn', 'clean', 'fuel', 'water', 'lav', 'cater', 'parcel', 'repair', 'lift', 'board'];
const svcTasks = s => TASKS.filter(n => s.tasks && s.tasks[n]);
const taskName = (n, svc) => ({ alight: 'ส่งลง', turn: svc.kind === 'LH' ? 'สับหลีก' : 'สลับห้องขับ', clean: 'ทำความสะอาด', fuel: 'เติมน้ำมัน', water: 'เติมน้ำ', lav: 'ดูดสิ่งปฏิกูล', cater: 'ขึ้นเสบียง', parcel: 'ขนพัสดุ', repair: 'ซ่อมด่วน', lift: 'ลิฟต์วีลแชร์', board: 'รับขึ้น' }[n]);
const taskState = t => ({ wait: 'รอ', queue: 'รอทีม', run: 'กำลังทำ', done: 'เสร็จ' }[t.st]);
let tSvcSig = '';
function tRenderSvcList() {
  const list = tstate.services.filter(s => ['entering', 'dwell', 'departing'].includes(s.phase)).sort((a, b) => a.track - b.track);
  const sig = list.map(s => s.id + s.kind + svcTasks(s).length).join(',');
  if (sig !== tSvcSig) {
    tSvcSig = sig;
    $('#tSvcList').innerHTML = list.map(s => `<article class="card" data-sid="${s.id}">
      <header><span class="chip" style="--c:${s.kind === 'LH' ? '#e2772b' : '#1f4fd1'}">ราง ${s.track}</span><b>${s.name}</b><span class="pill" data-f="st"></span></header>
      <div class="meta"><span>${s.kind === 'LH' ? 'ลากจูงด้วยหัวรถจักร' : 'ดีเซลราง push-pull'}</span><span>จาก${s.from}</span><span>กลับเป็น ${s.outName} ออก ${tClock(s.schedDep)}</span></div>
      <div class="tasks">${svcTasks(s).map(n => `<div class="task" data-t="${n}"><span>${taskName(n, s)}</span><div class="bar"><i></i></div><small></small></div>`).join('')}</div>
      ${s.kind === 'LH' ? '<ol class="ra" data-f="ra"><li>ปลดหัวรถจักร</li><li>ไปปลายรางคู่</li><li>กลับรถที่คอขวด</li><li>ต่อท้ายขบวน</li></ol><div class="info" data-f="why"></div>' : ''}
      <div class="acts"><button data-a="view">ดูบนแผนที่</button><button data-a="prio" data-f="prio"></button><button data-a="dep" data-f="dep">ปล่อยรถ</button></div>
    </article>`).join('') || '<div class="info">ยังไม่มีขบวนในสถานี</div>';
    if (TRT.sel) tSelect(TRT.sel);
  }
  for (const card of document.querySelectorAll('#tSvcList .card')) {
    const s = tSvc(card.dataset.sid); if (!s) continue;
    const late = Math.round((tstate.now - s.schedDep) / 60);
    let st = ['กลับขบวน', ''];
    if (s.phase === 'entering') st = ['กำลังเข้าชานชาลา', 'mute'];
    else if (s.phase === 'departing') st = ['กำลังออก', 'good'];
    else if (s.state === 'ready') st = tstate.now < s.schedDep - 30 ? [`พร้อม · รอเวลา ${tClock(s.schedDep)}`, 'good'] : [late > 0 ? `พร้อม · ช้า ${late} นาที` : 'พร้อมออก', late > 3 ? 'bad' : 'good'];
    else if (late > 0) st = [`ล่าช้า ${late} นาที`, 'bad'];
    setF(card, 'st', el => { el.textContent = st[0]; el.className = 'pill ' + st[1]; });
    if (s.tasks) svcTasks(s).forEach(n => {
      const t = s.tasks[n], el = card.querySelector(`[data-t="${n}"]`); if (!el) return;
      el.className = 'task ' + t.st; el.querySelector('i').style.width = (t.p * 100) + '%'; el.querySelector('small').textContent = taskState(t);
    });
    if (s.ra) {
      const idx = { detach: 0, leg1: 1, leg2: 2, leg3: 3, couple: 3, done: 4 }[s.ra.st];
      card.querySelectorAll('.ra li').forEach((li, i) => { li.className = i < idx ? 'done' : i === idx ? 'now' : ''; });
      setF(card, 'why', el => { el.textContent = s.ra.st === 'done' ? '' : s.ra.why ? 'รอ: ' + s.ra.why : ''; });
    }
    setF(card, 'prio', el => { el.textContent = s.prio ? 'ยกเลิกเร่งด่วน' : 'เร่งด่วน'; el.disabled = s.phase !== 'dwell'; });
    setF(card, 'dep', el => { el.disabled = s.phase !== 'dwell' || tstate.routes.some(r => r.from === 'ST' + s.track); el.classList.toggle('action', s.state === 'ready' && !el.disabled); });
  }
}
function tRenderArrivals() {
  const list = tstate.services.filter(s => ['sched', 'approach', 'held'].includes(s.phase)).sort((a, b) => a.schedArr - b.schedArr).slice(0, 5);
  $('#tArrivals').innerHTML = list.map(s => {
    const st = s.phase === 'held' ? [`รอสัญญาณ H ${Math.floor(s.hold / 60)}:${String(Math.floor(s.hold % 60)).padStart(2, '0')}`, 'bad'] : s.phase === 'approach' ? ['กำลังเข้าเขต', 'warn'] : ['ตามกำหนด', 'mute'];
    return `<li data-sid="${s.id}"><time>${tClock(s.schedArr)}</time><span><b>${s.name}</b> จาก${s.from} · ${s.kind === 'LH' ? `หัวรถจักร + ${s.coaches} ตู้` : `push-pull ${s.cars + 2} ตู้`}</span><span class="pill ${st[1]}">${st[0]}</span></li>`;
  }).join('');
}
function tRenderRelay() {
  $('#tRoutes').innerHTML = tstate.routes.map(r => {
    const name = r.kind === 'arr' ? `H → ราง ${r.track}` : r.kind === 'dep' ? `S${r.track} → ทางออก` : `สับเปลี่ยน ราง ${r.track}`;
    const st = r.state === 'setting' ? 'กำลังกลับประแจ' : r.used ? 'ล็อก · ขบวนใช้อยู่' : 'ตั้งแล้ว รอขบวน';
    return `<li><span class="chip" style="--c:${r.kind === 'shunt' ? 'var(--amber)' : 'var(--good)'}">${r.kind === 'shunt' ? 'SH' : 'NX'}</span><span>${name}</span><span class="pill ${r.used ? 'mute' : ''}">${st}</span>${r.kind !== 'shunt' && !r.used ? `<button data-cancel="${r.id}">ยกเลิก</button>` : ''}</li>`;
  }).join('') || '<li><span class="info">ไม่มีเส้นทางตั้งอยู่</span></li>';
  const tc = ['aFar', 'aMain', 'dMain', 'dFar', 'aMid', 'dMid', 'lnD', 'lnA', 'ln54', 'ln32', 'lsA', 'lsB', 'ls1011', 'ls1213'].concat(Array.from({ length: 14 }, (_, i) => 'pw' + (i + 1)), Array.from({ length: 14 }, (_, i) => 'stub' + (i + 1)));
  $('#rackTC').innerHTML = tc.map(id => { const occ = !!OCC[id], lk = !!tstate.elock[id]; return `<span class="lamp ${occ ? 'dn' : lk ? 'lk' : 'up'}"><i></i>${id.replace('stub', 'ปล.').replace('pw', 'ชช.')}</span>`; }).join('');
  const sw = ['SWN', 'DSN', 'SWS', 'DSS', 'L2', 'L3', 'L4', 'L5', 'L6', 'L9', 'L10', 'L11', 'L12', 'L13'];
  $('#rackSW').innerHTML = sw.map(id => { const ns = tstate.nodes[id], N = G.nodes[id]; return `<span class="lamp ${ns.mv > 0 ? 'mv' : ns.pos ? 'rv' : 'up'}${tstate.nlock[id] ? ' locked' : ''}"><i></i>${N.label.replace('ประแจสลับคู่', 'สค.').replace('ประแจ', 'ป.')} ${ns.mv > 0 ? '↔' : ns.pos ? 'R' + (N.kind === 'slip' ? ns.pos : '') : 'N'}</span>`; }).join('');
}
function tRenderCrew() {
  const s = tstate.stats;
  $('#tStats').innerHTML = [
    ['ตรงเวลา', s.dep ? Math.round(s.onTime / s.dep * 100) + '%' : '—'], ['ขบวนออกแล้ว', fmt(s.dep)],
    ['ล่าช้าเฉลี่ย', s.dep ? (s.delayMin / s.dep).toFixed(1) + ' นาที' : '—'], ['รายได้สถานี', baht(s.rev)],
    ['เวลารอสัญญาณรวม', Math.round(s.holdMin) + ' นาที'], ['ขบวนเข้าแล้ว', fmt(s.arr)],
  ].map(([k, v]) => `<div><span>${k}</span><b class="num">${v}</b></div>`).join('');
  $('#tCrew').textContent = `${TRT.busy.crew || 0}/${tstate.res.crew} ทีมกำลังทำงาน`;
  $('#tTruck').textContent = `${TRT.busy.truck || 0}/${tstate.res.truck} คันกำลังเติม`;
  $('#buyCrew').disabled = state.money < 20000; $('#buyTruck').disabled = state.money < 35000;
  if (TRT.logDirty) { TRT.logDirty = false; $('#tLog').innerHTML = tstate.log.slice(0, 14).map(e => `<li class="${e.kind}"><time>${e.t}</time><span>${e.text}</span></li>`).join(''); }
}
function tUpdateUI() {
  const s = tstate.stats;
  $('#tkMoney').textContent = baht(state.money); $('#tkMoney').classList.toggle('neg', state.money < 0);
  $('#tkClock').textContent = tClock(tstate.now);
  $('#tkOnTime').textContent = s.dep ? Math.round(s.onTime / s.dep * 100) + '%' : '—';
  $('#tkIn').textContent = tstate.services.filter(x => x.phase === 'dwell' || x.phase === 'entering').length + '/14';
  const held = tstate.services.filter(x => x.phase === 'held').length;
  $('#tkHeld').textContent = held; $('#tkHeld').classList.toggle('neg', held > 0);
  $('#tkRev').textContent = baht(s.rev);
  $('#tcSvc').textContent = tstate.services.filter(x => x.phase === 'dwell' || x.phase === 'entering').length;
  nxUpdate();
  const tab = document.querySelector('#termPanel [data-ttab][aria-selected="true"]').dataset.ttab;
  tRenderArrivals();
  if (tab === 'tsvc') tRenderSvcList();
  if (tab === 'trelay') tRenderRelay();
  if (tab === 'tcrew') tRenderCrew();
}
function tWireUI() {
  document.querySelectorAll('#termPanel [data-ttab]').forEach(b => b.addEventListener('click', () => tSwitchTab(b.dataset.ttab)));
  $('#nxBody').addEventListener('click', e => { const b = e.target.closest('[data-nx]'); if (b) nxClick(b.dataset.nx); });
  $('#nxToggle').addEventListener('click', () => { $('#nx').classList.toggle('collapsed'); $('#nxToggle').setAttribute('aria-expanded', String(!$('#nx').classList.contains('collapsed'))); });
  $('#arsArr').addEventListener('click', () => openCtrlModal('app'));
  $('#arsDep').addEventListener('click', () => openCtrlModal('dep'));
  $('#tSvcList').addEventListener('click', e => {
    const card = e.target.closest('.card'); if (!card) return;
    const s = tSvc(card.dataset.sid); if (!s) return;
    const b = e.target.closest('button[data-a]');
    if (!b) { tSelect({ sid: s.id }); return; }
    if (b.dataset.a === 'view') { tSelect({ sid: s.id }); const c = selConsist(); if (c) camTerm.follow = c.id; if (narrow()) closeDrawer(); }
    if (b.dataset.a === 'prio') { s.prio = s.prio ? 0 : 1; toast(s.prio ? `${s.name}: ได้ทีมงานก่อน` : `${s.name}: ลำดับปกติ`); }
    if (b.dataset.a === 'dep') requestDeparture(s.track, false);
  });
  $('#tArrivals').addEventListener('click', e => { const li = e.target.closest('li[data-sid]'); if (li) { const s = tSvc(li.dataset.sid); if (s && s.cid) { tSelect({ sid: s.id }); camTerm.follow = s.cid; } } });
  $('#tRoutes').addEventListener('click', e => { const b = e.target.closest('[data-cancel]'); if (b) { const r = tstate.routes.find(x => x.id === b.dataset.cancel); if (r) cancelRoute(r); } });
  $('#buyCrew').addEventListener('click', () => { if (spend(20000)) { tstate.res.crew++; tlog(`จ้างทีมทำความสะอาดเพิ่ม (รวม ${tstate.res.crew} ทีม)`); } });
  $('#buyTruck').addEventListener('click', () => { if (spend(35000)) { tstate.res.truck++; tlog(`ซื้อรถเติมน้ำมันเพิ่ม (รวม ${tstate.res.truck} คัน)`); } });
  $('#tResetBtn').addEventListener('click', () => ask('เริ่มสถานีหัวลำโพงใหม่? ขบวนรถและเส้นทางทั้งหมดในสถานีจะถูกล้าง', () => { tResetWorld(); tScenario(); TRT.logDirty = true; tSvcSig = ''; toast('เริ่มกะใหม่ที่หัวลำโพงแล้ว'); }));
}
function tResetWorld() { for (const id in TRT.cons) tReleaseCons(TRT.cons[id]); TRT.cons = {}; TRT.sel = null; TRT.nxSel = null; $('#dmi').hidden = true; }
const TSAVE_KEY = 'railtrack-hlp-v1';
function tLoad() {
  try {
    const s = JSON.parse(localStorage.getItem(TSAVE_KEY));
    if (s && s.v === 1 && Array.isArray(s.consists) && s.nodes && Object.keys(G.nodes).every(id => s.nodes[id])) return s;
  } catch (e) {}
  return null;
}
const tSerialize = () => JSON.stringify(tstate, (k, v) => (k === '_cum' ? undefined : v));
