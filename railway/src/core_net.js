(() => {
'use strict';
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('th-TH');
const baht = n => (n < 0 ? '-฿' : '฿') + fmt(Math.abs(n));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const narrow = () => window.innerWidth < 820;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- object pool: reuse meshes and DOM nodes instead of allocating per frame ----------
class Pool {
  constructor() { this.free = new Map(); this.made = 0; this.reused = 0; }
  get(key, make) { const l = this.free.get(key); if (l && l.length) { this.reused++; return l.pop(); } this.made++; return make(); }
  put(key, obj) { let l = this.free.get(key); if (!l) this.free.set(key, l = []); l.push(obj); }
}
const meshPool = new Pool(), domPool = new Pool();

// ---------- constants ----------
const DAY_LEN = 60;          // วินาทีจริงต่อ 1 วันในเกม (1×)
const UNIT_KM = GEO_UNIT;    // 1 หน่วยบนแผนที่ = 6 กม. (ระยะตามแนวรางจริง)
const LANE = 1.15, CAR_SP = 3.25;
const FARE_P = 0.22, FARE_C = 0.32;
const TRACK_RATE = 400;      // ค่าเปิดเส้นทางเดินรถต่อหน่วยระยะทาง (สิทธิเดินรถ + ปรับปรุงทาง)
const LINE_COLORS = ['#2f6bff', '#e2556b', '#14a37f', '#f08c1a', '#8b5cf6', '#0ea5c6', '#d946ef', '#64748b', '#84cc16', '#f43f5e', '#06b6d4', '#a16207'];
const TIERS = {
  THN:   { id: 'THN', tier: 1, name: 'THN', full: 'THN ดีเซลราง', desc: 'ราคาถูก คืนทุนไว เหมาะกับผู้โดยสารระยะสั้นที่วิ่งถี่', unlock: 0, price: 35000, kinds: ['P'], v: 6.2, capP: 70, capC: 0, maint: 900, fuel: 3, fareMul: 1, prio: 1, pp: true, maxCars: 4, wear: 3.4, depotT: 20, depotRate: 60, color: '#e8b21d' },
  AD24C: { id: 'AD24C', tier: 2, name: 'AD24C', full: 'Alsthom AD24C', desc: 'หัวรถจักรคลาสสิก ลากสินค้าหนักได้ รายได้สูง แต่ช้า กินน้ำมันและค่าซ่อมแพง', unlock: 80000, price: 65000, kinds: ['C', 'P'], v: 5.0, capP: 80, capC: 45, maint: 2600, fuel: 9, fareMul: 1, prio: 0, pp: false, maxCars: 6, wear: 4.6, depotT: 30, depotRate: 140, color: '#e2772b' },
  ASR:   { id: 'ASR', tier: 3, name: 'ASR', full: 'ASR Sprinter', desc: 'รถด่วนพิเศษ ทำเวลาดี ค่าตั๋วสูงขึ้น 45%', unlock: 250000, price: 110000, kinds: ['P'], v: 8.5, capP: 75, capC: 0, maint: 1600, fuel: 5, fareMul: 1.45, prio: 2, pp: true, maxCars: 4, wear: 3.0, depotT: 22, depotRate: 90, color: '#c62f3c' },
  QSY:   { id: 'QSY', tier: 4, name: 'QSY', full: 'QSY “Ultraman”', desc: 'เรือธง เร็วที่สุด ค่าซ่อมต่ำ ลากได้ทั้งขบวน VIP และสินค้าหนัก', unlock: 600000, price: 260000, kinds: ['P', 'C'], v: 9.5, capP: 90, capC: 55, maint: 800, fuel: 4, fareMul: 1.8, prio: 3, pp: false, maxCars: 6, wear: 1.8, depotT: 14, depotRate: 50, color: '#2f6bff' },
};
const TIER_LIST = ['THN', 'AD24C', 'ASR', 'QSY'];
const DEPOT = [null, { speed: 1, bays: 1, cost: 1, up: 0 }, { speed: 1.6, bays: 2, cost: 0.9, up: 60000 }, { speed: 2.4, bays: 3, cost: 0.8, up: 150000 }];
const TYPE_LABEL = { T: 'สถานีปลายทาง', J: 'สถานีชุมทาง', I: 'สถานีคาร์โก้ (ICD)' };
const TYPE_SHORT = { T: 'ปลายทาง', J: 'ชุมทาง', I: 'ICD' };
const STATIONS = [
  { id: 'BKK', name: 'กรุงเทพ (หัวลำโพง)', type: 'T', pax: 6, cargo: 0.6, cost: 0, plat: 6 },
  { id: 'BPC', name: 'ชุมทางบ้านภาชี', type: 'J', pax: 3.5, cargo: 1.5, cost: 0, plat: 3 },
  { id: 'LKB', name: 'ICD ลาดกระบัง', type: 'I', pax: 0.2, cargo: 6, cost: 40000, plat: 2 },
  { id: 'LCB', name: 'ICD แหลมฉบัง', type: 'I', pax: 0.2, cargo: 7, cost: 45000, plat: 2 },
  { id: 'KAN', name: 'กาญจนบุรี', type: 'J', pax: 3, cargo: 0.5, cost: 50000, plat: 2 },
  { id: 'HHN', name: 'หัวหิน', type: 'J', pax: 4, cargo: 0.3, cost: 60000, plat: 2 },
  { id: 'ARN', name: 'อรัญประเทศ', type: 'T', pax: 2, cargo: 2, cost: 55000, plat: 2 },
  { id: 'KOR', name: 'ชุมทางถนนจิระ', type: 'J', pax: 4, cargo: 2.5, cost: 55000, plat: 3 },
  { id: 'PLK', name: 'พิษณุโลก', type: 'J', pax: 3.5, cargo: 1, cost: 70000, plat: 3 },
  { id: 'SLA', name: 'ชุมทางศิลาอาสน์', type: 'J', pax: 3, cargo: 2, cost: 60000, plat: 3 },
  { id: 'UDN', name: 'อุดรธานี', type: 'J', pax: 3.5, cargo: 1.5, cost: 85000, plat: 3 },
  { id: 'NKI', name: 'หนองคาย', type: 'T', pax: 3, cargo: 2.5, cost: 75000, plat: 3 },
  { id: 'UBN', name: 'อุบลราชธานี', type: 'T', pax: 4, cargo: 1.5, cost: 80000, plat: 3 },
  { id: 'CMI', name: 'เชียงใหม่', type: 'T', pax: 5, cargo: 1, cost: 110000, plat: 4 },
  { id: 'SRT', name: 'สุราษฎร์ธานี', type: 'J', pax: 4, cargo: 1.5, cost: 95000, plat: 3 },
  { id: 'TRG', name: 'ตรัง', type: 'T', pax: 2.5, cargo: 0.8, cost: 90000, plat: 2 },
  { id: 'HDY', name: 'ชุมทางหาดใหญ่', type: 'J', pax: 4.5, cargo: 3, cost: 120000, plat: 3 },
  { id: 'PBR', name: 'ปาดังเบซาร์', type: 'I', pax: 1.5, cargo: 3, cost: 80000, plat: 2 },
  { id: 'SGK', name: 'สุไหงโก-ลก', type: 'T', pax: 2.5, cargo: 1, cost: 90000, plat: 2 },
].map(s => Object.assign(s, { x: GEO.st[s.id][0], z: GEO.st[s.id][1] }));
const SMAP = Object.fromEntries(STATIONS.map(s => [s.id, s]));
const GOALS = [
  { id: 'g1', text: 'ส่งผู้โดยสารครบ 2,000 คน', reward: 20000, check: s => s.stats.paxTotal >= 2000 },
  { id: 'g2', text: 'เปิดสถานี ICD แหลมฉบัง', reward: 15000, check: s => s.stations.LCB.unlocked },
  { id: 'g3', text: 'ปลดล็อก Alsthom AD24C', reward: 15000, check: s => s.tiers.AD24C },
  { id: 'g4', text: 'ขนสินค้าครบ 5,000 ตัน', reward: 30000, check: s => s.stats.cargoTotal >= 5000 },
  { id: 'g5', text: 'ทำสัญญาว่าจ้างสำเร็จ 5 ฉบับ', reward: 40000, check: s => s.stats.contractsDone >= 5 },
  { id: 'g6', text: 'ปลดล็อก ASR Sprinter', reward: 30000, check: s => s.tiers.ASR },
  { id: 'g7', text: 'ปลดล็อก QSY “Ultraman”', reward: 60000, check: s => s.tiers.QSY },
  { id: 'g8', text: `เปิดให้บริการครบทั้ง ${STATIONS.length} สถานี`, reward: 150000, check: s => STATIONS.every(d => s.stations[d.id].unlocked) },
];

// ---------- state ----------
let state;
const newWeek = (n, day) => ({ n, day, inc: { pax: 0, cargo: 0, bonus: 0, contract: 0, coop: 0, term: 0 }, exp: { fuel: 0, maint: 0, staff: 0, depot: 0, penalty: 0, capex: 0 }, legs: 0, onTime: 0, rep0: state ? state.rep : 50 });
function newState() {
  const st = {
    v: 2, money: 90000, day: 1, t: DAY_LEN * 0.25, speed: 1, nextId: 1, rep: 50, lineSeq: 0, seq: { THN: 0, AD24C: 0, ASR: 0, QSY: 0 },
    stations: {}, lines: [], trains: [], goals: {}, log: [], event: null, contracts: [], tiers: { THN: true, AD24C: false, ASR: false, QSY: false },
    depot: { level: 1, auto: true }, sound: true, coopPaid: {},
    stats: { paxTotal: 0, cargoTotal: 0, revToday: 0, costToday: 0, bestDay: 0, history: [], lifetime: 0, legs: 0, onTimeLegs: 0, contractsDone: 0 },
  };
  STATIONS.forEach(d => { st.stations[d.id] = { unlocked: d.cost === 0, level: 1, plat: 0, pax: d.cost === 0 ? 60 : 0, cargo: d.cost === 0 ? 20 : 0 }; });
  st.week = { n: 1, day: 1, inc: { pax: 0, cargo: 0, bonus: 0, contract: 0, coop: 0, term: 0 }, exp: { fuel: 0, maint: 0, staff: 0, depot: 0, penalty: 0, capex: 0 }, legs: 0, onTime: 0, rep0: 50 };
  return st;
}
function earn(v, k) { state.money += v; if (state.week.inc[k] !== undefined) state.week.inc[k] += v; state.stats.revToday += v; state.stats.lifetime += v; }
function pay(v, k) { state.money -= v; if (state.week.exp[k] !== undefined) state.week.exp[k] += v; state.stats.costToday += v; }
function spend(amount, k = 'capex') { if (state.money < amount) { toast(`เงินทุนไม่พอ ต้องใช้ ${baht(amount)}`); return false; } pay(amount, k); return true; }

// ---------- path geometry ----------
function buildPath(a, b) {
  const pts = railPath(a, b) || [{ x: SMAP[a].x, z: SMAP[a].z }, { x: SMAP[b].x, z: SMAP[b].z }];
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, cum, len: cum[cum.length - 1] };
}
function pathAt(P, s) {
  s = clamp(s, 0, P.len);
  let lo = 0, hi = P.cum.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (P.cum[mid] <= s) lo = mid; else hi = mid - 1; }
  const a = P.pts[lo], b = P.pts[lo + 1], seg = (P.cum[lo + 1] - P.cum[lo]) || 1e-6, t = (s - P.cum[lo]) / seg;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, tx: (b.x - a.x) / seg, tz: (b.z - a.z) / seg };
}
function distToPath(P, x, z) {
  let best = Infinity;
  for (let i = 0; i < P.pts.length - 1; i++) {
    const a = P.pts[i], b = P.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz || 1e-6;
    const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / l2, 0, 1);
    best = Math.min(best, Math.hypot(a.x + dx * t - x, a.z + dz * t - z));
  }
  return best;
}

// ---------- runtime ----------
const RT = { lines: {}, trains: {}, stations: {}, platQ: {} };
const lineById = id => state.lines.find(l => l.id === id);
const trainById = id => state.trains.find(t => t.id === id);
const trainHalf = tr => 0.5 + (tr.cars + (TIERS[tr.tier].pp ? 2 : 1)) * 0.08;   // ความยาวขบวนบนแผนที่ (หน่วย)
function stopPoints(tr) { const L = RT.lines[tr.line].path.len, h = trainHalf(tr); return [h + 0.6, L - h - 0.6]; }
function vMax(tr) { let v = TIERS[tr.tier].v; if (tr.cond < 30) v *= 0.8; if (state.event && state.event.type === 'rain') v *= 0.85; return v; }
const lineKm = l => RT.lines[l.id].path.len * UNIT_KM;
const lineName = l => `${l.a}–${l.b}`;
const stationLines = id => state.lines.filter(l => l.a === id || l.b === id);
const stationCap = st => 300 * st.level;
const lvlMult = lv => [1, 1, 1.6, 2.3][lv];
const platformsOf = id => SMAP[id].plat + state.stations[id].plat;
const maxTrainsOn = l => 2 + (l.loops || 0);
const capOf = tr => tr.cars * (tr.kind === 'P' ? TIERS[tr.tier].capP : TIERS[tr.tier].capC);
const offLine = tr => !!(tr.depot || tr.leasedOut || tr.rescue);
const simNow = () => state.day * DAY_LEN + state.t;

// ---------- Three.js ----------
const canvas = $('#gl'), stage = $('#stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -400, 800);
let VIEW = 70;
const MAP = 118;
const camNet = { tx: 14, tz: -14, az: Math.PI / 4, azT: Math.PI / 4, zoom: narrow() ? 0.42 : 0.55, follow: null, view: 70, near: -500, far: 900,
  zmin: 0.22, zmax: 3.2, bounds: [-MAP, MAP, -MAP, MAP], home() { this.tx = 14; this.tz = -14; this.zoom = narrow() ? 0.42 : 0.55; } };
const camTerm = { tx: 400, tz: 96, az: Math.PI / 4, azT: Math.PI / 4, zoom: narrow() ? 0.55 : 0.85, follow: null, view: 360, near: -3000, far: 3000,
  zmin: 0.25, zmax: 7, bounds: [-200, 1000, -150, 250], home() { this.tx = 400; this.tz = 96; this.zoom = narrow() ? 0.55 : 0.85; } };
let cam = camNet;

const hemi = new THREE.HemisphereLight(0xffffff, 0xb9c4d4, 0.78); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.72);
sun.position.set(55, 110, 40); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -135, right: 135, top: 135, bottom: -135, near: 1, far: 400 }); sun.shadow.bias = -0.0006;
scene.add(sun);
const mat = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.75, metalness: 0.05 }, o));
const M = {
  ground: mat(0xf3f6f9), slab: mat(0xcdd6e2), grass: mat(0xd5e9cf), water: mat(0xb9d7ef, { roughness: 0.3 }), sea: mat(0xa7cbe9, { roughness: 0.25 }),
  pad: mat(0xffffff), padLine: mat(0xf5b400), road: mat(0xdfe5ed), roadLine: mat(0xffffff), hill: mat(0xb9cfb2),
  ballast: mat(0xb9c0ca), sleeper: mat(0x8d7b6a), rail: mat(0x5d6672, { metalness: 0.5, roughness: 0.4 }),
  white: mat(0xfbfcfe), navy: mat(0x13294b), navyLite: mat(0x9fb3d6), glass: mat(0x24324a, { roughness: 0.2 }),
  roof: mat(0xe3e8ef), yellow: mat(0xf5b400), dark: mat(0x2b313a), red: mat(0xd33b3b),
  trunk: mat(0xa98b6d), house: mat(0xffffff), locked: mat(0xc6ceda, { transparent: true, opacity: 0.55 }),
  person: mat(0xffffff), signalPole: mat(0x6b7480), lampR: new THREE.MeshBasicMaterial({ color: 0xff3b47 }), lampG: new THREE.MeshBasicMaterial({ color: 0x22d17a }),
  ring: new THREE.MeshBasicMaterial({ color: 0x3A7BD5, transparent: true, opacity: 0.9, depthWrite: false }), warn: new THREE.MeshBasicMaterial({ color: 0xff3b47 }),
  vertex: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.05 }),
};
const CONT_MATS = [0x13294b, 0xf5b400, 0x8a96a8, 0xc62f3c, 0x2f6bff, 0x14a37f].map(c => mat(c));
const unitBox = new THREE.BoxGeometry(1, 1, 1);
function box(w, h, d, m) { const o = new THREE.Mesh(unitBox, m); o.scale.set(w, h, d); o.castShadow = true; o.receiveShadow = true; return o; }
const dummy = new THREE.Object3D();
function mergedGeo(parts) {
  const pos = [], nor = [], col = [], idx = [], c = new THREE.Color();
  for (const q of parts) {
    const g = new THREE.BoxGeometry(q[0], q[1], q[2]); g.translate(q[4] || 0, q[5] || 0, q[6] || 0);
    c.set(q[3]);
    const base = pos.length / 3, P = g.attributes.position.array, N = g.attributes.normal.array;
    for (let i = 0; i < P.length; i++) { pos.push(P[i]); nor.push(N[i]); }
    for (let i = 0; i < P.length / 3; i++) { const k = 0.74 + 0.26 * clamp((P[i * 3 + 1] - 0.45) / 1.7, 0, 1); col.push(c.r * k, c.g * k, c.b * k); }
    for (const i of g.index.array) idx.push(base + i);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}
function isDark() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t) return t === 'dark';
  return !!(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
}
var tThemeHook;
let themeVer = 0;
function applySceneTheme() {
  // Environment lighting follows the in-game clock (applyDayNight); the UI theme only restyles labels.
  RT.labelsDirty = true; themeVer++;
}

// ---------- static world ----------
const rng = (seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(20261008);
const SEA = { x0: -2, x1: MAP, z0: 38, z1: MAP };
const LAKE = { x: -66, z: -6, rx: 12, rz: 8 };
const ROADS = [{ axis: 'z', at: 12, lo: -MAP, hi: MAP }, { axis: 'x', at: 62, lo: -MAP, hi: 36 }];
const inSea = (x, z, pad) => x > SEA.x0 - pad && z > SEA.z0 - pad;
const inLake = (x, z, pad) => ((x - LAKE.x) / (LAKE.rx + pad)) ** 2 + ((z - LAKE.z) / (LAKE.rz + pad)) ** 2 < 1;
const nearStation = (x, z, r) => STATIONS.some(s => Math.hypot(s.x - x, s.z - z) < r);
const nearRoad = (x, z, r) => ROADS.some(rd => { const along = rd.axis === 'z' ? x : z; return along > rd.lo && along < rd.hi && Math.abs((rd.axis === 'z' ? z : x) - rd.at) < r; });
{
  const slab = box(MAP * 2, 3, MAP * 2, M.ground); slab.position.y = -1.5; slab.castShadow = false; scene.add(slab);
  const skirt = box(MAP * 2 + 0.6, 2.6, MAP * 2 + 0.6, M.slab); skirt.position.y = -1.9; skirt.castShadow = false; scene.add(skirt);
  const sea = box(SEA.x1 - SEA.x0, 0.1, SEA.z1 - SEA.z0, M.sea); sea.position.set((SEA.x0 + SEA.x1) / 2, 0.03, (SEA.z0 + SEA.z1) / 2); sea.castShadow = false; scene.add(sea);
  const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 40), M.water); lake.rotation.x = -Math.PI / 2; lake.scale.set(LAKE.rx, LAKE.rz, 1); lake.position.set(LAKE.x, 0.03, LAKE.z); scene.add(lake);
  ROADS.forEach(r => {
    const len = r.hi - r.lo, mid = (r.hi + r.lo) / 2;
    const road = box(r.axis === 'z' ? len : 3.2, 0.06, r.axis === 'z' ? 3.2 : len, M.road); road.castShadow = false;
    road.position.set(r.axis === 'x' ? r.at : mid, 0.04, r.axis === 'z' ? r.at : mid); scene.add(road);
    const n = Math.floor(len / 4), dashes = new THREE.InstancedMesh(unitBox, M.roadLine, n);
    for (let i = 0; i < n; i++) {
      const p = r.lo + 2 + i * 4;
      dummy.position.set(r.axis === 'x' ? r.at : p, 0.08, r.axis === 'z' ? r.at : p); dummy.rotation.set(0, 0, 0);
      dummy.scale.set(r.axis === 'z' ? 1.4 : 0.14, 0.02, r.axis === 'z' ? 0.14 : 1.4); dummy.updateMatrix(); dashes.setMatrixAt(i, dummy.matrix);
    }
    scene.add(dashes);
  });
  const patches = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 28), M.grass, 24);
  for (let i = 0; i < 24; i++) {
    let x, z, n = 0;
    do { x = (rng() * 2 - 1) * (MAP - 14); z = (rng() * 2 - 1) * (MAP - 14); n++; } while ((nearStation(x, z, 18) || inLake(x, z, 6) || inSea(x, z, 8)) && n < 60);
    const r = 6 + rng() * 10;
    dummy.position.set(x, 0.02, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(r, r * (0.6 + rng() * 0.5), 1); dummy.updateMatrix(); patches.setMatrixAt(i, dummy.matrix);
  }
  patches.count = 0;
  const hills = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), M.hill, 26); hills.castShadow = hills.receiveShadow = true;
  let hn = 0;
  for (let k = 0; k < 200 && hn < 26; k++) {
    const x = -112 + rng() * 120, z = -114 + rng() * 60;
    if (nearStation(x, z, 16)) continue;
    const r = 5 + rng() * 9, h = 4 + rng() * 9;
    dummy.position.set(x, h / 2, z); dummy.rotation.set(0, rng() * 3, 0); dummy.scale.set(r, h, r); dummy.updateMatrix(); hills.setMatrixAt(hn++, dummy.matrix);
  }
  hills.count = hn; scene.add(hills);
}
const DECOR = { trees: [], houses: [] };
const treeTrunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 1, 6), M.trunk, 380);
const treeCrown = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), M.house, 380);
treeTrunk.castShadow = treeCrown.castShadow = true;
{
  let n = 0, tries = 0;
  while (n < 380 && tries < 6000) {
    tries++;
    const x = (rng() * 2 - 1) * (MAP - 3), z = (rng() * 2 - 1) * (MAP - 3);
    if (nearStation(x, z, 11) || nearRoad(x, z, 2.6) || inLake(x, z, 2) || inSea(x, z, 1.5)) continue;
    DECOR.trees.push({ x, z, s: 0.75 + rng() * 0.6, i: n, hidden: false }); n++;
  }
  treeTrunk.count = treeCrown.count = n;
  const c1 = new THREE.Color(0xa3d98c), c2 = new THREE.Color(0x7cc47a);
  DECOR.trees.forEach(t => treeCrown.setColorAt(t.i, rng() < 0.5 ? c1 : c2));
  scene.add(treeTrunk, treeCrown);
}
const houseMesh = new THREE.InstancedMesh(unitBox, M.house, 160);
houseMesh.castShadow = houseMesh.receiveShadow = true;
{
  const cols = [0xffffff, 0xdfe8f7, 0xeef1f5, 0xcfdcf2, 0xf6efe4].map(c => new THREE.Color(c));
  let n = 0;
  STATIONS.forEach(st => {
    let k = 0, tries = 0;
    while (k < 13 && tries < 220) {
      tries++;
      const ang = rng() * Math.PI * 2, r = 10 + rng() * 9, x = st.x + Math.cos(ang) * r, z = st.z + Math.sin(ang) * r;
      if (Math.abs(x - st.x) < 4 || Math.abs(z - st.z) < 4 || Math.abs(x) > MAP - 3 || Math.abs(z) > MAP - 3) continue;
      if (nearRoad(x, z, 3.2) || inLake(x, z, 2) || inSea(x, z, 1) || STATIONS.some(o => o !== st && Math.hypot(o.x - x, o.z - z) < 10)) continue;
      if (DECOR.houses.some(h => Math.hypot(h.x - x, h.z - z) < 3)) continue;
      const w = 1.6 + rng() * 1.6, d = 1.6 + rng() * 1.6, h = 0.9 + rng() * (st.id === 'BKK' ? 5 : 2.2);
      DECOR.houses.push({ x, z, w, d, h, i: n, hidden: false });
      houseMesh.setColorAt(n, cols[Math.floor(rng() * cols.length)]); n++; k++;
    }
  });
  houseMesh.count = n; scene.add(houseMesh);
}
function writeDecor() {
  DECOR.trees.forEach(t => {
    const s = t.hidden ? 0.0001 : t.s;
    dummy.rotation.set(0, 0, 0);
    dummy.position.set(t.x, 0.5 * s, t.z); dummy.scale.set(s, s, s); dummy.updateMatrix(); treeTrunk.setMatrixAt(t.i, dummy.matrix);
    dummy.position.set(t.x, 1.55 * s, t.z); dummy.scale.set(0.85 * s, 0.95 * s, 0.85 * s); dummy.updateMatrix(); treeCrown.setMatrixAt(t.i, dummy.matrix);
  });
  DECOR.houses.forEach(h => {
    const k = h.hidden ? 0.0001 : 1;
    dummy.rotation.set(0, 0, 0); dummy.position.set(h.x, h.h / 2 * k, h.z); dummy.scale.set(h.w * k, h.h * k, h.d * k); dummy.updateMatrix(); houseMesh.setMatrixAt(h.i, dummy.matrix);
  });
  treeTrunk.instanceMatrix.needsUpdate = treeCrown.instanceMatrix.needsUpdate = houseMesh.instanceMatrix.needsUpdate = true;
  if (houseMesh.instanceColor) houseMesh.instanceColor.needsUpdate = true;
  if (treeCrown.instanceColor) treeCrown.instanceColor.needsUpdate = true;
  fxWriteDecor();
}
function clearDecorAlong(P) {
  DECOR.trees.forEach(t => { if (!t.hidden && distToPath(P, t.x, t.z) < 4) t.hidden = true; });
  DECOR.houses.forEach(h => { if (!h.hidden && distToPath(P, h.x, h.z) < 3.2 + Math.max(h.w, h.d) / 2) h.hidden = true; });
}
const vehicles = [];
{
  const cols = [0xffffff, 0x13294b, 0xf5b400, 0xe3e8ef, 0x14a37f];
  for (let i = 0; i < 12; i++) {
    const road = ROADS[i % 2], dir = i % 4 < 2 ? 1 : -1, truck = rng() < 0.5, g = new THREE.Group();
    const body = box(truck ? 1.1 : 0.9, truck ? 1.0 : 0.55, truck ? 2.4 : 1.6, mat(cols[i % cols.length])); body.position.y = truck ? 0.65 : 0.45; g.add(body);
    const cab = box(truck ? 1.0 : 0.8, truck ? 0.7 : 0.4, truck ? 0.7 : 0.8, M.white); cab.position.set(0, truck ? 0.5 : 0.85, truck ? 1.55 : -0.1); g.add(cab);
    scene.add(g);
    vehicles.push({ g, road, dir, p: road.lo + rng() * (road.hi - road.lo), v: 3 + rng() * 2.5 });
  }
}

// ---------- stations ----------
const stationRoot = new THREE.Group(), lineRoot = new THREE.Group(), trainRoot = new THREE.Group();
scene.add(stationRoot, lineRoot, trainRoot);
const pickables = [];
const personGeo = new THREE.CylinderGeometry(0.17, 0.2, 0.75, 8);
const crateGeo = new THREE.BoxGeometry(0.78, 0.78, 0.78);
const contGeo = new THREE.BoxGeometry(0.8, 0.78, 1.7);
function labelTexture(def, locked, st) {
  const c = document.createElement('canvas'); c.width = 560; c.height = 150;
  const g = c.getContext('2d'), d = isDark();
  g.fillStyle = 'rgba(15,34,64,0.94)';
  g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 3;
  const r = 26; g.beginPath(); g.moveTo(r + 4, 4); g.arcTo(556, 4, 556, 146, r); g.arcTo(556, 146, 4, 146, r); g.arcTo(4, 146, 4, 4, r); g.arcTo(4, 4, 556, 4, r); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = locked ? '#6B7A90' : '#FFFFFF';
  const cx = 48, cy = 75;
  g.beginPath();
  if (def.type === 'T') g.rect(cx - 17, cy - 17, 34, 34);
  else if (def.type === 'J') { g.moveTo(cx, cy - 21); g.lineTo(cx + 21, cy); g.lineTo(cx, cy + 21); g.lineTo(cx - 21, cy); g.closePath(); }
  else { for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; g.lineTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); } g.closePath(); }
  g.fill();
  g.fillStyle = '#FFFFFF';
  g.font = '700 44px "Chakra Petch", "IBM Plex Sans Thai", sans-serif'; g.textBaseline = 'middle';
  g.fillText(def.name, 86, 56, 455);
  g.fillStyle = '#A7B6CF';
  g.font = '500 28px "IBM Plex Sans Thai", sans-serif';
  g.fillText(locked ? `${TYPE_SHORT[def.type]} · ปิด · ฿${fmt(def.cost)}` : `${TYPE_SHORT[def.type]} · ${platformsOf(def.id)} ชานชาลา · ระดับ ${st.level}`, 86, 106, 455);
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; return tex;
}
function dropPickables(group) { group.traverse(o => { const i = pickables.indexOf(o); if (i >= 0) pickables.splice(i, 1); }); }
function makeStation(def) {
  const old = RT.stations[def.id];
  if (old) { stationRoot.remove(old.group); dropPickables(old.group); }
  const st = state.stations[def.id], locked = !st.unlocked;
  const g = new THREE.Group(); g.position.set(def.x, 0, def.z);
  const m = x => locked ? M.locked : x;
  const pad = box(13, 0.3, 13, m(M.pad)); pad.position.y = 0.15; pad.castShadow = false; g.add(pad);
  if (!locked) [[-6.2, 0], [6.2, 0], [0, -6.2], [0, 6.2]].forEach(([x, z]) => { const e = box(x ? 0.2 : 12.6, 0.04, x ? 12.6 : 0.2, M.padLine); e.position.set(x, 0.31, z); e.castShadow = false; g.add(e); });
  const bh = 2.0 + st.level * 0.7 + (def.type === 'T' ? 1 : 0);
  const bld = bbox(3.4, bh, 3.4, m(M.white)); bld.position.set(-4.3, 0.3 + bh / 2, -4.3); g.add(bld);
  const roof = box(3.9, 0.22, 3.9, m(def.type === 'T' ? M.navy : M.roof)); roof.position.set(-4.3, 0.3 + bh + 0.11, -4.3); g.add(roof);
  for (let k = 0; k < 2; k++) { const dr = box(0.9, 1.3, 0.06, m(M.navy)); dr.position.set(-4.95 + k * 1.3, 0.95, -2.57); g.add(dr); }
  const sign = box(2.4, 0.5, 0.08, m(M.yellow)); sign.position.set(-4.3, 0.3 + bh - 0.5, -2.56); g.add(sign);
  if (def.type !== 'I') {
    [[2.9, -2.9], [5.7, -2.9], [2.9, -5.7], [5.7, -5.7]].forEach(([x, z]) => { const p = box(0.14, 2.2, 0.14, m(M.white)); p.position.set(x, 1.4, z); g.add(p); });
    const can = box(3.6, 0.14, 3.6, m(M.navyLite)); can.position.set(4.3, 2.55, -4.3); g.add(can);
  }
  if (def.type === 'T') { [-1.6, 1.6].forEach(z => { const b = box(0.6, 0.8, 1.2, m(M.red)); b.position.set(-6, 0.7, z); g.add(b); }); }
  if (def.type === 'J') {
    const tower = bbox(1.6, 3.6, 1.6, m(M.white)); tower.position.set(-4.3, 2.1, 4.3); g.add(tower);
    const cab = box(2.0, 1.0, 2.0, m(M.glass)); cab.position.set(-4.3, 4.4, 4.3); g.add(cab);
    const cr = box(2.3, 0.2, 2.3, m(M.navy)); cr.position.set(-4.3, 5.0, 4.3); g.add(cr);
  } else {
    const shed = bbox(3.4, 1.9, 3.2, m(M.white)); shed.position.set(-4.3, 1.25, 4.3); g.add(shed);
    const shedRoof = box(3.6, 0.16, 3.4, m(M.roof)); shedRoof.position.set(-4.3, 2.28, 4.3); g.add(shedRoof);
  }
  let people = null, crates = null, crane = null;
  if (!locked) {
    if (def.type !== 'I') {
      people = new THREE.InstancedMesh(personGeo, M.person, 30); people.castShadow = true; people.count = 0;
      const pc = [0xffffff, 0x13294b, 0xf5b400, 0x14a37f, 0xe2556b, 0x9fb3d6].map(c => new THREE.Color(c));
      for (let i = 0; i < 30; i++) {
        const col = i % 6, row = Math.floor(i / 6);
        dummy.position.set(2.95 + col * 0.55 + (row % 2) * 0.12, 0.68, -3.0 - row * 0.62); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
        people.setMatrixAt(i, dummy.matrix); people.setColorAt(i, pc[Math.floor(Math.abs(i * 7 + def.x)) % 6]);
      }
      g.add(people);
    }
    const isI = def.type === 'I', N = isI ? 36 : 27;
    crates = new THREE.InstancedMesh(isI ? contGeo : crateGeo, M.person, N); crates.castShadow = true; crates.count = 0;
    const cc = [0x13294b, 0xf5b400, 0x8a96a8, 0xc62f3c, 0x2f6bff].map(c => new THREE.Color(c));
    for (let i = 0; i < N; i++) {
      if (isI) { const layer = Math.floor(i / 12), k = i % 12; dummy.position.set(1.6 + (k % 4) * 1.0, 0.7 + layer * 0.8, 2.4 + Math.floor(k / 4) * 1.85); }
      else { const layer = Math.floor(i / 9), k = i % 9; dummy.position.set(3.4 + (k % 3) * 0.86, 0.7 + layer * 0.8, 3.4 + Math.floor(k / 3) * 0.86); }
      dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix();
      crates.setMatrixAt(i, dummy.matrix); crates.setColorAt(i, cc[(i * 5 + 1) % cc.length]);
    }
    g.add(crates);
    crane = new THREE.Group();
    if (isI) {
      [-1, 1].forEach(sx => [-1, 1].forEach(sz => { const leg = box(0.2, 4.4, 0.2, M.yellow); leg.position.set(3.5 + sx * 2.7, 2.5, sz * 0.9); crane.add(leg); }));
      const beam = box(6.0, 0.35, 2.1, M.yellow); beam.position.set(3.5, 4.8, 0); crane.add(beam);
      const trol = box(0.8, 0.5, 1.2, M.navy); trol.position.set(3.5, 4.4, 0); crane.add(trol); crane.userData.trol = trol;
      crane.position.z = 4.2;
    } else {
      const fb = box(0.7, 0.55, 1.0, M.yellow); fb.position.y = 0.65; crane.add(fb);
      const fc = box(0.6, 0.5, 0.5, M.dark); fc.position.set(0, 1.15, -0.15); crane.add(fc);
      const mast = box(0.08, 1.4, 0.08, M.dark); mast.position.set(0.22, 1.0, 0.55); crane.add(mast);
      crane.position.set(5.6, 0, 5.6);
    }
    g.add(crane);
  }
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(def, locked, st), depthTest: false, transparent: true }));
  label.scale.set(10.5, 2.81, 1); label.position.set(0, 7.8, 0); label.renderOrder = 10; g.add(label);
  g.traverse(o => { if (o.isMesh) { o.userData.pick = { type: 'station', id: def.id }; pickables.push(o); } });
  stationRoot.add(g);
  RT.stations[def.id] = { group: g, people, crates, crane, label, ph: rng() * 6, isI: def.type === 'I' };
}
function refreshLabels() {
  STATIONS.forEach(d => { const r = RT.stations[d.id]; if (!r) return; const st = state.stations[d.id]; r.label.material.map.dispose(); r.label.material.map = labelTexture(d, !st.unlocked, st); r.label.material.needsUpdate = true; });
}

// ---------- track ----------
function buildTrack(line) {
  const P = buildPath(line.a, line.b), g = new THREE.Group(), n = P.pts.length - 1;
  const ballast = new THREE.InstancedMesh(unitBox, M.ballast, n), rails = new THREE.InstancedMesh(unitBox, M.rail, n * 4);
  const nS = Math.floor(P.len / 0.95), sleepers = new THREE.InstancedMesh(unitBox, M.sleeper, nS);
  ballast.receiveShadow = rails.receiveShadow = sleepers.receiveShadow = true;
  for (let i = 0; i < n; i++) {
    const a = P.pts[i], b = P.pts[i + 1], dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz) || 1e-6;
    const yaw = Math.atan2(dx, dz), mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, nx = -dz / len, nz = dx / len;
    dummy.rotation.set(0, yaw, 0);
    dummy.position.set(mx, 0.08, mz); dummy.scale.set(4.8, 0.16, len + 0.35); dummy.updateMatrix(); ballast.setMatrixAt(i, dummy.matrix);
    let k = 0;
    for (const lane of [-1, 1]) for (const side of [-0.42, 0.42]) {
      const off = lane * LANE + side;
      dummy.position.set(mx + nx * off, 0.3, mz + nz * off); dummy.scale.set(0.11, 0.12, len + 0.03); dummy.updateMatrix(); rails.setMatrixAt(i * 4 + k++, dummy.matrix);
    }
  }
  for (let j = 0; j < nS; j++) {
    const p = pathAt(P, (j + 0.5) * 0.95);
    dummy.rotation.set(0, Math.atan2(p.tx, p.tz), 0); dummy.position.set(p.x, 0.2, p.z); dummy.scale.set(4.1, 0.08, 0.3); dummy.updateMatrix(); sleepers.setMatrixAt(j, dummy.matrix);
  }
  g.add(ballast, sleepers, rails);
  const loopGroup = new THREE.Group(); g.add(loopGroup);
  const signals = [0, 1].map(end => {
    const s = end === 0 ? 8.5 : P.len - 8.5, p = pathAt(P, s), side = end === 0 ? 1 : -1, off = side * 3.1;
    const sg = new THREE.Group(); sg.position.set(p.x - p.tz * off, 0, p.z + p.tx * off);
    const pole = box(0.14, 2.4, 0.14, M.signalPole); pole.position.y = 1.2; sg.add(pole);
    const head = box(0.42, 0.7, 0.3, M.dark); head.position.y = 2.6; sg.add(head);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), M.lampG); lamp.position.set(0, 2.72, 0); sg.add(lamp);
    const band = box(0.2, 0.3, 0.2, new THREE.MeshBasicMaterial({ color: new THREE.Color(line.color) })); band.position.y = 1.9; sg.add(band);
    g.add(sg); return lamp;
  });
  lineRoot.add(g);
  RT.lines[line.id] = { path: P, group: g, signals, loopGroup };
  buildLoops(line);
  clearDecorAlong(P); writeDecor();
}
function buildLoops(line) {
  const rl = RT.lines[line.id]; if (!rl) return;
  const lg = rl.loopGroup; while (lg.children.length) lg.remove(lg.children[0]);
  for (let k = 0; k < (line.loops || 0); k++) {
    const P = rl.path, s = P.len * (k === 0 ? 0.5 : 0.3), p = pathAt(P, s), side = k === 0 ? 1 : -1, off = side * 3.6;
    const yaw = Math.atan2(p.tx, p.tz), cx = p.x - p.tz * off, cz = p.z + p.tx * off;
    const b = box(2.2, 0.16, 16, M.ballast); b.position.set(cx, 0.08, cz); b.rotation.y = yaw; b.castShadow = false; lg.add(b);
    [-0.42, 0.42].forEach(o => { const r = box(0.11, 0.12, 16, M.rail); r.position.set(cx - p.tz * o, 0.3, cz + p.tx * o); r.rotation.y = yaw; lg.add(r); });
  }
}

// ---------- train meshes (merged geometry + pooled) ----------
const W = 1.5;
const BASE_PARTS = [[1.3, 0.3, 2.8, 0x2b313a, 0, 0.55, 0], [1.15, 0.34, 0.7, 0x1f242b, 0, 0.5, -0.95], [1.15, 0.34, 0.7, 0x1f242b, 0, 0.5, 0.95]];
const CAR_PARTS = {
  thn_cab: [[W, 1.25, 2.95, 0xefe3c2, 0, 1.35, 0], [W + 0.03, 0.22, 2.96, 0x13294b, 0, 0.95, 0], [W + 0.03, 0.08, 2.96, 0xf5b400, 0, 1.16, 0], [W + 0.03, 0.32, 2.4, 0x24324a, 0, 1.56, -0.2], [1.3, 0.4, 0.04, 0x24324a, 0, 1.6, 1.48], [1.3, 0.08, 2.8, 0xb7bfca, 0, 2.0, 0]],
  thn_car: [[W, 1.25, 2.95, 0xefe3c2, 0, 1.35, 0], [W + 0.03, 0.22, 2.96, 0x13294b, 0, 0.95, 0], [W + 0.03, 0.08, 2.96, 0xf5b400, 0, 1.16, 0], [W + 0.03, 0.32, 2.6, 0x24324a, 0, 1.56, 0], [1.3, 0.08, 2.8, 0xb7bfca, 0, 2.0, 0]],
  asr_cab: [[W, 1.25, 2.6, 0xf7f8fa, 0, 1.35, -0.17], [W, 0.8, 0.5, 0xc62f3c, 0, 1.12, 1.2], [W + 0.03, 0.2, 2.96, 0xc62f3c, 0, 0.95, 0], [W + 0.03, 0.34, 2.2, 0x24324a, 0, 1.58, -0.3], [1.3, 0.42, 0.05, 0x24324a, 0, 1.72, 1.0], [1.3, 0.08, 2.5, 0xb7bfca, 0, 2.0, -0.2]],
  asr_car: [[W, 1.25, 2.95, 0xf7f8fa, 0, 1.35, 0], [W + 0.03, 0.2, 2.96, 0xc62f3c, 0, 0.95, 0], [W + 0.03, 0.34, 2.6, 0x24324a, 0, 1.58, 0], [1.3, 0.08, 2.8, 0xb7bfca, 0, 2.0, 0]],
  ad_loco: [[W, 1.3, 2.2, 0xe2772b, 0, 1.4, -0.35], [W, 1.45, 0.75, 0xf0d9b0, 0, 1.47, 1.1], [1.3, 0.36, 0.04, 0x24324a, 0, 1.82, 1.48], [W + 0.03, 0.18, 2.96, 0x13294b, 0, 0.95, 0], [1.1, 0.1, 2.0, 0x8f99a6, 0, 2.1, -0.35], [0.8, 0.1, 0.04, 0xfff6d8, 0, 1.2, 1.49]],
  ad_coach: [[W, 1.3, 2.95, 0xf1e6cf, 0, 1.37, 0], [W + 0.03, 0.26, 2.96, 0x8e2b2b, 0, 0.95, 0], [W + 0.03, 0.34, 2.6, 0x24324a, 0, 1.6, 0], [1.3, 0.1, 2.8, 0x8f99a6, 0, 2.06, 0]],
  qsy_loco: [[W, 1.4, 2.95, 0xf3f5f8, 0, 1.42, 0], [W + 0.03, 0.55, 0.55, 0xd33b3b, 0, 1.1, 1.22], [W + 0.03, 0.2, 2.96, 0x13294b, 0, 0.95, 0], [1.3, 0.42, 0.05, 0x24324a, 0, 1.8, 1.48], [1.1, 0.1, 2.4, 0x8f99a6, 0, 2.17, 0], [0.8, 0.1, 0.04, 0xfff6d8, 0, 1.25, 1.5]],
  qsy_coach: [[W, 1.3, 2.95, 0xf3f5f8, 0, 1.37, 0], [W + 0.03, 0.24, 2.96, 0x13294b, 0, 0.95, 0], [W + 0.03, 0.06, 2.96, 0xd33b3b, 0, 1.12, 0], [W + 0.03, 0.34, 2.6, 0x24324a, 0, 1.6, 0], [1.3, 0.1, 2.8, 0x8f99a6, 0, 2.06, 0]],
  flat: [[W, 0.22, 2.95, 0x7c8693, 0, 0.82, 0]],
};
const CAR_GEO = {};
function carGeo(type) {
  if (CAR_GEO[type]) return CAR_GEO[type];
  const [base, liv] = type.split('|'), L = liv && LIVERIES[liv];
  const parts = L ? CAR_PARTS[base].map(p => { const r = LIV_ROLE[p[3]]; return r ? [p[0], p[1], p[2], L[r], p[4], p[5], p[6]] : p; }) : CAR_PARTS[base];
  return (CAR_GEO[type] = mergedGeo(BASE_PARTS.concat(parts)));
}
function makeCarObj(type) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(carGeo(type), M.vertex); m.castShadow = true; m.receiveShadow = true; g.add(m);
  if (type.split('|')[0] === 'flat') g.userData.conts = [-0.75, 0.75].map((z, i) => { const c = new THREE.Mesh(contGeo, CONT_MATS[Math.floor(rng() * CONT_MATS.length)]); c.position.set(0, 1.33, z); c.scale.set(1.55, 1, 0.85); c.castShadow = true; g.add(c); return c; });
  const ao = new THREE.Mesh(flatPlane, AO_MAT); ao.position.y = 0.06; ao.scale.set(2.6, 1, 3.8); ao.renderOrder = 1; g.add(ao);
  g.userData.type = type;
  return g;
}
function consistTypes(tr) {
  const T = TIERS[tr.tier];
  if (tr.tier === 'THN') return ['thn_cab'].concat(Array(tr.cars).fill('thn_car'), ['thn_cab']);
  if (tr.tier === 'ASR') return ['asr_cab'].concat(Array(tr.cars).fill('asr_car'), ['asr_cab']);
  const loco = tr.tier === 'AD24C' ? 'ad_loco' : 'qsy_loco';
  const car = tr.kind === 'C' ? 'flat' : (tr.tier === 'AD24C' ? 'ad_coach' : 'qsy_coach');
  return T ? [loco].concat(Array(tr.cars).fill(car)) : [];
}
function makeTrain(tr) {
  removeTrainMesh(tr.id);
  const g = new THREE.Group(), cars = consistTypes(tr).map(t => (tr.livery && tr.livery !== 'std' && t !== 'flat' ? t + '|' + tr.livery : t)).map(t => { const o = meshPool.get(t, () => makeCarObj(t)); o.visible = true; g.add(o); return o; });
  const warn = meshPool.get('warn', () => new THREE.Mesh(new THREE.OctahedronGeometry(0.55), M.warn)); warn.visible = false; g.add(warn);
  g.traverse(o => { if (o.isMesh) { o.userData.pick = { type: 'train', id: tr.id }; pickables.push(o); } });
  trainRoot.add(g);
  RT.trains[tr.id] = { group: g, cars, warn };
}
function removeTrainMesh(id) {
  const r = RT.trains[id]; if (!r) return;
  trainRoot.remove(r.group); dropPickables(r.group);
  r.cars.forEach(o => { r.group.remove(o); meshPool.put(o.userData.type, o); });
  r.group.remove(r.warn); meshPool.put('warn', r.warn);
  delete RT.trains[id];
}
const ring = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 48), M.ring);
ring.rotation.x = -Math.PI / 2; ring.visible = false; ring.renderOrder = 5; scene.add(ring);

// ---------- log / toast / helpers ----------
function log(text, kind = '') { state.log.unshift({ d: state.day, t: clockStr(state.t), text, kind }); state.log.length = Math.min(state.log.length, 50); RT.logDirty = true; }
function toast(text) { const box = $('#toast'); while (box.children.length >= 4) box.firstChild.remove(); const el = document.createElement('div'); el.textContent = text; box.appendChild(el); setTimeout(() => el.remove(), 3400); }
function clockStr(t) { const m = Math.floor(t / DAY_LEN * 1440); return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
function setF(card, f, fn) { const el = card.querySelector(`[data-f="${f}"]`); if (el) fn(el); }

// ---------- building lines ----------
function inLakePath(P) { for (let s = 0; s < P.len; s += 2) { const p = pathAt(P, s); if (inLake(p.x, p.z, 2) || inSea(p.x, p.z, 2)) return true; } return false; }
function evalLine(a, b) {
  if (!a || !b || a === b) return { ok: false, reason: 'เลือกสถานีต้นทางและปลายทางที่ต่างกัน' };
  if (!state.stations[a].unlocked || !state.stations[b].unlocked) return { ok: false, reason: 'ต้องเปิดสถานีทั้งสองก่อน' };
  if (state.lines.some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a))) return { ok: false, reason: 'มีเส้นทางนี้อยู่แล้ว' };
  if (!railPath(a, b)) return { ok: false, reason: 'ไม่มีทางรถไฟเชื่อมสองสถานีนี้' };
  const P = buildPath(a, b), km = P.len * UNIT_KM;
  if (km < 30) return { ok: false, reason: 'สองสถานีอยู่ใกล้กันเกินไป (ต่ำกว่า 30 กม.)' };
  return { ok: true, mode: 'rail', pa: null, pb: null, len: P.len, km, cost: Math.round(P.len * TRACK_RATE / 500) * 500 };
}
function addLine(a, b, free) {
  const ev = evalLine(a, b);
  if (!ev.ok) { toast(ev.reason); return null; }
  if (!free && !spend(ev.cost)) return null;
  const line = { id: 'L' + (state.nextId++), a, b, mode: ev.mode, pa: ev.pa, pb: ev.pb, color: LINE_COLORS[state.lineSeq++ % LINE_COLORS.length], loops: 0 };
  state.lines.push(line); buildTrack(line);
  if (!free) log(`เปิดเส้นทางเดินรถ ${SMAP[a].name} – ${SMAP[b].name} (${fmt(ev.km)} กม.) ${baht(ev.cost)}`);
  return line;
}
function trainName(tier) { const n = ++state.seq[tier]; return { THN: `THN ${1100 + n}`, AD24C: `AD ${4100 + n}`, ASR: `ASR ${2500 + n}`, QSY: `QSY ${5100 + n}` }[tier]; }
function placeOnLine(tr) {
  const onLine = state.trains.filter(t => t !== tr && t.line === tr.line && !offLine(t));
  const [s0, s1] = stopPoints(tr), L = RT.lines[tr.line].path.len;
  const nearA = onLine.some(t => t.s < L / 2), nearB = onLine.some(t => t.s >= L / 2);
  if (nearA && !nearB) { tr.s = s1; tr.dir = -1; tr.lane = -1; } else { tr.s = s0; tr.dir = 1; tr.lane = 1; }
  tr.locoAt = tr.dir; tr.st = 'load'; tr.timer = 2.5; tr.v = 0; tr.load = 0; tr.leg = 0; tr.legT = 0;
  const line = lineById(tr.line); tr.plat = tr.dir > 0 ? line.a : line.b;
}
function buyTrain(lineId, tier, kind, free, extra) {
  const line = lineById(lineId); if (!line) return null;
  const T = TIERS[tier];
  if (!state.tiers[tier] && !free) { toast(`${T.full} ยังไม่ปลดล็อก`); return null; }
  if (!T.kinds.includes(kind)) kind = T.kinds[0];
  const onLine = state.trains.filter(t => t.line === lineId && !offLine(t));
  if (onLine.length >= maxTrainsOn(line)) { toast(`เส้นทางนี้รับได้ ${maxTrainsOn(line)} ขบวน สร้างทางหลีกเพื่อเพิ่ม`); return null; }
  if (!free && !(extra && extra.leased) && !crewFree()) { toast(`ลูกเรือไม่พอ (${crewUsed()}/${crewCap()}) จ้างเพิ่มที่ปุ่มลูกเรือด้านบน`); openCrewModal(); return null; }
  if (!free && !spend(T.price)) return null;
  const tr = Object.assign({ id: 'T' + (state.nextId++), name: trainName(tier), line: lineId, tier, kind, cars: 2, cond: 100, s: 0, dir: 1, lane: 1, v: 0, st: 'load', timer: 2.5, load: 0, leg: 0, legT: 0,
    broken: false, repair: 0, breakAt: 0, plat: null, origin: null, locoAt: 1, depot: null, leasable: false }, extra || {});
  state.trains.push(tr); placeOnLine(tr); makeTrain(tr);
  if (!free) log(`ซื้อ ${T.full} (${tr.name}) สาย ${lineName(line)} ${baht(T.price)}`);
  return tr;
}
const trainEnds = tr => { const l = lineById(tr.line); return tr.dir > 0 ? [l.a, l.b] : [l.b, l.a]; };

// ---------- simulation ----------
function dwellTime(tr, sid) {
  const T = TIERS[tr.tier], d = SMAP[sid];
  let t = 2.6;
  if (d.type === 'J') t *= 0.8;
  if (d.type === 'T' && !T.pp) t += ctrlOn('shunt') ? 1.2 : 2.4;
  if (ctrlOn('ground')) t *= 0.8;           // สับหลีกหัวรถจักรที่สถานีปลายทาง
  if (d.type === 'I' && tr.kind === 'C') t /= (0.8 + 0.3 * state.stations[sid].level);
  return t;
}
function requestPlat(tr, sid) {
  const q = RT.platQ[sid] || (RT.platQ[sid] = []);
  if (!q.some(x => x.id === tr.id)) q.push({ id: tr.id, t: simNow(), prio: TIERS[tr.tier].prio });
}
function allocPlatforms() {
  for (const sid in RT.platQ) {
    const line = id => lineById(id);
    let q = RT.platQ[sid].filter(x => { const tr = trainById(x.id); if (!tr || offLine(tr) || tr.st !== 'run' || tr.plat === sid) return false; const l = line(tr.line); return (tr.dir > 0 ? l.b : l.a) === sid; });
    RT.platQ[sid] = q;
    if (!q.length) continue;
    let occ = state.trains.filter(t => t.plat === sid && !offLine(t)).length;
    const cap = platformsOf(sid);
    const sorted = q.slice().sort((a, b) => (b.prio - a.prio) || (a.t - b.t));
    for (const x of sorted) {
      if (occ >= cap) break;
      const tr = trainById(x.id); tr.plat = sid; occ++;
      const earlier = q.find(o => o !== x && o.t < x.t && o.prio < x.prio);
      if (earlier) { const o = trainById(earlier.id); if (o && RT.lastPrioLog !== x.id + o.id) { RT.lastPrioLog = x.id + o.id; log(`${SMAP[sid].name}: ${tr.name} (${TIERS[tr.tier].name}) ได้ชานชาลาก่อน ${o.name} — หลีกทางให้รถด่วน`); } }
      RT.platQ[sid] = RT.platQ[sid].filter(o => o !== x);
    }
  }
}
function stepTrain(tr, dt) {
  if (offLine(tr)) return;
  const rl = RT.lines[tr.line]; if (!rl) return;
  const line = lineById(tr.line), L = rl.path.len, [s0, s1] = stopPoints(tr), h = trainHalf(tr), T = TIERS[tr.tier];
  const hereId = tr.dir > 0 ? line.a : line.b, st = state.stations[hereId];
  if (tr.st === 'unload') {
    tr.lane += clamp(tr.dir - tr.lane, -0.5 * dt, 0.5 * dt);
    tr.timer -= dt;
    if (tr.timer <= 0) {
      deliver(tr, hereId);
      if (tr.cond <= 0 || (state.depot.auto && tr.cond < 30 && !tr.leased)) { sendToDepot(tr, true); return; }
      tr.st = 'load'; tr.timer = dwellTime(tr, hereId); tr.dwell = tr.timer;
    }
  } else if (tr.st === 'load') {
    tr.lane += clamp(tr.dir - tr.lane, -0.5 * dt, 0.5 * dt);
    const cap = capOf(tr), key = tr.kind === 'P' ? 'pax' : 'cargo';
    const take = Math.min(cap - tr.load, st[key], cap / Math.max(1.2, (tr.dwell || 2.6) * 0.85) * dt);
    if (take > 0) { tr.load += take; st[key] -= take; }
    tr.timer -= dt;
    if (tr.timer <= 0) {
      tr.lane = tr.dir; tr.st = 'run'; tr.leg = 0; tr.legT = 0; tr.v = 0; tr.locoAt = tr.dir; tr.origin = hereId;
      const km = L * UNIT_KM; pay(Math.round(km * T.fuel * (1 + 0.12 * tr.cars)), 'fuel');
      if (tr.cond < 40 && Math.random() < (40 - tr.cond) / 55) tr.breakAt = L * (0.2 + Math.random() * 0.5);
    }
  } else if (tr.st === 'run') {
    if (tr.broken) {
      tr.v = 0; state.rep = Math.max(0, state.rep - 0.01 * dt);
      if (tr.repair > 0) { tr.repair -= dt; if (tr.repair <= 0) { tr.broken = false; tr.cond = Math.max(tr.cond, 60); log(`${tr.name} ซ่อมเสร็จ กลับมาให้บริการ`, 'good'); } }
      return;
    }
    tr.legT += dt;
    if (tr.breakAt && tr.leg >= tr.breakAt) { tr.breakAt = 0; tr.broken = true; tr.v = 0; log(`${tr.name} ขัดข้องกลางทาง! ส่งทีมซ่อมหรือขอเพื่อนช่วยลาก`, 'bad'); toast(`${tr.name} ขัดข้องกลางทาง`); return; }
    const endSid = tr.dir > 0 ? line.b : line.a, end = tr.dir > 0 ? s1 : s0;
    let target = end, blocked = false, holding = false;
    if (tr.plat && tr.plat !== endSid && tr.leg > 4) tr.plat = null;
    if (tr.plat !== endSid) {
      if (tr.dir * (end - tr.s) < 12) requestPlat(tr, endSid);
      const hold = end - tr.dir * 4;
      if (tr.dir * (hold - target) < 0) { target = hold; holding = true; }
    }
    for (const o of state.trains) {
      if (o === tr || o.line !== tr.line || offLine(o)) continue;
      if (o.st === 'run' && o.dir !== tr.dir) continue;
      if (tr.dir * (o.s - tr.s) > 0) { const lim = o.s - tr.dir * (trainHalf(o) + h + 1.5); if (tr.dir * (lim - target) < 0) { target = lim; blocked = true; holding = false; } }
    }
    const dist = tr.dir * (target - tr.s);
    const vAllow = Math.sqrt(2 * 2.6 * Math.max(0, dist));
    tr.v = Math.max(0, Math.min(tr.v + 2.2 * dt, vMax(tr), vAllow));
    let step = Math.min(tr.v * dt, Math.max(0, dist));
    if (!blocked && !holding && dist < 0.25) step = Math.max(0, dist);
    tr.s += tr.dir * step; tr.leg += step;
    tr.blocked = blocked && tr.v < 0.4;
    tr.holding = holding && tr.v < 0.4 && dist < 1;
    if (!blocked && !holding && Math.abs(end - tr.s) < 0.02) {
      tr.s = end; tr.v = 0; tr.st = 'unload'; tr.timer = 1.6; tr.dir = -tr.dir; tr.blocked = tr.holding = false;
      tr.cond = Math.max(0, tr.cond - (T.wear * (0.8 + Math.random() * 0.4)));
      const expected = (L - 2 * h) / TIERS[tr.tier].v + 6;
      tr.late = tr.legT > expected * 1.3 + 4;
      state.stats.legs++; state.week.legs++;
      gainXP(tr.late ? 2 : 3);
      if (!tr.late) { state.stats.onTimeLegs++; state.week.onTime++; state.rep = Math.min(100, state.rep + 0.15); } else state.rep = Math.max(0, state.rep - 0.4);
    }
  }
}
function deliver(tr, atId) {
  const load = tr.load; tr.load = 0;
  if (load < 0.5 || !tr.origin) return;
  const line = lineById(tr.line), km = lineKm(line), T = TIERS[tr.tier];
  let fare = tr.kind === 'P' ? FARE_P * T.fareMul : FARE_C;
  if (tr.kind === 'C' && state.event && state.event.type === 'boom') fare *= 1.5;
  const base = Math.round(load * fare * km), bonus = tr.late ? 0 : Math.round(base * 0.1);
  let share = 0;
  if (tr.leased) { share = Math.round((base + bonus) * 0.3); tr.leased.owed = (tr.leased.owed || 0) + share; }
  earn(base - share, tr.kind === 'P' ? 'pax' : 'cargo');
  if (bonus) earn(bonus, 'bonus');
  if (tr.kind === 'P') state.stats.paxTotal += load; else state.stats.cargoTotal += load;
  const d = SMAP[atId];
  popup(new THREE.Vector3(d.x, 4, d.z), '+' + baht(base + bonus - share) + (bonus ? ' ✓' : ''), false);
  for (const c of state.contracts) {
    if (c.status !== 'active' || c.kind !== tr.kind || c.from !== tr.origin || c.to !== atId) continue;
    c.progress = Math.min(c.amount, c.progress + load);
    if (c.progress >= c.amount) completeContract(c);
  }
  if (typeof coopOnDeliver === 'function') coopOnDeliver(tr.origin, atId, tr.kind, load);
}
function stepStations(dt) {
  const demand = 0.7 + 0.6 * state.rep / 100;
  STATIONS.forEach(d => {
    const st = state.stations[d.id];
    if (!st.unlocked || !stationLines(d.id).length) return;
    const lm = lvlMult(st.level), cap = stationCap(st);
    const fest = state.event && state.event.type === 'fest' && state.event.sid === d.id ? 2 : 1;
    for (const [key, rate] of [['pax', d.pax * fest], ['cargo', d.cargo]]) {
      st[key] += rate * lm * demand * dt;
      if (st[key] > cap) { const lost = st[key] - cap; st[key] = cap; state.rep = Math.max(0, state.rep - lost * 0.0003); }
    }
  });
}
// ---------- depot ----------
function depotCost(tr) { return Math.round((100 - tr.cond) * TIERS[tr.tier].depotRate * DEPOT[state.depot.level].cost / 50) * 50; }
function sendToDepot(tr, auto) {
  if (offLine(tr) || tr.leased) return;
  const cost = depotCost(tr);
  if (auto && state.money < cost && tr.cond > 0) { if (RT.lastDepotWarn !== tr.id) { RT.lastDepotWarn = tr.id; log(`${tr.name} ควรเข้าอู่ แต่เงินไม่พอ (${baht(cost)})`, 'bad'); } return; }
  if (!auto && !spend(cost, 'depot')) return;
  if (auto) pay(cost, 'depot');
  const dur = TIERS[tr.tier].depotT / DEPOT[state.depot.level].speed;
  tr.depot = { wait: true, q: simNow(), t: dur, dur, cost };
  tr.plat = null; tr.broken = false; tr.repair = 0; tr.breakAt = 0; tr.load = 0;
  if (RT.trains[tr.id]) RT.trains[tr.id].group.visible = false;
  log(`${tr.name} เข้าศูนย์ซ่อมบำรุง ${baht(cost)}${auto ? ' (อัตโนมัติ)' : ''}`);
}
function stepDepot(dt) {
  const bays = DEPOT[state.depot.level].bays;
  const inDepot = state.trains.filter(t => t.depot);
  let active = inDepot.filter(t => !t.depot.wait).length;
  inDepot.filter(t => t.depot.wait).sort((a, b) => a.depot.q - b.depot.q).forEach(t => { if (active < bays) { t.depot.wait = false; active++; } });
  for (const t of inDepot) {
    if (t.depot.wait) continue;
    t.depot.t -= dt;
    if (t.depot.t <= 0) { t.depot = null; t.cond = 100; placeOnLine(t); if (RT.trains[t.id]) RT.trains[t.id].group.visible = true; else makeTrain(t); log(`${t.name} ออกจากอู่ สภาพ 100% กลับเข้าประจำสาย`, 'good'); }
  }
  for (const t of state.trains) if (t.rescue) { t.rescue.t -= dt; if (t.rescue.t <= 0) { t.rescue = null; placeOnLine(t); if (RT.trains[t.id]) RT.trains[t.id].group.visible = true; log(`${t.name} กลับจากภารกิจกู้ภัย`, 'good'); } }
}
// ---------- contracts (AI broker) ----------
const repMul = () => 0.8 + state.rep / 100 * 0.6;
function genContracts() {
  state.contracts = state.contracts.filter(c => c.status === 'active' || (c.status === 'offer' && c.expires >= state.day) || (c.status !== 'offer' && c.status !== 'active' && state.day - (c.endDay || 0) < 2));
  let offers = state.contracts.filter(c => c.status === 'offer').length, guard = 0;
  while (offers < 3 && state.lines.length && guard++ < 20) {
    const l = state.lines[Math.floor(Math.random() * state.lines.length)];
    const ab = Math.random() < 0.5, from = ab ? l.a : l.b, to = ab ? l.b : l.a;
    const fd = SMAP[from], kinds = [];
    if (fd.cargo >= 1.5) kinds.push('C');
    if (fd.pax >= 1) kinds.push('P');
    if (!kinds.length) continue;
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const size = (0.6 + state.rep / 100 * 0.9) * (0.7 + Math.random() * 0.6);
    const amount = Math.round((kind === 'P' ? 420 : 260) * size / 10) * 10;
    const cls = contractClass(from, to, lineKm(l));
    const reward = Math.round(amount * (kind === 'P' ? FARE_P : FARE_C) * lineKm(l) * 1.6 * repMul() * CCLASS[cls].mul / 100) * 100;
    state.contracts.push({ id: 'K' + (state.nextId++), cls, kind, from, to, amount, reward, days: 2 + Math.floor(Math.random() * 3), expires: state.day + 2, status: 'offer', progress: 0 });
    offers++;
  }
  RT.contractsDirty = true;
}
function acceptContract(id) {
  const c = state.contracts.find(x => x.id === id); if (!c || c.status !== 'offer') return;
  if (state.contracts.filter(x => x.status === 'active').length >= contractCap()) { toast(`ความจุสัญญาเต็ม (${contractCap()} ฉบับ) เพิ่มได้จากรางวัลเลเวลหรือร้านค้า`); openCapModal(); return; }
  c.status = 'active'; c.deadline = state.day + c.days;
  log(`รับสัญญา: ขน${c.kind === 'P' ? 'ผู้โดยสาร' : 'สินค้า'} ${fmt(c.amount)} ${c.kind === 'P' ? 'คน' : 'ตัน'} ${SMAP[c.from].name} → ${SMAP[c.to].name}`);
  RT.contractsDirty = true;
}
function completeContract(c) {
  c.status = 'done'; c.endDay = state.day; state.stats.contractsDone++;
  gainXP(c.cls === 'X' ? 45 : c.cls === 'R' ? 30 : 20); if (c.cls === 'X') addCoins(3, 'สัญญาข้ามภาค');
  earn(c.reward, 'contract'); state.rep = Math.min(100, state.rep + 4);
  log(`สัญญาสำเร็จ ${SMAP[c.from].name} → ${SMAP[c.to].name} รับ ${baht(c.reward)}`, 'good'); toast(`สัญญาสำเร็จ +${baht(c.reward)}`); sfxCoin();
  RT.contractsDirty = true;
}
// ---------- day / week ----------
const trainDailyCost = tr => TIERS[tr.tier].maint + tr.cars * 250;
const stationDailyCost = (d, st) => (d.type === 'I' ? 1500 : 900) * st.level + 300 * st.plat;
function checkUnlocks() {
  TIER_LIST.forEach(k => {
    if (state.tiers[k] || state.stats.lifetime < TIERS[k].unlock) return;
    state.tiers[k] = true; log(`ปลดล็อก ${TIERS[k].full} แล้ว!`, 'good'); toast(`ปลดล็อกรถ Tier ${TIERS[k].tier}: ${TIERS[k].full}`); RT.staticDirty = true;
  });
}
function rollover() {
  const tc = state.trains.filter(t => !t.leased).reduce((a, t) => a + trainDailyCost(t), 0);
  const sc = STATIONS.reduce((a, d) => a + (state.stations[d.id].unlocked ? stationDailyCost(d, state.stations[d.id]) : 0), 0);
  pay(tc, 'maint'); pay(sc, 'staff');
  state.stats.history.push({ day: state.day, rev: state.stats.revToday, cost: state.stats.costToday });
  if (state.stats.history.length > 30) state.stats.history.shift();
  state.stats.bestDay = Math.max(state.stats.bestDay, state.stats.revToday);
  log(`ปิดวันที่ ${state.day}: รายได้ ${baht(state.stats.revToday)} · ค่าใช้จ่าย ${baht(state.stats.costToday)}`, state.stats.revToday >= state.stats.costToday ? 'good' : 'bad');
  state.day++; state.t -= DAY_LEN; state.stats.revToday = 0; state.stats.costToday = 0;
  for (const c of state.contracts) if (c.status === 'active' && state.day > c.deadline) { c.status = 'failed'; c.endDay = state.day; state.rep = Math.max(0, state.rep - 6); log(`สัญญาหมดเวลา ${SMAP[c.from].name} → ${SMAP[c.to].name} ชื่อเสียงลดลง`, 'bad'); }
  genContracts();
  state.event = null;
  const r = Math.random(), open = STATIONS.filter(d => state.stations[d.id].unlocked && stationLines(d.id).length);
  if (r < 0.18 && open.length) { const s = open[Math.floor(Math.random() * open.length)]; state.event = { type: 'fest', sid: s.id, text: `งานเทศกาลที่${s.name}: ผู้โดยสาร 2 เท่า` }; }
  else if (r < 0.32) state.event = { type: 'boom', text: 'ส่งออกคึกคัก: ค่าขนสินค้า +50%' };
  else if (r < 0.42) state.event = { type: 'rain', text: 'ฝนตกหนัก: ความเร็วขบวนรถ −15%' };
  if (state.event) { log(state.event.text); toast(state.event.text); }
  RT.chartDirty = true;
  if ((state.day - 1) % 7 === 0) { const wk = state.week; state.week = newWeek(wk.n + 1, state.day); showReceipt(wk); }
}
function checkGoals() {
  GOALS.forEach(g => {
    if (state.goals[g.id] || !g.check(state)) return;
    state.goals[g.id] = true; earn(g.reward, 'contract');
    log(`สำเร็จเป้าหมาย: ${g.text} รับ ${baht(g.reward)}`, 'good'); toast(`เป้าหมายสำเร็จ! +${baht(g.reward)}`); RT.goalsDirty = true;
  });
}
function simStep(dt) {
  state.t += dt;
  if (state.t >= DAY_LEN) rollover();
  stepStations(dt);
  for (const tr of state.trains) stepTrain(tr, dt);
  allocPlatforms();
  stepDepot(dt);
  if (typeof coopTick === 'function') coopTick(dt);
}

// ---------- actions ----------
function unlockStation(id) {
  const d = SMAP[id], st = state.stations[id];
  if (st.unlocked || !spend(d.cost)) return;
  st.unlocked = true; makeStation(d); gainXP(40);
  log(`เปิด${d.name} ${baht(d.cost)}`); toast(`เปิด${d.name}แล้ว วางรางเพื่อเชื่อมต่อ`); refreshStatic();
}
const upgradeCost = st => st.level === 1 ? 30000 : 60000;
const platCost = st => 30000 * (st.plat + 1);
function upgradeStation(id) { const st = state.stations[id]; if (st.level >= 3 || !spend(upgradeCost(st))) return; st.level++; makeStation(SMAP[id]); log(`ขยายความจุ${SMAP[id].name} เป็นระดับ ${st.level}`); refreshStatic(); }
function addPlatform(id) { const st = state.stations[id]; if (st.plat >= 3 || !spend(platCost(st))) return; st.plat++; makeStation(SMAP[id]); log(`เพิ่มชานชาลาที่${SMAP[id].name} (รวม ${platformsOf(id)})`); refreshStatic(); }
const loopCost = l => 25000 * ((l.loops || 0) + 1);
function addLoop(lineId) { const l = lineById(lineId); if (!l || (l.loops || 0) >= 2 || !spend(loopCost(l))) return; l.loops = (l.loops || 0) + 1; buildLoops(l); log(`สร้างทางหลีกสาย ${lineName(l)} (รับได้ ${maxTrainsOn(l)} ขบวน)`); refreshStatic(); }
const CAR_PRICE = 9000;
function trainAction(a, tr) {
  if (a === 'follow') { if (offLine(tr)) return; select({ type: 'train', id: tr.id }); cam.follow = tr.id; return; }
  if (a === 'car') { if (tr.cars >= TIERS[tr.tier].maxCars || !spend(CAR_PRICE)) return; tr.cars++; makeTrain(tr); if (offLine(tr)) RT.trains[tr.id].group.visible = false; log(`${tr.name} เพิ่มตู้เป็น ${tr.cars} ตู้`); }
  if (a === 'depot') { sendToDepot(tr, false); }
  if (a === 'repair') { if (!tr.broken || tr.repair > 0 || !spend(6000, 'depot')) return; tr.repair = 4; log(`ส่งทีมซ่อม ${tr.name} ${baht(6000)}`); }
  if (a === 'rescue') { if (typeof coopRequestRescue === 'function') coopRequestRescue(tr); return; }
  if (a === 'lease') { tr.leasable = !tr.leasable; toast(tr.leasable ? `${tr.name} เปิดให้เพื่อนเช่าแล้ว` : `${tr.name} ปิดการให้เช่า`); if (typeof coopPublishFleet === 'function') coopPublishFleet(); }
  if (a === 'sell') {
    if (tr.leased) { toast('รถเช่าขายไม่ได้'); return; }
    const refund = Math.round(TIERS[tr.tier].price * 0.5 + (tr.cars - 2) * CAR_PRICE * 0.5);
    ask(`ขาย ${tr.name}? ได้รับเงินคืน ${baht(refund)}`, () => {
      earn(refund, 'pax'); state.week.inc.pax -= refund; state.stats.lifetime -= refund; state.week.exp.capex -= refund;
      state.trains = state.trains.filter(t => t !== tr); removeTrainMesh(tr.id);
      if (sel && sel.id === tr.id) select(null); if (cam.follow === tr.id) cam.follow = null;
      log(`ขาย ${tr.name} ได้ ${baht(refund)}`); refreshStatic();
    });
    return;
  }
  refreshStatic();
}

// ---------- selection & camera ----------
let sel = null;
function select(s) {
  sel = s;
  if (!s || s.type !== 'train') cam.follow = null;
  if (s) openDrawer(s.type === 'train' ? 'trains' : 'stations');
  document.querySelectorAll('#netPanel .card.sel').forEach(c => c.classList.remove('sel'));
  if (s) { const c = document.querySelector(`#netPanel .card[data-id="${s.id}"]`); if (c) { c.classList.add('sel'); c.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
  RT.tlDirty = true;
}
function resize() {
  const w = stage.clientWidth, h = stage.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false);
  const asp = w / h;
  camera.left = -VIEW * asp / 2; camera.right = VIEW * asp / 2; camera.top = VIEW / 2; camera.bottom = -VIEW / 2;
  camera.updateProjectionMatrix();
  const m2 = $('#map2d'), dpr = Math.min(window.devicePixelRatio || 1, 2);
  m2.width = Math.round(w * dpr); m2.height = Math.round(h * dpr);
  if (typeof fxResize === 'function') fxResize(w, h);
}
function placeCam() {
  const D = 120;
  camera.position.set(cam.tx + Math.cos(cam.az) * D, D * 0.85, cam.tz + Math.sin(cam.az) * D);
  camera.lookAt(cam.tx, 0, cam.tz);
  camera.near = cam.near; camera.far = cam.far;
  camera.zoom = cam.zoom; camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(stage);
const ptrs = new Map(); let moved = 0, pinch = 0, multi = false;
function pan(dx, dy) {
  const k = (camera.top - camera.bottom) / cam.zoom / canvas.clientHeight;
  const sE = 0.648, rx = Math.sin(cam.az), rz = -Math.cos(cam.az), fx = -Math.cos(cam.az), fz = -Math.sin(cam.az);
  cam.tx += -rx * dx * k + fx * dy * k / sE; cam.tz += -rz * dx * k + fz * dy * k / sE;
  cam.tx = clamp(cam.tx, cam.bounds[0], cam.bounds[1]); cam.tz = clamp(cam.tz, cam.bounds[2], cam.bounds[3]);
  cam.follow = null;
  if (!RT.gestureMin) { RT.gestureMin = true; fxMapInteract(); }
}
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) { moved = 0; multi = false; }
  if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); multi = true; }
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (ptrs.size === 1) { moved += Math.abs(dx) + Math.abs(dy); if (moved > 5) pan(dx, dy); }
  else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch > 0) cam.zoom = clamp(cam.zoom * d / pinch, cam.zmin, cam.zmax); pinch = d; if (!RT.gestureMin) { RT.gestureMin = true; fxMapInteract(); } }
});
const endPtr = e => { if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId); if (ptrs.size === 0 && !multi && moved <= 5 && e.type === 'pointerup') pick(e); };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => { e.preventDefault(); cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.0015), cam.zmin, cam.zmax); }, { passive: false });
const ray = new THREE.Raycaster();
function pick(e) {
  if (MODE === 'term') { tPick(e); return; }
  if (MODE === 'stn') { stnPick(e); return; }
  const r = canvas.getBoundingClientRect();
  ray.setFromCamera({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -(e.clientY - r.top) / r.height * 2 + 1 }, camera);
  const tap = bbPick(BB_NET); if (tap) { tap(); return; }
  const hit = ray.intersectObjects(pickables, false).find(h => h.object.userData.pick && h.object.visible && h.object.parent && h.object.parent.visible !== false);
  select(hit ? hit.object.userData.pick : null);
}
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => {
  const a = b.dataset.cam;
  if (MODE === 'net' && MAP2D.on) { if (a === 'in') map2dZoom(1.3); if (a === 'out') map2dZoom(1 / 1.3); if (a === 'home') map2dHome(); return; }
  if (a === 'in') cam.zoom = clamp(cam.zoom * 1.25, cam.zmin, cam.zmax);
  if (a === 'out') cam.zoom = clamp(cam.zoom / 1.25, cam.zmin, cam.zmax);
  if (a === 'rl') cam.azT -= Math.PI / 4;
  if (a === 'rr') cam.azT += Math.PI / 4;
  if (a === 'home') { cam.home(); cam.follow = null; }
}));

// ---------- popups (DOM pooled) ----------
const pops = [];
function popup(pos, text, bad) {
  const el = domPool.get('pop', () => document.createElement('div'));
  el.className = 'pop' + (bad ? ' bad' : ''); el.textContent = text; el.style.opacity = '1';
  $('#popups').appendChild(el); pops.push({ el, pos, t: 0 });
}
const tmpV = new THREE.Vector3();
function updatePops(dt) {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (let i = pops.length - 1; i >= 0; i--) {
    const p = pops[i]; p.t += dt;
    if (p.t > 1.8) { p.el.remove(); domPool.put('pop', p.el); pops.splice(i, 1); continue; }
    if (MODE === 'net' && MAP2D.on) { const q = map2dPt(p.pos.x, p.pos.z); p.el.style.left = q.x + 'px'; p.el.style.top = (q.y - 14 - p.t * 26) + 'px'; }
    else { tmpV.copy(p.pos).project(camera); p.el.style.left = ((tmpV.x + 1) / 2 * w) + 'px'; p.el.style.top = ((1 - tmpV.y) / 2 * h - p.t * 26) + 'px'; }
    p.el.style.opacity = String(Math.min(1, (1.8 - p.t) * 2));
  }
}
function clearPops() { pops.forEach(p => { p.el.remove(); domPool.put('pop', p.el); }); pops.length = 0; }

// ---------- sound (WebAudio, synthesized) ----------
let AC = null;
function audio() { if (!state || !state.sound) return null; try { if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { AC = null; } return AC; }
document.addEventListener('pointerdown', () => { if (state && state.sound && !AC) audio(); }, { once: false, passive: true });
function tick(ac, t, f, dur, vol, type = 'square') { const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02); }
function noiseBurst(ac, t, dur, vol) {
  const len = Math.max(1, Math.floor(ac.sampleRate * dur)), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 1.4; g.gain.value = vol;
  src.connect(bp).connect(g).connect(ac.destination); src.start(t);
}
function sfxCounter(n = 28) {
  const ac = audio(); if (!ac) return;
  const t0 = ac.currentTime + 0.05;
  for (let i = 0; i < n; i++) { const t = t0 + i * 0.034; noiseBurst(ac, t, 0.022, 0.32); tick(ac, t, 95 + (i % 3) * 8, 0.03, 0.08, 'triangle'); }
  const te = t0 + n * 0.034 + 0.12; tick(ac, te, 1318, 0.9, 0.16, 'sine'); tick(ac, te + 0.02, 1760, 0.7, 0.09, 'sine');
}
function sfxCoin() { const ac = audio(); if (!ac) return; const t = ac.currentTime + 0.02; tick(ac, t, 988, 0.12, 0.12, 'square'); tick(ac, t + 0.09, 1318, 0.35, 0.12, 'square'); }
function sfxPing() { const ac = audio(); if (!ac) return; const t = ac.currentTime + 0.02; tick(ac, t, 880, 0.25, 0.1, 'sine'); tick(ac, t + 0.12, 1175, 0.3, 0.08, 'sine'); }

// ---------- 2D network map ----------
const MAP2D = { on: false, box: { x0: -62, x1: 98, z0: -128, z1: 152 }, hit: [], view: { cx: 6, cz: -2, k: 1 } };
function map2dScale() {
  const b = MAP2D.box, w = canvas.clientWidth, h = canvas.clientHeight;
  return Math.min(w / (b.x1 - b.x0), (h - (narrow() ? 150 : 110)) / (b.z1 - b.z0)) * MAP2D.view.k;
}
function map2dPt(x, z) {
  const v = MAP2D.view, sc = map2dScale(), w = canvas.clientWidth, h = canvas.clientHeight;
  return { x: w / 2 + (x - v.cx) * sc, y: (h - (narrow() ? 60 : 40)) / 2 + (z - v.cz) * sc, sc };
}
function map2dUnpt(px, py) {
  const v = MAP2D.view, sc = map2dScale(), w = canvas.clientWidth, h = canvas.clientHeight;
  return { x: v.cx + (px - w / 2) / sc, z: v.cz + (py - (h - (narrow() ? 60 : 40)) / 2) / sc };
}
function map2dZoom(f, px, py) {
  const v = MAP2D.view, w = canvas.clientWidth, h = canvas.clientHeight;
  if (px == null) { px = w / 2; py = (h - (narrow() ? 60 : 40)) / 2; }
  const before = map2dUnpt(px, py);
  v.k = clamp(v.k * f, 0.8, 14);
  const after = map2dUnpt(px, py);
  v.cx += before.x - after.x; v.cz += before.z - after.z; map2dClampView();
}
function map2dClampView() { const v = MAP2D.view, b = MAP2D.box; v.cx = clamp(v.cx, b.x0, b.x1); v.cz = clamp(v.cz, b.z0, b.z1); }
function map2dHome() { Object.assign(MAP2D.view, { cx: 6, cz: -2, k: 1 }); }
let map2dColors = null, map2dTheme = -1;
function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
function offsetLine(g, P, off) {
  const q = P.pts.map(p => map2dPt(p.x, p.z)); g.beginPath();
  for (let i = 0; i < q.length; i++) {
    const a = q[Math.max(0, i - 1)], b = q[Math.min(q.length - 1, i + 1)], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    const x = q[i].x - dy / l * off, y = q[i].y + dx / l * off;
    if (i) g.lineTo(x, y); else g.moveTo(x, y);
  }
}
function drawMap2d(time) {
  const cv = $('#map2d'), g = cv.getContext('2d'), dpr = cv.width / Math.max(1, cv.clientWidth);
  if (map2dTheme !== themeVer || !map2dColors) { map2dTheme = themeVer; map2dColors = { bg: cssVar('--map-bg'), sea: cssVar('--map-sea'), fg: cssVar('--fg'), muted: cssVar('--muted'), line: cssVar('--line'), panel: cssVar('--panel'), yellow: cssVar('--accent'), bad: cssVar('--bad'), nb: cssVar('--map-nb') || cssVar('--panel-2'), rail: cssVar('--map-rail') || cssVar('--muted') }; }
  const C = map2dColors, w = cv.clientWidth, h = cv.clientHeight, sc = map2dScale(), o = map2dPt(0, 0), k = MAP2D.view.k;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = C.sea; g.fillRect(0, 0, w, h);
  // geography in map units
  g.setTransform(dpr * sc, 0, 0, dpr * sc, dpr * o.x, dpr * o.y);
  g.fillStyle = C.nb; GEO_PATHS.nb.forEach(p => g.fill(p));
  g.strokeStyle = C.line; g.lineWidth = 1 / sc; GEO_PATHS.nb.forEach(p => g.stroke(p));
  g.fillStyle = C.bg; g.fill(GEO_PATHS.th);
  g.strokeStyle = C.muted; g.lineWidth = 1.4 / sc; g.stroke(GEO_PATHS.th);
  g.strokeStyle = C.rail; g.lineWidth = 1.6 / sc; g.setLineDash([5 / sc, 3 / sc]); g.stroke(GEO_PATHS.rail); g.setLineDash([]);
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.textAlign = 'center';
  for (const L of GEO_LABELS) {
    const q = map2dPt(L.x, L.z);
    g.fillStyle = C.muted; g.globalAlpha = L.k === 'sea' ? 0.9 : 0.75;
    g.font = `${L.k === 'sea' ? 'italic 500' : '600'} ${L.k === 'sea' ? 12 : 11}px ${cssVar('--f-body')}`; g.fillText(L.t, q.x, q.y);
  }
  g.globalAlpha = 1;
  // player lines follow the real rail corridors; parallel lines are offset so each stays visible
  g.lineCap = 'round'; g.lineJoin = 'round';
  state.lines.forEach((l, i) => {
    const P = RT.lines[l.id] && RT.lines[l.id].path; if (!P) return;
    const off = ((i % 5) - 2) * 3;
    g.strokeStyle = C.panel; g.lineWidth = 7; offsetLine(g, P, off); g.stroke();
    g.strokeStyle = l.color; g.lineWidth = 4.5; offsetLine(g, P, off); g.stroke();
    if (l.loops) { const m = pathAt(P, P.len / 2), q = map2dPt(m.x, m.z); g.fillStyle = C.panel; g.strokeStyle = l.color; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, 5, 0, 7); g.fill(); g.stroke(); }
  });
  MAP2D.hit = [];
  const showAll = k >= 1.8;
  for (const d of STATIONS) {
    const st = state.stations[d.id], q = map2dPt(d.x, d.z), r = st.unlocked ? 7 : 5.5;
    if (q.x < -40 || q.y < -40 || q.x > w + 40 || q.y > h + 40) continue;
    g.lineWidth = 2.2; g.strokeStyle = st.unlocked ? C.fg : C.muted; g.fillStyle = st.unlocked ? C.panel : C.bg;
    g.beginPath();
    if (d.type === 'T') g.rect(q.x - r, q.y - r, r * 2, r * 2);
    else if (d.type === 'J') { g.moveTo(q.x, q.y - r - 2); g.lineTo(q.x + r + 2, q.y); g.lineTo(q.x, q.y + r + 2); g.lineTo(q.x - r - 2, q.y); g.closePath(); }
    else for (let j = 0; j < 6; j++) { const a = Math.PI / 3 * j; g[j ? 'lineTo' : 'moveTo'](q.x + Math.cos(a) * (r + 1), q.y + Math.sin(a) * (r + 1)); }
    g.closePath(); g.fill(); g.stroke();
    if (sel && sel.type === 'station' && sel.id === d.id) { g.strokeStyle = C.yellow; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, r + 7, 0, 7); g.stroke(); }
    const near = d.id === 'LKB' || d.id === 'BPC';
    if (st.unlocked || showAll || (!near && k >= 1.1)) {
      g.textAlign = 'left'; g.fillStyle = st.unlocked ? C.fg : C.muted; g.font = `600 ${st.unlocked ? 12 : 11}px ${cssVar('--f-display')}`;
      g.fillText(d.name, q.x + 11, q.y - 1);
      if (st.unlocked || showAll) { g.font = `500 10px ${cssVar('--f-mono')}`; g.fillStyle = C.muted; g.fillText(st.unlocked ? `${TYPE_SHORT[d.type]} · ${fmt(st.pax)}p · ${fmt(st.cargo)}t` : `ปิด · ฿${fmt(d.cost)}`, q.x + 11, q.y + 11); }
    }
    MAP2D.hit.push({ type: 'station', id: d.id, x: q.x, y: q.y, r: 13 });
  }
  for (const tr of state.trains) {
    if (offLine(tr)) continue;
    const l = lineById(tr.line), P = RT.lines[tr.line] && RT.lines[tr.line].path; if (!P) continue;
    const i = state.lines.indexOf(l), off = ((i % 5) - 2) * 3, p = pathAt(P, tr.s), q0 = map2dPt(p.x, p.z), n = Math.hypot(p.tx, p.tz) || 1;
    const lane = tr.lane * 3.2, q = { x: q0.x - p.tz / n * (off + lane), y: q0.y + p.tx / n * (off + lane) };
    const col = TIERS[tr.tier].color;
    if (tr.holding || tr.blocked) { g.strokeStyle = C.yellow; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 9 + Math.sin(time * 6) * 1.5, 0, 7); g.stroke(); }
    if (tr.broken) { g.strokeStyle = C.bad; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 10 + Math.sin(time * 8) * 2, 0, 7); g.stroke(); }
    g.fillStyle = col; g.strokeStyle = C.panel; g.lineWidth = 2; g.beginPath(); g.arc(q.x, q.y, 6, 0, 7); g.fill(); g.stroke();
    const dir = tr.st === 'run' ? tr.dir : 0;
    if (dir) { const a = Math.atan2(p.tz * dir, p.tx * dir); g.fillStyle = col; g.beginPath(); g.moveTo(q.x + Math.cos(a) * 11, q.y + Math.sin(a) * 11); g.lineTo(q.x + Math.cos(a + 2.5) * 6, q.y + Math.sin(a + 2.5) * 6); g.lineTo(q.x + Math.cos(a - 2.5) * 6, q.y + Math.sin(a - 2.5) * 6); g.fill(); }
    if (sel && sel.type === 'train' && sel.id === tr.id) { g.strokeStyle = C.yellow; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 11, 0, 7); g.stroke(); }
    MAP2D.hit.push({ type: 'train', id: tr.id, x: q.x, y: q.y, r: 10 });
  }
  g.textAlign = 'left'; g.font = `500 11px ${cssVar('--f-body')}`; g.fillStyle = C.muted;
  g.fillText('□ ปลายทาง  ◇ ชุมทาง  ⬡ ICD/ชายแดน  ┅ ทางรถไฟจริง  ● ขบวนรถ · แตะสถานี 2 แห่งเพื่อเปิดเส้นทาง · ลากเพื่อเลื่อน หมุนล้อ/บีบเพื่อซูม', 16, h - (narrow() ? 104 : 92));
  g.font = `500 9.5px ${cssVar('--f-body')}`; g.fillText('แผนที่: Natural Earth 1:10m (พรมแดนและแนวทางรถไฟ)', 16, h - (narrow() ? 90 : 78));
  drawTTTrains(g, C);
  drawPreview2d(g, time);
}
{ // pan / zoom / tap on the 2D map
  const cv = $('#map2d'), pts = new Map(); let moved = 0, pinch = 0;
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; pinch = 0; });
  cv.addEventListener('pointermove', e => {
    const p = pts.get(e.pointerId); if (!p) return;
    if (pts.size === 2) {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), r = cv.getBoundingClientRect();
      if (pinch) map2dZoom(d / pinch, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      pinch = d; moved += 10; return;
    }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
    const sc = map2dScale(); MAP2D.view.cx -= dx / sc; MAP2D.view.cz -= dy / sc; map2dClampView();
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (moved > 6 && !RT.gestureMin) { RT.gestureMin = true; fxMapInteract(); }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return; pts.delete(e.pointerId);
    if (moved > 6 || pts.size) return;
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = MAP2D.hit.slice().reverse().find(hh => Math.hypot(hh.x - x, hh.y - y) < hh.r);
    map2dClick(hit || null);
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', e => pts.delete(e.pointerId));
  cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); map2dZoom(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
}
function setMap2d(on) { MAP2D.on = on; $('#map2d').hidden = !on; RT.toolbarDirty = true; }

// ---------- visuals ----------
let clockT = 0;
function updateVisuals(dt) {
  clockT += dt;
  cam.az += (cam.azT - cam.az) * Math.min(1, dt * 6);
  if (cam.follow) {
    const r = RT.trains[cam.follow];
    if (r && r.group.visible) { const c = r.cars[Math.floor(r.cars.length / 2)].position; cam.tx += (c.x - cam.tx) * Math.min(1, dt * 3); cam.tz += (c.z - cam.tz) * Math.min(1, dt * 3); }
  }
  placeCam();
  for (const tr of state.trains) {
    const r = RT.trains[tr.id], rl = RT.lines[tr.line]; if (!r || !rl) continue;
    if (offLine(tr)) { r.group.visible = false; continue; }
    r.group.visible = true;
    const n = r.cars.length, P = rl.path, fs = tr.locoAt || 1;
    for (let i = 0; i < n; i++) {
      const p = pathAt(P, tr.s + fs * ((n - 1) / 2 - i) * CAR_SP), lat = tr.lane * LANE, c = r.cars[i];
      c.position.set(p.x - p.tz * lat, 0, p.z + p.tx * lat);
      const tail = TIERS[tr.tier].pp && i === n - 1;
      c.rotation.y = Math.atan2(p.tx, p.tz) + (fs < 0 ? Math.PI : 0) + (tail ? Math.PI : 0);
      if (c.userData.conts) { const cap = capOf(tr) || 1, filled = Math.round(tr.load / cap * tr.cars * 2); c.userData.conts.forEach((ct, k) => { ct.visible = (i - 1) * 2 + k < filled; }); }
    }
    const mid = r.cars[Math.floor(n / 2)].position;
    r.warn.visible = tr.broken;
    if (tr.broken) { r.warn.position.set(mid.x, 4 + Math.sin(clockT * 5) * 0.3, mid.z); r.warn.rotation.y = clockT * 2; }
  }
  for (const l of state.lines) {
    const rl = RT.lines[l.id]; if (!rl) continue;
    [0, 1].forEach(end => { const sid = end === 0 ? l.a : l.b, full = state.trains.filter(t => t.plat === sid && !offLine(t)).length >= platformsOf(sid); rl.signals[end].material = full ? M.lampR : M.lampG; });
  }
  STATIONS.forEach(d => {
    const r = RT.stations[d.id], st = state.stations[d.id]; if (!r) return;
    if (r.people) r.people.count = Math.min(30, Math.ceil(st.pax / 10));
    if (r.crates) r.crates.count = Math.min(r.isI ? 36 : 27, Math.ceil(st.cargo / (r.isI ? 8 : 10)));
    if (r.crane) {
      const t = clockT * 0.6 + r.ph;
      if (r.isI) { r.crane.position.z = 3.6 + Math.sin(t * 0.7) * 1.2; if (r.crane.userData.trol) r.crane.userData.trol.position.x = 3.5 + Math.sin(t * 1.3) * 2.2; }
      else { r.crane.position.set(5.7, 0, 3.2 + (Math.sin(t) * 0.5 + 0.5) * 2.6); r.crane.rotation.y = Math.cos(t) > 0 ? Math.PI : 0; }
    }
  });
  vehicles.forEach(v => {
    v.p += v.dir * v.v * dt * Math.min(state.speed, 2);
    if (v.p > v.road.hi - 2) v.p = v.road.lo + 2; if (v.p < v.road.lo + 2) v.p = v.road.hi - 2;
    const off = v.dir * 0.8;
    if (v.road.axis === 'z') { v.g.position.set(v.p, 0.06, v.road.at + off); v.g.rotation.y = v.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else { v.g.position.set(v.road.at - off, 0.06, v.p); v.g.rotation.y = v.dir > 0 ? 0 : Math.PI; }
  });
  if (sel) {
    let x, z, s;
    if (sel.type === 'station') { const d = SMAP[sel.id]; x = d.x; z = d.z; s = 9; }
    else { const r = RT.trains[sel.id], tr = trainById(sel.id); if (r && tr && !offLine(tr)) { const c = r.cars[Math.floor(r.cars.length / 2)].position; x = c.x; z = c.z; s = trainHalf(tr) + 1.5; } }
    if (x !== undefined) { ring.visible = true; ring.position.set(x, 0.45, z); const pulse = 1 + Math.sin(clockT * 3) * 0.04; ring.scale.set(s * pulse, s * pulse, 1); } else ring.visible = false;
  } else ring.visible = false;
  if (RT.labelsDirty) { RT.labelsDirty = false; refreshLabels(); }
  updatePops(dt);
  updateEmotes();
}
