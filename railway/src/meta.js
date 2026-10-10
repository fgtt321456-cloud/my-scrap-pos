// =================== Meta layer: main menu, hub picker, level & rewards, capacity, controllers, planner, fleet ===================
// Player profile (level, coins, capacities, liveries, controllers) lives outside the network save so it survives a network reset.
const META_KEY = 'railtrack-meta-v1';
const LIVERIES = {
  std:      { name: 'มาตรฐาน', body: null },
  royal:    { name: 'ม่วงเฉลิมพระเกียรติ', body: 0xf6f1e4, band: 0x5b2a86, trim: 0xd4a017, coins: 20 },
  heritage: { name: 'แดงครีมคลาสสิก', body: 0xb83a2e, band: 0xf1e6cf, trim: 0x2b313a, coins: 25 },
  ocean:    { name: 'อันดามัน', body: 0xf7f8fa, band: 0x0e7490, trim: 0x22d3ee, coins: 30 },
  gold:     { name: 'ทองคำ', body: 0xe9d8a6, band: 0x13294b, trim: 0xb8860b, coins: 60 },
};
// original vertex colours of the car models → livery role
const LIV_ROLE = { 0xefe3c2: 'body', 0xf7f8fa: 'body', 0xf1e6cf: 'body', 0xf3f5f8: 'body', 0xf0d9b0: 'body', 0xe2772b: 'body', 0x13294b: 'band', 0x8e2b2b: 'band', 0xc62f3c: 'band', 0xf5b400: 'trim', 0xd33b3b: 'trim' };
const TIER_SKIN = {
  THN: { body: '#efe3c2', band: '#13294b', trim: '#f5b400', loco: '#efe3c2' },
  AD24C: { body: '#f1e6cf', band: '#8e2b2b', trim: '#f0d9b0', loco: '#e2772b' },
  ASR: { body: '#f7f8fa', band: '#c62f3c', trim: '#c62f3c', loco: '#f7f8fa' },
  QSY: { body: '#f3f5f8', band: '#13294b', trim: '#d33b3b', loco: '#f3f5f8' },
};
const CCLASS = {
  L: { name: 'ท้องถิ่น', en: 'Local', stars: 1, mul: 1, desc: 'สายสั้นใกล้กรุงเทพ' },
  R: { name: 'ภูมิภาค', en: 'Regional', stars: 2, mul: 1.35, desc: 'สายยาว 220 กม. ขึ้นไป' },
  X: { name: 'ข้ามภาค', en: 'Inter-regional', stars: 3, mul: 1.9, desc: 'ขนส่งไกลถึงเมืองปลายทางภูมิภาค: เชียงใหม่ หนองคาย อุบลราชธานี สุไหงโก-ลก' },
};
// the game map covers Thailand only: the top contract class is long-haul to the regional end-of-line cities
const FAR = { CMI: 'ภาคเหนือ', NKI: 'ภาคอีสานตอนบน', UBN: 'ภาคอีสานตอนล่าง', SGK: 'ภาคใต้ตอนล่าง' };
const REWARDS = [
  { lv: 2, k: 'money', v: 20000 }, { lv: 3, k: 'coins', v: 10 }, { lv: 4, k: 'cap', v: 1 }, { lv: 5, k: 'liv', v: 'royal' },
  { lv: 6, k: 'crew', v: 1 }, { lv: 7, k: 'money', v: 60000 }, { lv: 8, k: 'liv', v: 'heritage' }, { lv: 9, k: 'coins', v: 20 },
  { lv: 10, k: 'cap', v: 1 }, { lv: 11, k: 'crew', v: 1 }, { lv: 12, k: 'liv', v: 'ocean' }, { lv: 13, k: 'money', v: 150000 },
  { lv: 14, k: 'crew', v: 2 }, { lv: 15, k: 'cap', v: 1 }, { lv: 16, k: 'coins', v: 40 }, { lv: 18, k: 'money', v: 300000 }, { lv: 20, k: 'liv', v: 'gold' },
];
const CTRLS = [
  { k: 'app', name: 'ผู้ควบคุมขาเข้า', en: 'Approach', where: 'หัวลำโพง', desc: 'ตั้งเส้นทางรับขบวนเข้าชานชาลาอัตโนมัติ (ARS ขาเข้า) โดยยึดตามแผนชานชาลาก่อน' },
  { k: 'dep', name: 'ผู้ควบคุมขาออก', en: 'Departure', where: 'หัวลำโพง', desc: 'ตั้งเส้นทางออกให้ขบวนที่พร้อมเมื่อถึงเวลา (ARS ขาออก)' },
  { k: 'shunt', name: 'ผู้ควบคุมสับเปลี่ยน', en: 'Shunting', where: 'ทุกสถานี', desc: 'ย้ายห้องขับ push-pull เร็วขึ้น 30% · สับหลีกที่สถานีปลายทางในเครือข่ายใช้เวลาครึ่งเดียว' },
  { k: 'ground', name: 'ผู้ควบคุมภาคพื้น', en: 'Ground', where: 'ทุกสถานี', desc: 'ทำความสะอาด เติมน้ำมัน ขึ้น-ลงผู้โดยสารเร็วขึ้น 25% · เวลาจอดในเครือข่ายลดลง 20%' },
];
const CTRL_MIN = 15, CTRL_COINS = 5, CTRL_BAHT = 30000, CAP_MAX = 8, CREW_MAX = 24;
const HUBS = [
  { id: 'term', mode: 'term', code: 'BKK', name: 'สถานีกรุงเทพ (หัวลำโพง)', sub: 'สถานีปลายตัน 14 ราง · ขบวนธรรมดาและรถชานเมือง' },
  { id: 'cmi', mode: 'stn:CMI', code: 'CMI', name: 'สถานีเชียงใหม่', sub: 'ปลายทางสายเหนือ · อาคารทรงไทยล้านนา · 3 ราง', lock: 2 },
  { id: 'hdy', mode: 'stn:HDY', code: 'HDY', name: 'สถานีชุมทางหาดใหญ่', sub: 'ชุมทางสายใต้ · อาคารโคโลเนียล · 5 ราง', lock: 3 },
  { id: 'nki', mode: 'stn:NKI', code: 'NKI', name: 'สถานีหนองคาย', sub: 'ปลายทางสายอีสาน · ต่อขบวนข้ามสะพานมิตรภาพ', lock: 4 },
  { id: 'ubn', mode: 'stn:UBN', code: 'UBN', name: 'สถานีอุบลราชธานี', sub: 'ปลายทางสายอีสานใต้ · ริมแม่น้ำมูล', lock: 5 },
  { id: 'krt', mode: 'stn:KRT', code: 'KRT', name: 'สถานีกลางกรุงเทพอภิวัฒน์', sub: 'ต้นทางขบวนทางไกลทุกสาย · 26 ชานชาลา', lock: 6 },
  { id: 'net', mode: 'net', code: null, name: 'แผนที่ประเทศไทย', sub: 'บริหารเส้นทาง ขบวนรถ และสัญญาทั่วประเทศ (มุมมอง 2D)' },
];

let META = null;
function metaLoad() {
  let m = null; try { m = JSON.parse(localStorage.getItem(META_KEY)); } catch (e) {}
  m = Object.assign({ v: 1, xp: 0, lv: 1, coins: 25, claimed: {}, cap: 3, crew: 3, hired: 0, liv: { std: true }, ctrl: {}, trial: {}, gift: '', tierCoin: {} }, m || {});
  return m;
}
const M_ = () => META || (META = metaLoad());
function metaSave() { try { localStorage.setItem(META_KEY, JSON.stringify(M_())); } catch (e) {} }
const crewUsed = () => state.trains.filter(t => !t.leased).length;
const crewCap = () => M_().crew;
const crewFree = () => crewUsed() < crewCap();
const contractCap = () => M_().cap;
const ctrlOn = k => !!(META && META.ctrl[k] > Date.now());
const xpNeed = lv => Math.round(60 * Math.pow(lv, 1.45));
const hexc = n => '#' + n.toString(16).padStart(6, '0');
const giftKey = () => new Date().toDateString();
const giftReady = () => M_().gift !== giftKey();
const rwClaimable = () => REWARDS.filter(r => r.lv <= M_().lv && !M_().claimed[r.lv]).length;

function gainXP(n) {
  const m = M_(); m.xp += n; let up = 0;
  while (m.xp >= xpNeed(m.lv)) { m.xp -= xpNeed(m.lv); m.lv++; m.coins += 3; up++; }
  if (up) {
    log(`เลื่อนเป็นเลเวล ${m.lv}! รับ 3 เหรียญทอง`, 'good');
    toast(`เลเวลอัป! Lv ${m.lv} · มีรางวัลรอรับ`); sfxCoin();
    const b = $('#hLvl'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
  }
  metaHud();
}
function addCoins(n, why) { M_().coins += n; metaHud(); if (why) toast(`+${n} เหรียญทอง · ${why}`); }
function spendCoins(n) { const m = M_(); if (m.coins < n) { toast(`เหรียญทองไม่พอ ต้องใช้ ${n} เหรียญ`); return false; } m.coins -= n; metaHud(); return true; }

// ---------- stars ----------
function netStars() {
  const s = state.stats, open = STATIONS.filter(d => state.stations[d.id].unlocked).length;
  return 1 + (M_().lv >= 3) + (s.legs >= 20 && s.onTimeLegs / s.legs >= 0.8) + (open >= 5) + (state.rep >= 70);
}
function termStars() {
  if (!tstate) return 1; const s = tstate.stats;
  return 1 + (s.dep >= 10) + (s.dep >= 10 && s.onTime / s.dep >= 0.8) + (s.dep >= 60) + (s.dep >= 20 && s.holdMin / s.dep < 1.5);
}
const STAR_TIPS = {
  net: [['เลเวลผู้เล่น 3 ขึ้นไป', () => M_().lv >= 3], ['ตรงเวลา 80% (อย่างน้อย 20 เที่ยว)', () => state.stats.legs >= 20 && state.stats.onTimeLegs / state.stats.legs >= 0.8], ['เปิดสถานี 5 แห่ง', () => STATIONS.filter(d => state.stations[d.id].unlocked).length >= 5], ['ชื่อเสียง 70 ขึ้นไป', () => state.rep >= 70]],
  term: [['ปล่อยรถ 10 ขบวน', () => tstate.stats.dep >= 10], ['ออกตรงเวลา 80%', () => tstate.stats.dep >= 10 && tstate.stats.onTime / tstate.stats.dep >= 0.8], ['ปล่อยรถ 60 ขบวน', () => tstate.stats.dep >= 60], ['รอสัญญาณเฉลี่ยไม่ถึง 1.5 นาที', () => tstate.stats.dep >= 20 && tstate.stats.holdMin / tstate.stats.dep < 1.5]],
};
const starRow = n => `<span class="stars" aria-label="${n} ดาว">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;

// ---------- contract classes ----------
const rawClass = (from, to, km) => FAR[from] || FAR[to] ? 'X' : km >= 220 ? 'R' : 'L';
function contractClass(from, to, km) {
  let c = rawClass(from, to, km);
  const s = netStars();
  if (c === 'X' && s < CCLASS.X.stars) c = km >= 220 ? 'R' : 'L';
  if (c === 'R' && s < CCLASS.R.stars) c = 'L';
  return c;
}
function contractClassStrip() {
  const s = netStars();
  return `<span class="cstrip">${Object.keys(CCLASS).map(k => { const C = CCLASS[k], ok = s >= C.stars; return `<span class="ccls c-${k}${ok ? '' : ' off'}" title="${C.desc}">${ok ? '' : '🔒 '}${C.name} ${'★'.repeat(C.stars)}</span>`; }).join('')}</span><br>`;
}

// ---------- train illustration ----------
function skinOf(tier, liv) {
  const s = Object.assign({}, TIER_SKIN[tier]), L = LIVERIES[liv];
  if (L && L.body != null) { s.body = hexc(L.body); s.band = hexc(L.band); s.trim = hexc(L.trim); s.loco = tier === 'AD24C' ? hexc(L.band === 0xf1e6cf ? L.body : L.band) : s.body; }
  return s;
}
function trainSvg(tier, liv, cars, kind) {
  const s = skinOf(tier, liv), n = clamp(cars || 2, 1, 4), T = TIERS[tier], veh = [];
  if (T.pp) { veh.push('cab'); for (let i = 0; i < n; i++) veh.push('car'); veh.push('cabR'); }
  else { veh.push('loco'); for (let i = 0; i < n; i++) veh.push(kind === 'C' ? 'flat' : 'car'); }
  const W = 52, w = veh.length * W + 4, cont = ['#13294b', '#f5b400', '#8a96a8', '#c62f3c', '#2f6bff'];
  const body = veh.map((v, i) => {
    const x = 2 + i * W, wh = `<circle cx="${x + 10}" cy="33" r="3.2"/><circle cx="${x + 40}" cy="33" r="3.2"/>`;
    if (v === 'flat') return `<g><rect x="${x + 1}" y="25" width="48" height="4" rx="1" fill="#7c8693"/><rect x="${x + 3}" y="13" width="21" height="12" rx="1" fill="${cont[i % 5]}"/><rect x="${x + 26}" y="13" width="21" height="12" rx="1" fill="${cont[(i + 2) % 5]}"/><g class="wh">${wh}</g></g>`;
    const col = v === 'loco' ? s.loco : s.body;
    const nose = v === 'cab' ? `M${x + 1} 26 V14 Q${x + 2} 8 ${x + 10} 8 H${x + 49} V26 Z` : v === 'cabR' ? `M${x + 49} 26 V14 Q${x + 48} 8 ${x + 40} 8 H${x + 1} V26 Z` : v === 'loco' ? `M${x + 1} 26 V12 Q${x + 1} 6 ${x + 7} 6 H${x + 49} V26 Z` : `M${x + 1} 26 V10 Q${x + 1} 8 ${x + 3} 8 H${x + 47} Q${x + 49} 8 ${x + 49} 10 V26 Z`;
    const win = v === 'loco' ? `<rect x="${x + 4}" y="9" width="10" height="6" rx="1" fill="#24324a"/>` : v === 'cab' ? `<path d="M${x + 4} 16 Q${x + 4} 11 ${x + 10} 11 H${x + 14} V16Z" fill="#24324a"/><rect x="${x + 17}" y="11" width="29" height="5" rx="1" fill="#24324a"/>` : v === 'cabR' ? `<path d="M${x + 46} 16 Q${x + 46} 11 ${x + 40} 11 H${x + 36} V16Z" fill="#24324a"/><rect x="${x + 4}" y="11" width="29" height="5" rx="1" fill="#24324a"/>` : `<rect x="${x + 4}" y="11" width="42" height="5" rx="1" fill="#24324a"/>`;
    return `<g><path d="${nose}" fill="${col}" stroke="rgba(0,0,0,.18)" stroke-width=".6"/>${win}<rect x="${x + 1}" y="20" width="48" height="3.4" fill="${s.band}"/><rect x="${x + 1}" y="18.4" width="48" height="1.2" fill="${s.trim}"/><g class="wh">${wh}</g></g>`;
  }).join('');
  return `<svg class="tsvg" viewBox="0 0 ${w} 38" aria-hidden="true"><rect x="0" y="35.6" width="${w}" height="1.4" fill="#8f99a6"/>${body}</svg>`;
}
const livSwatch = k => { const L = LIVERIES[k]; if (!L.body) return '<i class="sw std"></i>'; return `<i class="sw" style="background:linear-gradient(180deg,${hexc(L.body)} 0 55%,${hexc(L.trim)} 55% 62%,${hexc(L.band)} 62%)"></i>`; };

// ---------- HUD ----------
let ctrlSig = '';
function metaHud() {
  if (!state) return;
  const m = M_(), need = xpNeed(m.lv);
  $('#hLvlN').textContent = m.lv;
  $('#hXpRing').style.strokeDasharray = `${(97.4 * m.xp / need).toFixed(1)} 97.4`;
  $('#hLvl').title = `เลเวล ${m.lv} · XP ${m.xp}/${need}`;
  $('#hCoinsN').textContent = fmt(m.coins);
  const act = state.contracts.filter(c => c.status === 'active').length;
  $('#hCapN').textContent = `${act}/${m.cap}`; $('#hCap').classList.toggle('full', act >= m.cap);
  $('#hCrewN').textContent = `${crewUsed()}/${m.crew}`; $('#hCrew').classList.toggle('full', crewUsed() >= m.crew);
  const rb = $('#hRwBadge'), n = rwClaimable() + (giftReady() ? 1 : 0); rb.hidden = !n; rb.textContent = n;
}
function metaTick() {
  if (!state) return;
  const m = M_();
  if (tstate) {
    const a = ctrlOn('app'), d = ctrlOn('dep');
    if (tstate.ars.arr !== a || tstate.ars.dep !== d) { tstate.ars.arr = a; tstate.ars.dep = d; if (MODE === 'term') nxUpdate(); }
  }
  const sig = CTRLS.map(c => +ctrlOn(c.k)).join('');
  if (ctrlSig && sig !== ctrlSig) CTRLS.forEach((c, i) => { if (ctrlSig[i] === '1' && sig[i] === '0') toast(`${c.name} หมดเวลาทำงานแล้ว`); });
  ctrlSig = sig;
  setBadge('ctrl', sig.split('1').length - 1, false);
  metaHud();
  if (!$('#mmodal').hidden && MOD.live) MOD.render();
  cdTick();
  if (!$('#hubs').hidden) renderHubs();
  areaHud(); cgTick();
  $('#zoneBar').hidden = MODE !== 'term';
}
['hLvl', 'hCoins', 'hCap', 'hCrew'].forEach(id => $('#' + id).addEventListener('click', () => ({ hLvl: openRewards, hCoins: openShop, hCap: openCapModal, hCrew: openCrewModal })[id]()));
$('#homeBtn').addEventListener('click', () => showHubs());

function cdTick() {
  document.querySelectorAll('[data-until]').forEach(el => { const s = Math.max(0, Math.ceil((+el.dataset.until - Date.now()) / 1000)); el.textContent = `ทำงาน ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; });
}
// ---------- generic modal ----------
const MOD = { kind: null, tab: null, render: null, live: false, cfg: null, draft: null, sel: null, repaint: null };
function modal(kind, render, live) {
  MOD.kind = kind; MOD.render = render; MOD.live = !!live;
  $('#mmodal').hidden = false; $('#mmodal').dataset.kind = kind;
  render();
  if (TUT.active) $('#coach').hidden = true;
}
function closeModal() { MCACHE.k = null; MCACHE.body = null; $('#mmodal').hidden = true; MOD.kind = null; MOD.render = null; MOD.cfg = null; MOD.repaint = null; if (TUT.active) $('#coach').hidden = false; }
const MCACHE = { body: null, tabs: null, foot: null, k: null };
function mSet(title, sub, body, tabs, foot) {
  $('#mTitle').textContent = title; if ($('#mSub').innerHTML !== (sub || '')) $('#mSub').innerHTML = sub || '';
  const k = MOD.kind + ':' + MOD.tab, mb = $('#mBody');
  if (MCACHE.k !== k || MCACHE.body !== body) {
    const same = MCACHE.k === k, st = same ? mb.scrollTop : 0, gs = mb.querySelector('.plan-grid'), gx = same && gs ? gs.scrollLeft : null;
    mb.innerHTML = body; mb.scrollTop = st;
    const g2 = mb.querySelector('.plan-grid'); if (g2 && gx != null) g2.scrollLeft = gx;
    MCACHE.body = body; MCACHE.k = k;
  }
  const tb = tabs ? tabs.map(([t, l]) => `<button data-mtab="${t}" aria-selected="${MOD.tab === t}">${l}</button>`).join('') : '';
  $('#mTabs').hidden = !tabs; if (MCACHE.tabs !== tb) { $('#mTabs').innerHTML = tb; MCACHE.tabs = tb; }
  $('#mFoot').hidden = !foot; if (MCACHE.foot !== (foot || '')) { $('#mFoot').innerHTML = foot || ''; MCACHE.foot = foot || ''; }
  cdTick();
}
$('#mClose').addEventListener('click', closeModal);
$('#mmodal').addEventListener('click', e => { if (e.target.id === 'mmodal') closeModal(); });
$('#mTabs').addEventListener('click', e => { const b = e.target.closest('[data-mtab]'); if (!b) return; MOD.tab = b.dataset.mtab; MOD.cfg = null; MOD.repaint = null; MOD.render(); });

// ---------- rewards / level ----------
function openRewards() { modal('rewards', renderRewards, true); }
function renderRewards() {
  const m = M_(), need = xpNeed(m.lv);
  const nodes = REWARDS.map(r => {
    const got = !!m.claimed[r.lv], ready = !got && m.lv >= r.lv;
    const ic = r.k === 'liv' ? livSwatch(r.v) : { money: '฿', coins: '<i class="coin"></i>', cap: '📄', crew: '👷' }[r.k];
    return `<div class="rw ${got ? 'got' : ready ? 'ready' : 'lock'}"><span class="rw-lv">Lv ${r.lv}</span><span class="rw-ic">${ic}</span><span class="rw-l">${rwLabel(r)}</span>${ready ? `<button class="action" data-claim="${r.lv}">รับ</button>` : got ? '<span class="pill good">รับแล้ว</span>' : '<span class="pill mute">ล็อก</span>'}</div>`;
  }).join('');
  const st = (k, n) => `<div class="starbox"><b>${k === 'net' ? 'เครือข่ายรถไฟไทย' : 'หัวลำโพง'}</b>${starRow(n)}<ul>${STAR_TIPS[k].map(([t, f]) => `<li class="${f() ? 'done' : ''}">${t}</li>`).join('')}</ul></div>`;
  mSet(`เลเวล ${m.lv}`, `XP ${fmt(m.xp)} / ${fmt(need)} · เลื่อนเลเวลรับ 3 เหรียญทอง`,
    `<div class="xpbar"><i style="width:${m.xp / need * 100}%"></i></div>
     <h4 class="msec">เส้นทางรางวัล</h4><div class="rwtrack">${nodes}</div>
     <h4 class="msec">ดาวของแต่ละพื้นที่</h4><p class="info">ดาวปลดล็อกสัญญาระดับภูมิภาค (2★) และข้ามภาค (3★)</p><div class="starboxes">${st('net', netStars())}${tstate ? st('term', termStars()) : ''}</div>
     <h4 class="msec">ได้ XP จาก</h4><p class="info">ขบวนถึงปลายทาง +2 (ตรงเวลา +3) · สัญญาสำเร็จ +20/+30/+45 · เปิดสถานีใหม่ +40 · ปล่อยรถออกจากหัวลำโพง +4 (ตรงเวลา +8) · รับรถเข้าตามแผนชานชาลา +2</p>`);
}
const rwLabel = r => r.k === 'money' ? baht(r.v) : r.k === 'coins' ? `${r.v} เหรียญ` : r.k === 'cap' ? `+${r.v} ความจุสัญญา` : r.k === 'crew' ? `+${r.v} ลูกเรือ` : `ลาย${LIVERIES[r.v].name}`;
function claimReward(lv) {
  const m = M_(), r = REWARDS.find(x => x.lv === lv); if (!r || m.claimed[lv] || m.lv < lv) return;
  m.claimed[lv] = 1;
  if (r.k === 'money') earn(r.v, 'contract');
  else if (r.k === 'coins') m.coins += r.v;
  else if (r.k === 'cap') m.cap = Math.min(CAP_MAX, m.cap + r.v);
  else if (r.k === 'crew') m.crew = Math.min(CREW_MAX, m.crew + r.v);
  else if (r.k === 'liv') m.liv[r.v] = true;
  toast(`รับรางวัล Lv ${lv}: ${rwLabel(r)}`); sfxCoin(); metaHud(); metaSave();
}

// ---------- shop, capacity, crew ----------
function openShop() { MOD.tab = MOD.tab === 'liv' ? 'liv' : 'coins'; modal('shop', renderShop, true); }
function renderShop() {
  const m = M_(), gk = giftReady();
  const tabs = [['coins', 'เหรียญและสิทธิ์'], ['liv', 'ลายรถไฟ']];
  let body = '';
  if (MOD.tab === 'liv') {
    body = `<div class="shopgrid">${Object.keys(LIVERIES).filter(k => k !== 'std').map(k => { const L = LIVERIES[k], own = m.liv[k], rw = REWARDS.find(r => r.k === 'liv' && r.v === k);
      return `<div class="scard">${trainSvg('THN', k, 2, 'P')}<b>${L.name}</b><small>${own ? 'ปลดล็อกแล้ว ใช้ได้กับรถทุกรุ่น' : `หรือรับฟรีที่เลเวล ${rw.lv}`}</small>${own ? '<span class="pill good">มีแล้ว</span>' : `<button class="primary" data-buyliv="${k}"><i class="coin"></i> ${L.coins}</button>`}</div>`; }).join('')}</div>`;
  } else {
    body = `<div class="shopgrid">
      <div class="scard"><span class="sbig">🎁</span><b>ของขวัญรายวัน</b><small>รับ 5 เหรียญทองทุกวัน</small>${gk ? '<button class="action" data-gift>รับเลย</button>' : '<span class="pill mute">พรุ่งนี้มาใหม่</span>'}</div>
      <div class="scard"><span class="sbig">📄</span><b>+1 ความจุสัญญา</b><small>ตอนนี้ ${m.cap}/${CAP_MAX} ฉบับ</small><button class="primary" data-buycap ${m.cap >= CAP_MAX ? 'disabled' : ''}><i class="coin"></i> 30</button></div>
      <div class="scard"><span class="sbig">👷</span><b>+1 ลูกเรือ</b><small>ตอนนี้ ${m.crew} คน</small><button class="primary" data-hirecoin ${m.crew >= CREW_MAX ? 'disabled' : ''}><i class="coin"></i> 15</button></div>
      <div class="scard"><span class="sbig">฿</span><b>แลกเงินทุน</b><small>10 เหรียญ → ${baht(40000)}</small><button class="primary" data-exch><i class="coin"></i> 10</button></div>
      <div class="scard"><span class="sbig">🎛</span><b>ห้องควบคุม</b><small>เปิดผู้ควบคุม ${CTRL_MIN} นาที</small><button class="primary" data-goctrl>ดูผู้ควบคุม</button></div>
    </div><p class="info">เหรียญทองได้จากการเลื่อนเลเวล เส้นทางรางวัล ของขวัญรายวัน สัญญาข้ามภาค และขบวนพิเศษ (ไม่มีการซื้อด้วยเงินจริง)</p>`;
  }
  mSet('ร้านค้า', `<i class="coin"></i> <b class="num">${fmt(m.coins)}</b> เหรียญทอง`, body, tabs);
}
function openCapModal() { modal('cap', renderCap, true); }
function renderCap() {
  const m = M_(), act = state.contracts.filter(c => c.status === 'active');
  const slots = Array.from({ length: CAP_MAX }, (_, i) => `<i class="slot ${i < act.length ? 'used' : i < m.cap ? 'free' : 'lock'}"></i>`).join('');
  mSet('ความจุสัญญา', `ใช้อยู่ ${act.length} จาก ${m.cap} ฉบับ`,
    `<div class="slots">${slots}</div>
     <p class="info">รับสัญญาพร้อมกันได้ไม่เกินความจุ เพิ่มได้จากเส้นทางรางวัล (Lv 4, 10, 15) หรือใช้ 30 เหรียญทองต่อช่อง สูงสุด ${CAP_MAX} ช่อง</p>
     ${act.map(c => `<div class="mrow"><span class="ccls c-${c.cls || 'L'}">${CCLASS[c.cls || 'L'].name}</span><b>${esc(SMAP[c.from].name)} → ${esc(SMAP[c.to].name)}</b><span class="num">${fmt(c.progress)}/${fmt(c.amount)}</span></div>`).join('')}`,
    null, `<div class="acts"><button data-buycap ${m.cap >= CAP_MAX ? 'disabled' : ''}>+1 ช่อง · <i class="coin"></i> 30</button><button class="primary" data-gocontracts>ดูข้อเสนอสัญญา</button></div>`);
}
const crewCost = () => 15000 * (M_().hired + 1);
function openCrewModal() { modal('crew', renderCrew, true); }
function renderCrew() {
  const m = M_(), used = crewUsed();
  const slots = Array.from({ length: Math.max(m.crew, used) }, (_, i) => `<i class="slot ${i < used ? 'used' : 'free'}"></i>`).join('');
  mSet('ลูกเรือขบวนรถ', `ประจำขบวน ${used} จาก ${m.crew} ชุด`,
    `<div class="slots">${slots}</div>
     <p class="info">รถไฟ 1 ขบวนต้องใช้ลูกเรือ 1 ชุด (พนักงานขับ พนักงานรักษารถ พนักงานห้ามล้อ) ซื้อขบวนใหม่ได้เมื่อมีลูกเรือว่าง รถที่เช่าจากเพื่อนมีลูกเรือมาด้วย</p>`,
    null, `<div class="acts"><button data-hirecoin ${m.crew >= CREW_MAX ? 'disabled' : ''}>จ้างด้วย <i class="coin"></i> 15</button><button class="primary" data-hire ${m.crew >= CREW_MAX || state.money < crewCost() ? 'disabled' : ''}>จ้าง 1 ชุด ${baht(crewCost())}</button></div>`);
}

// ---------- controllers (signal box) ----------
function openCtrlModal(focus) { MOD.focus = focus || null; modal('ctrl', renderCtrl, true); }
function renderCtrl() {
  const m = M_();
  const cards = CTRLS.map(c => {
    const on = ctrlOn(c.k), trial = !m.trial[c.k];
    return `<div class="ctrl ${on ? 'on' : ''}${MOD.focus === c.k ? ' focus' : ''}">
      <div class="ctrl-av"><svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="15" r="7"/><path d="M6 38c0-8 6-13 14-13s14 5 14 13"/><path class="hs" d="M12 14a8 8 0 0 1 16 0"/><rect class="hs" x="10" y="13" width="3" height="6" rx="1"/></svg></div>
      <div class="ctrl-tx"><b>${c.name}</b><small>${c.en} · ${c.where}</small><p>${c.desc}</p></div>
      <div class="ctrl-act">${on ? `<span class="pill good" data-until="${m.ctrl[c.k]}">ทำงาน</span><button data-ctrl="${c.k}" data-pay="coin">+${CTRL_MIN} นาที <i class="coin"></i> ${CTRL_COINS}</button>`
        : trial ? `<button class="action" data-ctrl="${c.k}" data-pay="trial">ทดลองฟรี ${CTRL_MIN} นาที</button>`
        : `<button class="primary" data-ctrl="${c.k}" data-pay="coin"><i class="coin"></i> ${CTRL_COINS}</button><button data-ctrl="${c.k}" data-pay="baht">${baht(CTRL_BAHT)}</button>`}</div>
    </div>`;
  }).join('');
  mSet('ห้องควบคุม', 'เปิดผู้ควบคุมเพื่อทำงานอัตโนมัติตามเวลาจริง', `<div class="ctrls">${cards}</div><p class="info">ARS บนแผง NX จะทำงานเมื่อผู้ควบคุมขาเข้า/ขาออกกำลังทำงาน ขบวนที่วางแผนชานชาลาไว้จะได้รับรางที่วางแผนก่อน</p>`);
}
function activateCtrl(k, pay) {
  const m = M_();
  if (pay === 'trial') { if (m.trial[k]) return; m.trial[k] = 1; }
  else if (pay === 'coin') { if (!spendCoins(CTRL_COINS)) return; }
  else if (pay === 'baht') { if (!spend(CTRL_BAHT)) return; }
  m.ctrl[k] = Math.max(Date.now(), m.ctrl[k] || 0) + CTRL_MIN * 60000;
  const c = CTRLS.find(x => x.k === k); toast(`${c.name} เริ่มทำงาน`); sfxPing(); metaTick(); metaSave();
}

// ---------- platform planner (Hua Lamphong) ----------
const PL = { px: 4, rowH: 30, span: 180 };
function openPlanner() {
  MOD.sel = null;
  MOD.draft = {}; if (tstate) tstate.services.forEach(s => { if (s.plan) MOD.draft[s.id] = s.plan; });
  modal('plan', renderPlanner, true);
}
const planWin = () => { const t0 = Math.floor((tstate.now - 15 * 60) / 900) * 900; return [t0, t0 + PL.span * 60]; };
const isPlannable = s => s.phase === 'sched' || s.phase === 'approach' || s.phase === 'held';
function planBlocks() {
  const out = [];
  for (const s of tstate.services) {
    if (s.track && (s.phase === 'entering' || s.phase === 'dwell' || s.phase === 'departing')) out.push({ s, T: s.track, a: s.schedArr, b: Math.max(s.schedDep, tstate.now + 120), real: true });
    else if (isPlannable(s) && MOD.draft[s.id]) out.push({ s, T: MOD.draft[s.id], a: s.schedArr, b: s.schedDep, real: false });
  }
  return out;
}
function planConflict(T, s) {
  if (trainClass(s) > platClass(T)) return { s: { name: `ความยาวชานชาลา (รับถึงขนาด ${CLS[platClass(T)]})` } };
  const a = s.schedArr, b = s.schedDep + 300;
  return planBlocks().find(x => x.T === T && x.s !== s && x.a < b && a < x.b + 300);
}
function renderPlanner() {
  if (!tstate || MODE !== 'term') {
    mSet('แผนชานชาลา', 'หัวลำโพง', `<div class="empty"><p>แผนชานชาลาใช้กับสถานีกรุงเทพ (หัวลำโพง) ซึ่งมี 14 รางปลายตัน</p><div class="acts"><button class="action" data-goterm>ไปหัวลำโพง</button></div></div>`);
    return;
  }
  const [t0, t1] = planWin(), X = t => (t - t0) / 60 * PL.px, W = PL.span * PL.px;
  const blocks = planBlocks();
  let head = ''; for (let t = t0; t <= t1; t += 900) head += `<span style="left:${X(t)}px">${tClock(t)}</span>`;
  const rows = Array.from({ length: 14 }, (_, i) => {
    const T = i + 1, bl = blocks.filter(x => x.T === T).map(x => {
      const l = Math.max(0, X(x.a)), r = Math.min(W, X(x.b)); if (r <= 0 || l >= W) return '';
      const late = !x.real && x.s.phase === 'held';
      return `<button class="pb ${x.s.kind === 'LH' ? 'lh' : 'pp'}${x.real ? ' real' : ''}${MOD.sel === x.s.id ? ' sel' : ''}${late ? ' late' : ''}" ${x.real ? 'disabled' : `data-psel="${x.s.id}"`} style="left:${l}px;width:${Math.max(18, r - l)}px" title="${esc(x.s.name)}">${esc(x.s.name)}</button>`;
    }).join('');
    return `<div class="prow" data-prow="${T}"><span class="plbl">${T}</span><div class="pcells" style="width:${W}px">${bl}</div></div>`;
  }).join('');
  const tray = tstate.services.filter(s => isPlannable(s) && !MOD.draft[s.id]).sort((a, b) => a.schedArr - b.schedArr)
    .map(s => `<button class="pchip ${s.kind === 'LH' ? 'lh' : 'pp'}${MOD.sel === s.id ? ' sel' : ''}" data-psel="${s.id}"><b>${esc(s.name)}</b><small>${tClock(s.schedArr)}–${tClock(s.schedDep)} · ${s.kind === 'LH' ? 'หัวรถจักร' : 'push-pull'}</small></button>`).join('') || '<span class="info">ทุกขบวนมีแผนชานชาลาแล้ว</span>';
  const selS = MOD.sel && tSvc(MOD.sel);
  mSet('แผนชานชาลา · หัวลำโพง', selS ? `เลือก <b>${esc(selS.name)}</b> แล้ว แตะแถวรางที่ต้องการ (แตะอีกครั้งเพื่อเอาออกจากแผน)` : 'แตะขบวนในถาด แล้วแตะแถวรางเพื่อวางแผน · ARS ขาเข้าจะใช้รางตามแผนก่อน',
    `<div class="ptray">${tray}</div>
     <div class="plan-grid"><div class="phead" style="width:${W}px">${head}</div>${rows}<i class="pnow" style="left:${X(tstate.now) + 34}px"></i></div>
     <div class="plegend"><span><i class="lh"></i>หัวรถจักร (ต้องสับหลีก ใช้รางคู่ให้ระวัง)</span><span><i class="pp"></i>push-pull</span><span><i class="real"></i>จอดอยู่จริง</span></div>`,
    null, `<div class="acts"><button class="ghost" data-preset>รีเซ็ต</button><button data-pauto>จัดอัตโนมัติ</button><span class="sp"></span><button class="ghost" data-pdiscard>ยกเลิก</button><button class="action" data-psave>บันทึกแผน</button></div>`);
}
function planPlace(T) {
  const s = MOD.sel && tSvc(MOD.sel); if (!s || !isPlannable(s)) return;
  const c = planConflict(T, s);
  if (c) { toast(`ราง ${T} ใช้ไม่ได้: ${c.s.name}`); return; }
  MOD.draft[s.id] = T; MOD.sel = null;
  const p = planBlocks().find(x => x.T === partnerOf(T) && x.s.kind === 'LH' && x.a < s.schedDep && s.schedArr < x.b);
  if (s.kind === 'LH' && p) toast(`ระวัง: ราง ${partnerOf(T)} (รางคู่) มี ${p.s.name} ที่ต้องสับหลีกช่วงเดียวกัน`);
  renderPlanner();
}
function planAuto() {
  const todo = tstate.services.filter(s => isPlannable(s) && !MOD.draft[s.id]).sort((a, b) => a.schedArr - b.schedArr);
  let n = 0;
  for (const s of todo) {
    const order = Array.from({ length: 14 }, (_, i) => i + 1).map(T => {
      const p = planBlocks().find(x => x.T === partnerOf(T) && x.a < s.schedDep && s.schedArr < x.b);
      return { T, sc: (s.kind === 'LH' ? (p ? (p.s.kind === 'LH' ? 9 : 2) : 0) : (p && p.s.kind === 'LH' ? 1 : 0)) + T * 0.01 };
    }).sort((a, b) => a.sc - b.sc);
    const pick = order.find(o => !planConflict(o.T, s)); if (pick) { MOD.draft[s.id] = pick.T; n++; }
  }
  toast(n ? `จัดแผนให้ ${n} ขบวน` : 'ไม่มีขบวนที่จัดเพิ่มได้'); renderPlanner();
}
function planSave() {
  let n = 0; tstate.services.forEach(s => { if (!isPlannable(s)) return; const v = MOD.draft[s.id] || 0; if ((s.plan || 0) !== v) n++; s.plan = v; });
  toast(n ? `บันทึกแผนชานชาลา (${n} รายการ)${ctrlOn('app') ? '' : ' · เปิดผู้ควบคุมขาเข้าเพื่อให้ ARS ทำตามแผน'}` : 'แผนไม่มีการเปลี่ยนแปลง');
  closeModal();
}

// ---------- fleet: offers / my fleet / configurator ----------
function openFleet(tab) { MOD.tab = tab || (MOD.tab === 'mine' ? 'mine' : 'offers'); MOD.cfg = null; MOD.repaint = null; modal('fleet', renderFleet, true); }
const TIER_COINS = { AD24C: 40, ASR: 80, QSY: 160 };
const linesWithRoom = () => state.lines.filter(l => state.trains.filter(t => t.line === l.id && !offLine(t)).length < maxTrainsOn(l));
function renderFleet() {
  const tabs = [['offers', 'ข้อเสนอ'], ['mine', `ขบวนของฉัน (${state.trains.length})`]];
  const m = M_(), sub = `ลูกเรือ ${crewUsed()}/${m.crew} · ${baht(state.money)}`;
  if (MOD.cfg) return renderConfig(tabs, sub);
  if (MOD.repaint) return renderRepaint(tabs, sub);
  let body;
  if (MOD.tab === 'mine') {
    body = `<div class="fgrid">${state.trains.map(tr => {
      const [label, cls] = trainStatus(tr), l = lineById(tr.line), T = TIERS[tr.tier];
      return `<article class="fcard mine"><div class="fpic">${trainSvg(tr.tier, tr.livery, tr.cars, tr.kind)}</div>
        <header><b>${esc(tr.name)}</b><span class="chip" style="--c:${T.color}">T${T.tier} ${T.name}</span></header>
        <div class="fmeta"><span>${l ? esc(lineName(l)) : '—'}</span><span>${tr.cars} ตู้ · ${tr.kind === 'P' ? 'โดยสาร' : 'สินค้า'}</span><span>${LIVERIES[tr.livery || 'std'].name}</span></div>
        <div class="fcond"><span>สภาพ ${Math.round(tr.cond)}%</span><div class="bar${tr.cond < 35 ? ' low' : ''}"><i style="width:${tr.cond}%"></i></div></div>
        <div class="acts"><span class="pill ${cls}">${label}</span><span class="sp"></span><button data-ffollow="${tr.id}" ${offLine(tr) ? 'disabled' : ''}>ติดตาม</button>${tr.leased ? '' : `<button data-frepaint="${tr.id}">ทาสี</button>`}<button data-fmanage="${tr.id}">จัดการ</button></div></article>`;
    }).join('') || '<p class="info">ยังไม่มีขบวนรถ</p>'}</div>`;
  } else {
    body = `<div class="fgrid">${TIER_LIST.map(k => {
      const T = TIERS[k], un = state.tiers[k], own = state.trains.filter(t => t.tier === k).length, p = clamp(state.stats.lifetime / Math.max(1, T.unlock), 0, 1);
      return `<article class="fcard${un ? '' : ' locked'}"><div class="fpic">${thumbImg(TIER_CONSIST[k]) || trainSvg(k, 'std', 2, T.kinds[0])}</div>
        <header><b>${T.full}</b><span class="chip" style="--c:${T.color}">Tier ${T.tier}</span></header>
        <p class="fdesc">${T.desc}</p>
        <div class="fspec num"><span><small>ราคา</small>${baht(T.price)}</span><span><small>ความเร็ว</small>${Math.round(T.v * 18)} กม./ชม.</span><span><small>ความจุ/ตู้</small>${T.kinds.includes('P') ? T.capP + ' คน' : ''}${T.kinds.length > 1 ? ' · ' : ''}${T.kinds.includes('C') ? T.capC + ' ตัน' : ''}</span><span><small>ค่าดูแล</small>${baht(T.maint)}/วัน</span></div>
        ${un ? `<div class="acts"><span class="pill mute">มีอยู่ ${own} ขบวน</span><span class="sp"></span><button class="action" data-fcfg="${k}">ปรับแต่งและซื้อ</button></div>`
          : `<div class="flock"><span>ปลดล็อกเมื่อรายได้สะสม ${baht(T.unlock)}</span><div class="bar"><i style="width:${p * 100}%"></i></div></div><div class="acts"><span class="sp"></span><button class="primary" data-funlock="${k}">ปลดล็อกทันที <i class="coin"></i> ${TIER_COINS[k]}</button></div>`}
      </article>`;
    }).join('')}</div>`;
  }
  mSet('ฝูงรถ', sub, body, tabs);
}
function renderConfig(tabs, sub) {
  const c = MOD.cfg, T = TIERS[c.tier], m = M_(), lines = linesWithRoom();
  if (!lines.some(l => l.id === c.line)) c.line = lines[0] ? lines[0].id : '';
  const total = T.price + Math.max(0, c.cars - 2) * CAR_PRICE, cap = c.cars * (c.kind === 'P' ? T.capP : T.capC);
  const ok = !!c.line && state.money >= total && crewFree() && m.liv[c.liv];
  const why = !c.line ? 'ไม่มีเส้นทางว่าง: วางรางใหม่หรือสร้างทางหลีก' : !crewFree() ? `ลูกเรือเต็ม (${crewUsed()}/${m.crew})` : state.money < total ? 'เงินทุนไม่พอ' : !m.liv[c.liv] ? 'ลายนี้ยังไม่ปลดล็อก' : '';
  const body = `<button class="back" data-fback>‹ กลับไปข้อเสนอ</button>
    <div class="cfg-pic">${trainSvg(c.tier, c.liv, c.cars, c.kind)}</div>
    <h3 class="cfg-name">${T.full}</h3>
    <div class="cfg">
      <div class="cfg-row"><span>ประเภทบริการ</span><div class="segm">${T.kinds.map(k => `<button data-fkind="${k}" aria-pressed="${c.kind === k}">${k === 'P' ? 'ผู้โดยสาร' : 'สินค้า'}</button>`).join('')}</div></div>
      <div class="cfg-row"><span>จำนวนตู้</span><div class="stepper"><button data-fcars="-1" ${c.cars <= 1 ? 'disabled' : ''} aria-label="ลดตู้">−</button><b class="num">${c.cars}</b><button data-fcars="1" ${c.cars >= T.maxCars ? 'disabled' : ''} aria-label="เพิ่มตู้">+</button></div><small>ตู้ที่ 3 ขึ้นไป ${baht(CAR_PRICE)}/ตู้ · ความจุ ${fmt(cap)} ${c.kind === 'P' ? 'คน' : 'ตัน'}</small></div>
      <div class="cfg-row"><span>ลายรถ</span><div class="livs">${Object.keys(LIVERIES).map(k => `<button class="liv${c.liv === k ? ' on' : ''}${m.liv[k] ? '' : ' locked'}" data-fliv="${k}" title="${LIVERIES[k].name}">${livSwatch(k)}<small>${LIVERIES[k].name}</small></button>`).join('')}</div></div>
      <div class="cfg-row"><span>เส้นทาง</span><select id="cfgLine">${lines.map(l => `<option value="${l.id}" ${l.id === c.line ? 'selected' : ''}>${esc(SMAP[l.a].name)} – ${esc(SMAP[l.b].name)}</option>`).join('') || '<option value="">ไม่มีเส้นทางที่ว่าง</option>'}</select></div>
    </div>`;
  const foot = `<div class="cfg-sum"><span>${baht(T.price)}${c.cars > 2 ? ` + ${c.cars - 2} ตู้` : ''} · ลูกเรือ ${crewUsed()}/${m.crew}</span>${why ? `<small class="bad">${why}</small>` : ''}</div><div class="acts">${m.liv[c.liv] ? '' : `<button data-buyliv="${c.liv}">ปลดล็อกลาย <i class="coin"></i> ${LIVERIES[c.liv].coins}</button>`}${!crewFree() ? '<button data-gocrew>จ้างลูกเรือ</button>' : ''}<button class="action" data-fbuy ${ok ? '' : 'disabled'}>ซื้อ ${baht(total)}</button></div>`;
  mSet('ปรับแต่งขบวนรถ', sub, body, tabs, foot);
}
function renderRepaint(tabs, sub) {
  const tr = trainById(MOD.repaint), m = M_(); if (!tr) { MOD.repaint = null; return renderFleet(); }
  const body = `<button class="back" data-fback>‹ กลับไปขบวนของฉัน</button><div class="cfg-pic">${trainSvg(tr.tier, MOD.rliv, tr.cars, tr.kind)}</div><h3 class="cfg-name">${esc(tr.name)}</h3>
    <div class="livs big">${Object.keys(LIVERIES).map(k => `<button class="liv${MOD.rliv === k ? ' on' : ''}${m.liv[k] ? '' : ' locked'}" data-rliv="${k}">${livSwatch(k)}<small>${LIVERIES[k].name}</small></button>`).join('')}</div>`;
  const same = (tr.livery || 'std') === MOD.rliv;
  const foot = `<div class="acts">${m.liv[MOD.rliv] ? '' : `<button data-buyliv="${MOD.rliv}">ปลดล็อกลาย <i class="coin"></i> ${LIVERIES[MOD.rliv].coins}</button>`}<span class="sp"></span><button class="action" data-rapply ${same || !m.liv[MOD.rliv] || state.money < 5000 ? 'disabled' : ''}>ทาสีใหม่ ${baht(5000)}</button></div>`;
  mSet('ทาสีขบวนรถ', sub, body, tabs, foot);
}
function fleetBuy() {
  const c = MOD.cfg, T = TIERS[c.tier], total = T.price + Math.max(0, c.cars - 2) * CAR_PRICE;
  if (state.money < total) { toast('เงินทุนไม่พอ'); return; }
  const tr = buyTrain(c.line, c.tier, c.kind, false, { cars: c.cars, livery: c.liv });
  if (!tr) return;
  if (c.cars > 2) pay((c.cars - 2) * CAR_PRICE, 'capex');
  sfxCoin(); toast(`${tr.name} ออกวิ่งแล้ว`); refreshStatic();
  MOD.cfg = null; MOD.tab = 'mine'; renderFleet();
}

// ---------- RailPedia / settings ----------
function openPedia() { MOD.tab = ['liv', 'st', 'tt'].includes(MOD.tab) ? MOD.tab : 'tr'; modal('pedia', renderPedia); }
function renderPedia() {
  const m = M_(), tabs = [['tr', 'รถไฟ'], ['liv', 'ลายรถ'], ['st', 'สถานี'], ['tt', 'ตารางเดินรถ']];
  let body = '';
  if (MOD.tab === 'tt') body = Object.keys(TT_LINES).map(k => `<h4 class="msec">${TT_LINES[k]}</h4><div class="board">${TT.filter(t => t.line === k).map(t => `<div class="bd-r"><time>${t.dep}</time><span>${t.cls} ${t.no}</span><span>${ttName(t.from)} → ${ttName(t.to)} · ถึง ${t.arr}${t.note ? ` · ${t.note}` : ''}</span></div>`).join('')}</div>`).join('') + '<p class="info">ขบวนด่วนพิเศษ ด่วน และเร็วส่วนใหญ่ออกจากสถานีกลางกรุงเทพอภิวัฒน์ ส่วนขบวนธรรมดาและรถชานเมืองยังใช้สถานีกรุงเทพ (หัวลำโพง) · ตรวจสอบเวลาจริงได้ที่ SRT D-Ticket หรือโทร 1690</p>';
  else
  if (MOD.tab === 'liv') body = `<div class="pgrid">${Object.keys(LIVERIES).map(k => `<div class="pcard${m.liv[k] ? '' : ' locked'}">${trainSvg('ASR', k, 2, 'P')}<b>${LIVERIES[k].name}</b><small>${m.liv[k] ? 'สะสมแล้ว' : 'ยังไม่ปลดล็อก'}</small></div>`).join('')}</div>`;
  else if (MOD.tab === 'st') body = `<div class="pgrid">${STATIONS.map(d => { const o = state.stations[d.id].unlocked; return `<div class="pcard${o ? '' : ' locked'}"><span class="stype t-${d.type}">${TYPE_SHORT[d.type]}</span><b>${d.name}</b><small>${d.plat} ชานชาลา · ผู้โดยสาร ${'●'.repeat(Math.round(d.pax / 2))} · สินค้า ${'■'.repeat(Math.round(d.cargo / 2))}</small><small>${o ? 'เปิดให้บริการแล้ว' : `เปิดได้ด้วย ${baht(d.cost)}`}</small></div>`; }).join('')}</div>`;
  else body = `<div class="rsgrid">${RS_INFO.map(r => `<div class="rscard">${thumbImg(r.consist)}<div><b>${RS[r.id].name}</b><small>${r.role}${r.tier ? ` · ใช้ในเกมเป็นรถ Tier ${TIERS[r.tier].tier}` : ''}</small><p>${r.note}</p></div></div>`).join('')}</div><p class="info">โมเดลและลายสีอ้างอิงรถที่ การรถไฟแห่งประเทศไทย ใช้งานจริง (ย่อรายละเอียด) · ข้อมูลโดยสรุป อาจคลาดเคลื่อนเล็กน้อย</p>`;
  const got = TIER_LIST.filter(k => state.tiers[k]).length + Object.keys(LIVERIES).filter(k => m.liv[k]).length + STATIONS.filter(d => state.stations[d.id].unlocked).length;
  const all = TIER_LIST.length + Object.keys(LIVERIES).length + STATIONS.length;
  mSet('RailPedia', `สะสมแล้ว ${got}/${all}`, body, tabs);
}
function openSettings() { modal('settings', renderSettings); }
function renderSettings() {
  const th = document.documentElement.getAttribute('data-theme') || 'auto';
  mSet('ตั้งค่า', '', `<div class="cfg">
    <div class="cfg-row"><span>เสียง</span><div class="segm"><button data-sset="sound" aria-pressed="${state.sound}">${state.sound ? 'เปิด' : 'ปิด'}</button></div></div>
    <div class="cfg-row"><span>กราฟิก</span><div class="segm"><button data-sset="q-high" aria-pressed="${FX.quality === 'high'}">สูง</button><button data-sset="q-eco" aria-pressed="${FX.quality !== 'high'}">ประหยัดแบต</button></div></div>
    <div class="cfg-row"><span>ธีม</span><div class="segm">${[['auto', 'ตามระบบ'], ['light', 'สว่าง'], ['dark', 'มืด']].map(([k, l]) => `<button data-sset="th-${k}" aria-pressed="${th === k}">${l}</button>`).join('')}</div></div>
    <div class="cfg-row"><span>วิธีเล่น</span><div class="segm"><button data-sset="tut">ดูวิธีเล่นอีกครั้ง</button></div></div>
  </div>`);
}

// ---------- modal click routing ----------
$('#mmodal').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset, m = M_();
  if (d.claim) { claimReward(+d.claim); renderRewards(); }
  else if ('gift' in d) { if (giftReady()) { m.gift = giftKey(); addCoins(5, 'ของขวัญรายวัน'); sfxCoin(); } MOD.render(); }
  else if ('buycap' in d) { if (m.cap < CAP_MAX && spendCoins(30)) { m.cap++; toast(`ความจุสัญญาเป็น ${m.cap} ฉบับ`); } MOD.render(); }
  else if ('hirecoin' in d) { if (m.crew < CREW_MAX && spendCoins(15)) { m.crew++; toast(`ลูกเรือเพิ่มเป็น ${m.crew} ชุด`); } MOD.render(); }
  else if ('hire' in d) { if (m.crew < CREW_MAX && spend(crewCost())) { m.crew++; m.hired++; log(`จ้างลูกเรือเพิ่ม (รวม ${m.crew} ชุด)`); toast(`ลูกเรือเพิ่มเป็น ${m.crew} ชุด`); } MOD.render(); }
  else if ('exch' in d) { if (spendCoins(10)) { earn(40000, 'contract'); toast(`แลก 10 เหรียญเป็น ${baht(40000)}`); } MOD.render(); }
  else if (d.buyliv) { const L = LIVERIES[d.buyliv]; if (!m.liv[d.buyliv] && spendCoins(L.coins)) { m.liv[d.buyliv] = true; toast(`ปลดล็อกลาย${L.name}`); sfxCoin(); } MOD.render(); }
  else if ('goctrl' in d) openCtrlModal();
  else if ('gocrew' in d) openCrewModal();
  else if ('gocontracts' in d) openContracts('off');
  else if ('goterm' in d) { closeModal(); setMode('term'); openPlanner(); }
  else if (d.ctrl) activateCtrl(d.ctrl, d.pay);
  else if (d.psel) { MOD.sel = MOD.sel === d.psel ? null : d.psel; if (!MOD.sel && MOD.draft[d.psel]) delete MOD.draft[d.psel]; renderPlanner(); }
  else if ('preset' in d) { MOD.draft = {}; MOD.sel = null; renderPlanner(); }
  else if ('pauto' in d) planAuto();
  else if ('pdiscard' in d) closeModal();
  else if ('psave' in d) planSave();
  else if (d.fcfg) { const T = TIERS[d.fcfg], ls = linesWithRoom(); MOD.cfg = { tier: d.fcfg, kind: T.kinds[0], cars: 2, liv: 'std', line: ($('#buyLine') && ls.some(l => l.id === $('#buyLine').value)) ? $('#buyLine').value : (ls[0] ? ls[0].id : '') }; renderFleet(); }
  else if (d.funlock) { const k = d.funlock; if (!state.tiers[k] && spendCoins(TIER_COINS[k])) { state.tiers[k] = true; log(`ปลดล็อก ${TIERS[k].full} ด้วยเหรียญทอง`, 'good'); toast(`ปลดล็อก ${TIERS[k].full}`); RT.staticDirty = true; } renderFleet(); }
  else if ('fback' in d) { MOD.cfg = null; MOD.repaint = null; renderFleet(); }
  else if (d.fkind) { MOD.cfg.kind = d.fkind; renderFleet(); }
  else if (d.fcars) { const T = TIERS[MOD.cfg.tier]; MOD.cfg.cars = clamp(MOD.cfg.cars + +d.fcars, 1, T.maxCars); renderFleet(); }
  else if (d.fliv) { MOD.cfg.liv = d.fliv; renderFleet(); }
  else if ('fbuy' in d) fleetBuy();
  else if (d.ffollow) { const tr = trainById(d.ffollow); closeModal(); if (tr) { if (MODE !== 'net') setMode('net'); if (MAP2D.on) setMap2d(false); trainAction('follow', tr); } }
  else if (d.fmanage) { closeModal(); if (MODE !== 'net') setMode('net'); openDrawer('trains'); select({ type: 'train', id: d.fmanage }); }
  else if (d.frepaint) { const tr = trainById(d.frepaint); MOD.repaint = d.frepaint; MOD.rliv = tr.livery || 'std'; renderFleet(); }
  else if (d.rliv) { MOD.rliv = d.rliv; renderFleet(); }
  else if ('rapply' in d) { const tr = trainById(MOD.repaint); if (tr && spend(5000)) { tr.livery = MOD.rliv; makeTrain(tr); if (offLine(tr)) RT.trains[tr.id].group.visible = false; toast(`${tr.name} ทาสีลาย${LIVERIES[tr.livery].name}แล้ว`); MOD.repaint = null; renderFleet(); } }
  else if (d.sset) {
    const k = d.sset;
    if (k === 'sound') $('#soundBtn').click();
    else if (k === 'q-high' || k === 'q-eco') { fxSetQuality(k.slice(2)); state.quality = k.slice(2); }
    else if (k.startsWith('th-')) { const t = k.slice(3); if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('railtrack-theme', t); } catch (e) {} }
    else if (k === 'tut') { closeModal(); hideMenus(); $('#tutBtn').click(); return; }
    renderSettings();
  }
  metaHud();
});
$('#mmodal').addEventListener('change', e => { if (e.target.id === 'cfgLine' && MOD.cfg) { MOD.cfg.line = e.target.value; renderFleet(); } });
$('#mmodal').addEventListener('click', e => {
  if (MOD.kind !== 'plan' || !MOD.sel) return;
  const row = e.target.closest('[data-prow]'); if (!row || e.target.closest('[data-psel]')) return;
  planPlace(+row.dataset.prow);
});
try { const t = localStorage.getItem('railtrack-theme'); if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t); } catch (e) {}

// ---------- main menu & hub picker ----------
function hideMenus() { $('#menu').hidden = true; $('#hubs').hidden = true; }
function metaBoot() {
  M_(); M_().crew = Math.max(M_().crew, crewUsed()); metaHud();
  if (location.hash === '#rtdebug' || location.hash === '#hualamphong' || location.hash === '#play') { setTimeout(tutStart, 700); return; }
  const sl = $('#menuSleepers'); if (sl && !sl.firstChild) { let s = ''; for (let x = 2; x < 400; x += 9) s += `<path d="M${x} 77v12"/>`; sl.innerHTML = s; }
  $('#menu').hidden = false; $('#menuActs').hidden = true; $('#menuLoad').hidden = false;
  const msgs = ['กำลังเตรียมรางและประแจ…', 'ตรวจสอบอาณัติสัญญาณ…', 'เรียกพนักงานประจำสถานี…'];
  let p = 0; const iv = setInterval(() => {
    p = Math.min(1, p + 0.09 + Math.random() * 0.08); $('#menuBar').style.width = (p * 100) + '%'; $('#menuLoadTxt').textContent = msgs[Math.min(2, Math.floor(p * 3))];
    if (p >= 1) { clearInterval(iv); $('#menuLoad').hidden = true; $('#menuActs').hidden = false; renderMenuProfile(); $('#mPlay').focus(); }
  }, 90);
}
function renderMenuProfile() {
  const m = M_();
  $('#menuProfile').innerHTML = `<span class="mp-lv">Lv <b>${m.lv}</b></span><span class="mp-xp"><i style="width:${m.xp / xpNeed(m.lv) * 100}%"></i></span><span class="mp-c"><i class="coin"></i>${fmt(m.coins)}</span>`;
  $('#mGiftTxt').textContent = giftReady() ? 'รับของขวัญ +5' : 'ของขวัญ (รับแล้ว)';
  $('#mGift').classList.toggle('ready', giftReady());
}
$('#mPlay').addEventListener('click', () => showHubs());
$('#mPedia').addEventListener('click', () => openPedia());
$('#mSettings').addEventListener('click', () => openSettings());
$('#mGift').addEventListener('click', () => { if (giftReady()) { M_().gift = giftKey(); addCoins(5, 'ของขวัญรายวัน'); sfxCoin(); metaSave(); } else toast('รับของขวัญวันนี้ไปแล้ว พรุ่งนี้มาใหม่'); renderMenuProfile(); });
$('#hubsBack').addEventListener('click', () => { $('#hubs').hidden = true; $('#menu').hidden = false; $('#menuLoad').hidden = true; $('#menuActs').hidden = false; renderMenuProfile(); });
function showHubs() { closeModal(); $('#menu').hidden = true; $('#hubs').hidden = false; renderHubs(); }
function hubWeather(mode) {
  const h = mode === 'stn' && stnState() ? stnState().now / 3600 % 24 : mode === 'term' ? (tstate ? tstate.now / 3600 % 24 : 7) : state.t / DAY_LEN * 24;
  const rain = mode === 'net' && state.event && state.event.type === 'rain', night = h < 6 || h >= 18.5;
  const ic = rain ? '<path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6z"/><path d="M8 18l-1 2M12 18l-1 2M16 18l-1 2"/>' : night ? '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>' : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6 19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>';
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  return `<span class="wx"><svg viewBox="0 0 24 24" aria-hidden="true">${ic}</svg>${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}${rain ? ' ฝนตก' : ''}</span>`;
}
let hubSig = '', hubSel = 'term';
function hubBoard(h) {
  if (h.id === 'term') {
    const list = tstate ? tstate.services.filter(s => ['sched', 'approach', 'held', 'dwell'].includes(s.phase)).sort((a, b) => a.schedArr - b.schedArr).slice(0, 6) : [];
    return `<div class="board"><div class="bd-h"><b>ขบวนเข้า-ออกในกะนี้</b><small>จำลองตามรูปแบบขบวนธรรมดา/ชานเมือง</small></div>${list.map(s => `<div class="bd-r"><time>${tClock(s.phase === 'dwell' ? s.schedDep : s.schedArr)}</time><span>${s.phase === 'dwell' ? esc(s.outName) : esc(s.name)}</span><span>${s.phase === 'dwell' ? 'ออก' : 'เข้า'} · ${esc(String(s.from))}</span></div>`).join('') || '<p class="info">เข้าเล่นเพื่อเริ่มกะ</p>'}</div>`;
  }
  if (!h.code) return '';
  const b = ttBoard(h.code);
  if (!b.length) return '';
  return `<div class="board"><div class="bd-h"><b>ตารางเดินรถจริง</b><small>ข้อมูลจากคู่มือการเดินรถ รฟท.</small></div>${b.map(r => `<div class="bd-r ${r.kind}"><time>${r.t}</time><span>${r.tr.cls} ${r.tr.no}</span><span>${r.kind === 'dep' ? 'ไป' : 'จาก'} ${ttName(r.other)}${r.tr.note ? ` · ${r.tr.note}` : ''}</span></div>`).join('')}</div>`;
}
function renderHubs() {
  const m = M_();
  $('#hubsSub').innerHTML = `เลือกสถานีที่จะบริหาร · Lv ${m.lv} · <i class="coin"></i> ${fmt(m.coins)} · ${baht(state.money)}`;
  const open = STATIONS.filter(d => state.stations[d.id].unlocked).length;
  const card = h => {
    const locked = !!h.lock && m.lv < h.lock && !(m.su && m.su[h.code]), on = hubSel === h.id;
    let stars = 1, stats = '';
    if (h.mode === 'net') { stars = netStars(); stats = `<span>สถานี ${open}/${STATIONS.length}</span><span>เส้นทาง ${state.lines.length}</span><span>ขบวน ${state.trains.length}</span>`; }
    else if (h.mode && h.mode.startsWith('stn:')) { stars = stnStars(h.code); const S = STN.st[h.code], dd = STN_DEFS[h.code]; stats = `<span>${dd.tracks.filter(t => hasPlat(dd, t)).length} ราง</span><span>${dd.kind === 'T' ? 'ปลายทาง' : 'สถานีผ่าน'}</span><span>ปล่อยรถ ${S ? S.stats.dep : 0}</span>`; }
    else if (h.mode === 'term') { stars = termStars(); stats = `<span>14 ราง</span><span>ปล่อยรถ ${tstate ? tstate.stats.dep : 0}</span><span>${tstate && tstate.stats.dep ? Math.round(tstate.stats.onTime / tstate.stats.dep * 100) : 0}% ตรงเวลา</span>`; }
    const n = h.code ? ttBoard(h.code).length : 0;
    return `<div class="hub${locked ? ' locked' : ''}${MODE === h.mode ? ' cur' : ''}${on ? ' on' : ''}${h.mode === 'net' ? ' netcard' : ''}" data-hsel="${h.id}" role="button" tabindex="0">
      <span class="hub-top"><b>${h.name}</b>${locked ? `<span class="pill mute">🔒 Lv ${h.lock}</span>` : starRow(stars)}</span>
      <span class="hub-sub">${h.sub}</span>
      ${locked ? `<span class="hub-st"><span>ปลดล็อกเมื่อถึงเลเวล ${h.lock}</span>${n ? `<span>ขบวนจริง ${n} รายการ</span>` : ''}</span><span class="hub-ft"><span></span><button class="go alt" data-hunlock="${h.code}">ปลดล็อกทันที <i class="coin"></i> 20</button></span>`
        : `<span class="hub-st">${stats}</span><span class="hub-ft"><span class="wxw" data-wx="${h.mode && h.mode.startsWith('stn:') ? 'term' : h.mode}"></span><button class="go" data-hub="${h.mode}">${(MODE === h.mode || (MODE === 'stn' && h.mode === 'stn:' + STN.cur)) ? 'เล่นต่อ' : h.mode === 'net' ? 'เปิดแผนที่' : 'เข้าบริหาร'} ›</button></span>`}
      ${on ? hubBoard(h) : ''}
    </div>`;
  };
  const sig = HUBS.map(card).join('');
  if (sig !== hubSig) { hubSig = sig; $('#hubsList').innerHTML = sig; }
  document.querySelectorAll('#hubsList [data-wx]').forEach(el => { el.innerHTML = hubWeather(el.dataset.wx); });
  const svg = $('#hubsMap'), key = state.lines.length + ':' + open + ':' + hubSel;
  if (svg.dataset.k !== key) {
    svg.dataset.k = key;
    const rail = GEO.re.map(([a, b]) => `M${GEO.rn[a][0]} ${GEO.rn[a][1]}L${GEO.rn[b][0]} ${GEO.rn[b][1]}`).join('');
    const pin = h => { const [x, z] = GEO.st[h.code]; const lab = h.name.replace('สถานี', ''); const left = h.id === 'krt';
      return `<g class="hubpin${h.lock ? ' locked' : ''}${hubSel === h.id ? ' on' : ''}" data-hsel="${h.id}" transform="translate(${x},${z})"><circle r="${hubSel === h.id ? 7 : 5}" class="halo"/><circle r="2.2" class="dot"/><text x="${left ? -8 : 8}" y="${h.id === 'krt' ? -4 : 3}" text-anchor="${left ? 'end' : 'start'}">${lab}</text></g>`; };
    svg.innerHTML = Object.values(GEO.nb).map(r => `<path class="nb" d="${geoSvg(r)}"/>`).join('') + `<path class="land" d="${geoSvg(GEO.th)}"/><path class="rail" d="${rail}"/>`
      + state.lines.map(l => { const P = RT.lines[l.id] && RT.lines[l.id].path; return P ? `<path class="ln" stroke="${l.color}" d="M${P.pts.map(p => p.x.toFixed(1) + ' ' + p.z.toFixed(1)).join('L')}"/>` : ''; }).join('')
      + HUBS.filter(h => h.code).map(pin).join('')
      + GEO_LABELS.map(L => `<text class="glbl ${L.k}" x="${L.x.toFixed(1)}" y="${L.z.toFixed(1)}">${L.t}</text>`).join('');
  }
}
$('#hubsList').addEventListener('click', e => {
  const g = e.target.closest('[data-hub]'); if (g) { metaPick(g.dataset.hub); return; }
  const u = e.target.closest('[data-hunlock]'); if (u) { const mm = M_(); if (spendCoins(20)) { mm.su = mm.su || {}; mm.su[u.dataset.hunlock] = 1; metaSave(); hubSig = ''; toast('ปลดล็อกสถานีแล้ว'); sfxCoin(); renderHubs(); } return; }
  const c = e.target.closest('[data-hsel]'); if (c) { hubSel = c.dataset.hsel; renderHubs(); }
});
$('#hubsMap').addEventListener('click', e => { const c = e.target.closest('[data-hsel]'); if (c) { hubSel = c.dataset.hsel; renderHubs(); const el = document.querySelector(`#hubsList [data-hsel="${hubSel}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } });
function metaPick(mode) {
  hideMenus();
  if (mode.startsWith('stn:')) { stnEnter(mode.slice(4)); return; }
  if (MODE !== mode) setMode(mode);
  if (mode === 'term' && !TUT.active) setTimeout(tutStart, 500);
}

// ---------- toolbar entries ----------
Object.assign(ICONS, {
  fleet: '<rect x="3" y="6" width="12" height="10" rx="2"/><path d="M15 9h4l2 3v4h-6M3 12h12"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
  plan: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 4v16"/><path d="M11 13h5M11 16h3"/>',
  ctrl: '<path d="M4 20h16M6 20V10h12v10"/><path d="M8 10V6h8v4M10 14h4"/><circle cx="12" cy="3" r="1"/>',
});
TOOLS.net.splice(TOOLS.net.findIndex(t => t[0] === 'map'), 1);
TOOLS.net.splice(TOOLS.net.findIndex(t => t[0] === 'trains') + 1, 0, ['fleet', 'ฝูงรถ']);
TOOLS.net.splice(TOOLS.net.findIndex(t => t[0] === 'depot') + 1, 0, ['ctrl', 'ห้องควบคุม']);
TOOLS.term.splice(TOOLS.term.findIndex(t => t[0] === 'tsvc') + 1, 0, ['plan', 'แผนชานชาลา'], ['ctrl', 'ห้องควบคุม']);
window.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#mmodal').hidden) closeModal(); });

// ---------- ground-service hangar (Hua Lamphong) ----------
const GS = {
  staff:  { name: 'พนักงานชานชาลา', en: 'Boarding', start: 4, price: 12000, max: 30, ic: 'staff', desc: 'ส่งลงและรับขึ้นผู้โดยสาร ทุกขบวนต้องใช้ 2 รอบ' },
  parcel: { name: 'รถลากพัสดุ', en: 'Parcel', start: 1, price: 15000, max: 20, ic: 'cart', desc: 'ขนพัสดุและสัมภาระของขบวนทางไกล' },
  crew:   { name: 'ทีมทำความสะอาด', en: 'Cleaning', start: 3, price: 20000, max: 30, ic: 'van', desc: 'ทำความสะอาดตู้โดยสารหลังส่งผู้โดยสารลง' },
  cater:  { name: 'รถเสบียง', en: 'Catering', start: 1, price: 22000, max: 20, ic: 'box', desc: 'ขึ้นเสบียงตู้เสบียงขบวนด่วนและด่วนพิเศษ' },
  truck:  { name: 'รถเติมน้ำมัน', en: 'Fuel', start: 2, price: 35000, max: 20, ic: 'tank', desc: 'เติมน้ำมันหัวรถจักรและดีเซลราง' },
  lav:    { name: 'รถดูดสิ่งปฏิกูล', en: 'Lavatory', start: 1, price: 15000, max: 20, ic: 'tank2', desc: 'ดูดถังสุขาของขบวนทางไกล' },
  water:  { name: 'รถเติมน้ำ', en: 'Water', start: 2, price: 15000, max: 20, ic: 'tank3', desc: 'เติมน้ำใช้ในตู้โดยสาร ทุกขบวน' },
  lift:   { name: 'ลิฟต์วีลแชร์', en: 'Ambulift', start: 1, price: 30000, max: 10, ic: 'lift', desc: 'ช่วยผู้โดยสารวีลแชร์ขึ้นรถก่อนเริ่มรับขึ้น (ราว 1 ใน 4 ขบวน)' },
  repair: { name: 'ทีมช่างซ่อมด่วน', en: 'Repair', start: 1, price: 20000, max: 10, ic: 'van2', desc: 'แก้ไขข้อขัดข้องที่พบระหว่างจอด (ราว 1 ใน 8 ขบวน)' },
};
function gsIcon(ic) {
  const W = '#F4F1E8', N = '#1B355E', Y = '#FFC20E', D = '#2b313a';
  const wheels = xs => xs.map(x => `<circle cx="${x}" cy="31" r="3.6" fill="${D}"/>`).join('');
  const cab = x => `<path d="M${x} 29V14q0-3 3-3h9l5 8v10z" fill="${W}" stroke="${N}" stroke-width="1"/><path d="M${x + 4} 14h7l3 5h-10z" fill="#24324a"/>`;
  const body = {
    staff: `<circle cx="32" cy="9" r="5" fill="${N}"/><path d="M22 34v-10q0-8 10-8t10 8v10z" fill="${N}"/><path d="M27 17l5 9 5-9" fill="${Y}"/>`,
    cart: `<rect x="4" y="14" width="14" height="13" rx="2" fill="${Y}"/><rect x="24" y="12" width="36" height="15" rx="1" fill="${W}" stroke="${N}"/><path d="M18 24h6" stroke="${D}" stroke-width="2"/>${wheels([10, 30, 52])}`,
    van: `<path d="M6 29V12q0-4 4-4h34l12 10v11z" fill="${W}" stroke="${N}"/><path d="M42 11h4l8 7h-12z" fill="#24324a"/><rect x="6" y="20" width="50" height="3" fill="${N}"/>${wheels([16, 46])}`,
    van2: `<path d="M6 29V12q0-4 4-4h34l12 10v11z" fill="${W}" stroke="${N}"/><path d="M42 11h4l8 7h-12z" fill="#24324a"/><rect x="6" y="20" width="50" height="3" fill="#C9353A"/><path d="M18 11h8v4h-8z" fill="${Y}"/>${wheels([16, 46])}`,
    box: `<rect x="4" y="6" width="36" height="22" rx="1" fill="${W}" stroke="${N}"/><rect x="4" y="18" width="36" height="3" fill="${Y}"/>${cab(41)}${wheels([12, 30, 50])}`,
    tank: `<rect x="4" y="11" width="36" height="16" rx="8" fill="${W}" stroke="${N}"/><rect x="4" y="18" width="36" height="3" fill="#E2772B"/>${cab(41)}${wheels([12, 30, 50])}`,
    tank2: `<rect x="4" y="11" width="36" height="16" rx="8" fill="${W}" stroke="${N}"/><rect x="4" y="18" width="36" height="3" fill="#6B7A90"/>${cab(41)}${wheels([12, 30, 50])}`,
    tank3: `<rect x="4" y="11" width="36" height="16" rx="8" fill="${W}" stroke="${N}"/><rect x="4" y="18" width="36" height="3" fill="#3A7BD5"/>${cab(41)}${wheels([12, 30, 50])}`,
    lift: `<rect x="6" y="2" width="32" height="14" rx="1" fill="${W}" stroke="${N}"/><path d="M10 16l8 10M34 16l-8 10M10 26l8-10M34 26l-8-10" stroke="${N}" stroke-width="1.5"/><rect x="4" y="25" width="38" height="3" fill="${N}"/>${cab(41)}${wheels([12, 30, 50])}`,
  }[ic];
  return `<svg class="gsic" viewBox="0 0 64 36" aria-hidden="true">${body}</svg>`;
}
const gsBusy = k => (TRT.busy && TRT.busy[k]) || 0;
function openGS(k) { MOD.gsSel = k || MOD.gsSel || 'staff'; MOD.gsQty = 1; modal('gs', renderGS, true); }
function renderGS() {
  if (!tstate) { mSet('โรงรถบริการ', '', '<p class="info">ยังไม่มีข้อมูลสถานี</p>'); return; }
  const res = tstate.res, k = MOD.gsSel, G = GS[k], have = res[k] != null ? res[k] : G.start;
  MOD.gsQty = clamp(MOD.gsQty, 1, Math.max(1, G.max - have));
  const cost = G.price * MOD.gsQty, full = have >= G.max;
  const queued = tstate.services.reduce((a, s) => a + (s.phase === 'dwell' && s.tasks ? Object.values(s.tasks).filter(t => t.res === k && t.st === 'queue').length : 0), 0);
  const list = Object.keys(GS).map(id => { const g = GS[id], h = res[id] != null ? res[id] : g.start, b = gsBusy(id);
    return `<button class="gsrow${id === k ? ' on' : ''}" data-gs="${id}"><div class="gs-tx"><b>${g.name}</b><small>${g.en}</small><dl><dt>ว่าง</dt><dd class="num">${h - b}</dd><dt>มีทั้งหมด</dt><dd class="num">${h}/${g.max}</dd><dt>ราคา</dt><dd class="num">${baht(g.price)}</dd></dl></div>${gsIcon(g.ic)}</button>`; }).join('');
  const detail = `<div class="gsdet"><header>${gsIcon(G.ic)}<div><b>${G.name}</b><small>${G.desc}</small></div></header>
    <div class="gs-st"><div><span>ว่าง</span><b class="num good">${have - gsBusy(k)}</b></div><div><span>กำลังทำงาน</span><b class="num">${gsBusy(k)}</b></div><div><span>รอคิว</span><b class="num${queued ? ' bad' : ''}">${queued}</b></div><div><span>ซื้อแล้ว</span><b class="num">${have}/${G.max}</b></div></div>
    <div class="stepper big"><button data-gsq="-1" ${MOD.gsQty <= 1 ? 'disabled' : ''} aria-label="ลดจำนวน">−</button><div><small>จำนวน</small><b class="num">${MOD.gsQty}</b></div><button data-gsq="1" ${full || have + MOD.gsQty >= G.max ? 'disabled' : ''} aria-label="เพิ่มจำนวน">+</button></div>
    <div class="gs-cost num">${baht(cost)}</div>
    <button class="btn action big" data-gsbuy ${full || state.money < cost ? 'disabled' : ''}>${full ? 'ครบจำนวนสูงสุดแล้ว' : 'ซื้อ'}</button></div>`;
  mSet('โรงรถบริการ · หัวลำโพง', `ทีมและรถบริการที่ใช้กลับขบวนระหว่างจอด · ${baht(state.money)}`, `<div class="gswrap">${detail}<div class="gslist">${list}</div></div>`);
}
$('#mmodal').addEventListener('click', e => {
  if (MOD.kind !== 'gs') return;
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.gs) { MOD.gsSel = b.dataset.gs; MOD.gsQty = 1; renderGS(); }
  else if (b.dataset.gsq) { MOD.gsQty += +b.dataset.gsq; renderGS(); }
  else if ('gsbuy' in b.dataset) {
    const k = MOD.gsSel, G = GS[k], n = MOD.gsQty;
    if (spend(G.price * n)) { tstate.res[k] = (tstate.res[k] != null ? tstate.res[k] : G.start) + n; tlog(`ซื้อ${G.name}เพิ่ม ${n} (รวม ${tstate.res[k]})`); toast(`${G.name} เพิ่มเป็น ${tstate.res[k]}`); sfxCoin(); MOD.gsQty = 1; renderGS(); }
  }
});

// ---------- contract offers screen ----------
const CG_COOL = 90;   // วินาทีจริงก่อนสร้างข้อเสนอใบถัดไปฟรี
const CG_CARDS = [
  { k: 'L', title: 'สัญญาท้องถิ่น', btn: 'สร้างข้อเสนอ' },
  { k: 'R', title: 'สัญญาภูมิภาค', btn: 'สร้างข้อเสนอ' },
  { k: 'X', title: 'สัญญาข้ามภาค', btn: 'สร้างข้อเสนอ' },
  { k: 'SP', title: 'ขบวนพิเศษ', btn: 'ค้นหาขบวน', desc: 'ขบวนจากผู้เล่นอื่นหรือขบวนเช่าเหมา เข้าหัวลำโพง รายได้ 2 เท่า' },
  { k: 'MAP', title: 'สัญญาบนแผนที่', btn: 'ค้นหา', desc: 'งานไปยังสถานีที่ยังไม่มีรางตรง ต้องวางรางใหม่ในประเทศไทย' },
];
const CHARTER = [['หัวหิน', 'รถไฟท่องเที่ยวชายทะเล'], ['กาญจนบุรี', 'รถไฟนำเที่ยวน้ำตก'], ['อยุธยา', 'รถจักรไอน้ำนำเที่ยว'], ['ลพบุรี', 'ขบวนเช่าเหมาคณะทัวร์'], ['นครปฐม', 'ขบวนพิเศษงานเทศกาล']];
const cgLeft = k => Math.max(0, Math.ceil((((M_().cg || {})[k] || 0) + CG_COOL * 1000 - Date.now()) / 1000));
function openContracts(tab) { MOD.tab = tab || (MOD.tab === 'act' ? 'act' : 'off'); modal('cg', renderContractsModal, true); }
function cgIcon(k) {
  if (k === 'SP') return `<svg viewBox="0 0 80 64" aria-hidden="true"><path d="M14 52V22q0-12 14-12h24q14 0 14 12v30z" fill="#F4F1E8"/><rect x="20" y="18" width="40" height="14" rx="3" fill="#24324a"/><rect x="14" y="38" width="52" height="4" fill="#FFC20E"/><circle cx="26" cy="46" r="3" fill="#FFF6D8"/><circle cx="54" cy="46" r="3" fill="#FFF6D8"/><path d="M8 58h64" stroke="#8f99a6" stroke-width="3"/></svg>`;
  if (k === 'MAP') return `<svg viewBox="0 0 80 64" aria-hidden="true"><circle cx="40" cy="32" r="27" fill="#13294B" stroke="#4FD1A5" stroke-width="2.5"/><path d="M40 5v54M13 32h54" stroke="#4FD1A5" stroke-opacity=".5"/><circle cx="40" cy="32" r="16" fill="none" stroke="#4FD1A5" stroke-opacity=".5"/><path d="M33 12l12 2 8 10 3 8-6 2-4 6 1 10-4 6-2-12-6-8z" fill="#4FD1A5"/><path d="M40 32 L62 18" stroke="#4FD1A5" stroke-width="2"/></svg>`;
  return `<svg viewBox="0 0 80 64" aria-hidden="true"><path d="M22 6h30l10 10v42H22z" fill="#F4F1E8"/><path d="M52 6v10h10" fill="#D9DFE8"/><rect x="30" y="16" width="16" height="12" rx="3" fill="#1B355E"/><rect x="32" y="18" width="12" height="4" fill="#24324a" stroke="#F4F1E8" stroke-width=".6"/><path d="M30 34h24M30 40h24M30 46h16" stroke="#8f99a6" stroke-width="2"/><path d="M58 30l8-8 4 4-8 8-6 2z" fill="#FFC20E"/></svg>`;
}
function renderContractsModal() {
  const s = netStars(), m = M_(), act = state.contracts.filter(c => c.status === 'active').length;
  const tabs = [['off', `ข้อเสนอ (${state.contracts.filter(c => c.status === 'offer').length})`], ['act', `ที่รับไว้ (${act}/${m.cap})`]];
  const row = c => {
    const unit = c.kind === 'P' ? 'คน' : 'ตัน', st = c.status;
    const left = st === 'active' ? `เหลือ ${c.deadline - state.day + 1} วัน` : st === 'offer' ? `หมดอายุวันที่ ${c.expires}` : st === 'done' ? 'สำเร็จ' : 'ล้มเหลว';
    const needLine = !state.lines.some(l => (l.a === c.from && l.b === c.to) || (l.a === c.to && l.b === c.from));
    return `<div class="cgrow ${st}"><span class="ccls c-${c.cls || 'L'}">${CCLASS[c.cls || 'L'].name}</span>
      <div class="cg-tx"><b>${esc(SMAP[c.from].name)} → ${esc(SMAP[c.to].name)}</b><small>${c.kind === 'P' ? 'ผู้โดยสาร' : 'สินค้า'} ${fmt(c.amount)} ${unit} · ${c.days} วัน${needLine ? ' · <em>ต้องวางรางตรง</em>' : ''}</small>
      ${st === 'active' ? `<div class="bar"><i style="width:${c.progress / c.amount * 100}%"></i></div>` : ''}</div>
      <span class="cg-rw num">${baht(c.reward)}</span><span class="pill ${st === 'done' ? 'good' : st === 'failed' ? 'bad' : st === 'active' ? 'warn' : 'mute'}">${left}</span>
      <span class="cg-act">${needLine && st !== 'done' && st !== 'failed' ? `<button data-cgmap="${c.id}">ดูบนแผนที่</button>` : ''}${st === 'offer' ? `<button class="action" data-cgacc="${c.id}" ${act >= m.cap ? 'disabled' : ''}>รับสัญญา</button>` : ''}</span></div>`;
  };
  let body;
  if (MOD.tab === 'act') {
    const list = state.contracts.filter(c => c.status !== 'offer');
    body = list.map(row).join('') || '<p class="info">ยังไม่มีสัญญาที่รับไว้ ไปที่แท็บข้อเสนอเพื่อเลือกงาน</p>';
  } else {
    const cards = CG_CARDS.map(cd => {
      const C = CCLASS[cd.k], locked = C && s < C.stars, left = cgLeft(cd.k);
      const desc = locked ? `ปลดล็อกเมื่อเครือข่ายได้ ${C.stars} ดาว` : cd.desc || C.desc;
      return `<div class="cgcard${locked ? ' locked' : ''}"><header><b>${cd.title}</b></header><div class="cg-ic">${cgIcon(cd.k)}${C ? `<span class="stars s3">${[1, 2, 3].map(i => `<i class="${i <= C.stars ? 'on' : ''}"></i>`).join('')}</span>` : ''}</div>
        <p>${desc}</p>${locked ? `<button class="btn" disabled>${cd.btn}</button>` : left > 0 ? `<div class="cg-cd"><span data-cgcd="${cd.k}">รอ…</span><button data-cgskip="${cd.k}">ข้ามรอ <i class="coin"></i> 1</button></div>` : `<button class="btn action" data-cggen="${cd.k}">${cd.btn}<em class="free">ฟรี</em></button>`}</div>`;
    }).join('');
    const offers = state.contracts.filter(c => c.status === 'offer');
    body = `<div class="cgcards">${cards}</div><h4 class="msec">ข้อเสนอที่มีอยู่</h4>${offers.map(row).join('') || '<p class="info">ยังไม่มีข้อเสนอ กดสร้างข้อเสนอจากการ์ดด้านบน</p>'}`;
  }
  mSet('สัญญาว่าจ้าง', `เครือข่าย ${starRow(s)} · ชื่อเสียง ${Math.round(state.rep)} · ค่าตอบแทน ×${repMul().toFixed(2)}`, body, tabs);
}
function makeOffer(from, to, km, cls, x = {}) {
  const fd = SMAP[from], kinds = [];
  if (fd.cargo >= 1.5) kinds.push('C'); if (fd.pax >= 1) kinds.push('P'); if (!kinds.length) kinds.push('P');
  const kind = kinds[Math.floor(Math.random() * kinds.length)];
  const size = (0.6 + state.rep / 100 * 0.9) * (0.7 + Math.random() * 0.6);
  const amount = Math.round((kind === 'P' ? 420 : 260) * size / 10) * 10;
  const reward = Math.round(amount * (kind === 'P' ? FARE_P : FARE_C) * km * 1.6 * repMul() * CCLASS[cls].mul * (x.mul || 1) / 100) * 100;
  const c = { id: 'K' + (state.nextId++), cls, kind, from, to, amount, reward, days: 2 + Math.floor(Math.random() * 3) + (x.days || 0), expires: state.day + 2 + (x.days || 0), status: 'offer', progress: 0, map: !!x.map };
  state.contracts.push(c); RT.contractsDirty = true; return c;
}
function genOffer(k) {
  if (state.contracts.filter(c => c.status === 'offer').length >= 8) { toast('ข้อเสนอเต็ม 8 ใบ รับหรือรอให้หมดอายุก่อน'); return false; }
  if (k === 'SP') return genSpecial();
  if (k === 'MAP') {
    const open = STATIONS.filter(d => state.stations[d.id].unlocked && stationLines(d.id).length);
    const pairs = [];
    for (const a of open) for (const b of STATIONS) if (a !== b && !state.lines.some(l => (l.a === a.id && l.b === b.id) || (l.a === b.id && l.b === a.id)) && Math.hypot(a.x - b.x, a.z - b.z) < 70) pairs.push([a, b]);
    if (!pairs.length) { toast('ไม่พบงานบนแผนที่ในตอนนี้'); return false; }
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)], km = Math.hypot(a.x - b.x, a.z - b.z) * UNIT_KM * 1.2;
    const c = makeOffer(a.id, b.id, km, contractClass(a.id, b.id, km), { mul: 1.4, days: 3, map: true });
    toast(`พบงานบนแผนที่: ${a.name} → ${b.name}`); return c;
  }
  if (netStars() < CCLASS[k].stars) return false;
  const cand = state.lines.filter(l => rawClass(l.a, l.b, lineKm(l)) === k);
  if (!cand.length) { toast(k === 'X' ? 'ยังไม่มีรางไปเชียงใหม่ หนองคาย อุบลราชธานี หรือสุไหงโก-ลก' : k === 'R' ? 'ยังไม่มีเส้นทางยาว 220 กม. ขึ้นไป' : 'ยังไม่มีเส้นทางระยะสั้น (ต่ำกว่า 220 กม.)'); return false; }
  const l = cand[Math.floor(Math.random() * cand.length)], ab = Math.random() < 0.5;
  return makeOffer(ab ? l.a : l.b, ab ? l.b : l.a, lineKm(l), k);
}
function genSpecial() {
  if (!tstate) { toast('ยังไม่ได้เปิดสถานีหัวลำโพง'); return false; }
  const peer = typeof CO !== 'undefined' && CO.peers ? CO.peers.find(p => !p.isMe && p.by) : null;
  const ch = CHARTER[Math.floor(Math.random() * CHARTER.length)];
  const who = peer ? `ขบวนของ${(CO.names && CO.names[peer.by]) || 'เพื่อนร่วมเล่น'}` : ch[1], from = peer ? `${ch[0]} (ผู้เล่นอื่น)` : `${ch[0]} · ${ch[1]}`;
  const last = Math.max(tstate.now + 6 * 60, ...tstate.services.filter(s => s.phase === 'sched').map(s => s.schedArr).slice(0, 1));
  const s = makeService(last + 120);
  const no = 900 + Math.floor(Math.random() * 99);
  Object.assign(s, { special: true, name: `พิเศษ ${no}`, outName: `พิเศษ ${no + 1}`, from });
  tstate.services.push(s);
  tlog(`${who} (พิเศษ ${no}) ขอเข้าหัวลำโพง เวลา ${tClock(s.schedArr)}`, 'good');
  toast(`${who} จะเข้าหัวลำโพง ${tClock(s.schedArr)} · รายได้ 2 เท่า`); sfxPing();
  return s;
}
$('#mmodal').addEventListener('click', e => {
  if (MOD.kind !== 'cg') return;
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  const d = b.dataset, m = M_(); m.cg = m.cg || {};
  if (d.cggen) { if (cgLeft(d.cggen) <= 0 && genOffer(d.cggen)) m.cg[d.cggen] = Date.now(); renderContractsModal(); }
  else if (d.cgskip) { if (spendCoins(1)) { m.cg[d.cgskip] = 0; } renderContractsModal(); }
  else if (d.cgacc) { acceptContract(d.cgacc); renderContractsModal(); }
  else if (d.cgmap) {
    const c = state.contracts.find(x => x.id === d.cgmap); if (!c) return;
    closeModal(); if (MODE !== 'net') setMode('net'); setMap2d(true); syncToolbar();
    const lock = [c.from, c.to].find(id => !state.stations[id].unlocked);
    if (lock) { RT.preview = null; select({ type: 'station', id: lock }); renderRouteCard(); toast(`เปิด${SMAP[lock].name}ก่อน (${baht(SMAP[lock].cost)}) แล้ววางรางตรง`); }
    else { RT.routeFrom = null; RT.preview = { a: c.from, b: c.to }; setSel({ type: 'station', id: c.to }); renderRouteCard(); }
  }
});
function cgTick() { document.querySelectorAll('[data-cgcd]').forEach(el => { const l = cgLeft(el.dataset.cgcd); el.textContent = `รอ ${l} วิ`; if (l <= 0 && MOD.kind === 'cg') { MCACHE.body = null; renderContractsModal(); } }); }

// ---------- area chip (code · stars · temperature) and terminal zone buttons ----------
$('#metaHud').insertAdjacentHTML('afterbegin', '<button class="area" id="hArea" aria-label="พื้นที่ ดาว และสภาพอากาศ"><b id="hAreaN">TH</b><span id="hAreaS"></span><span class="tmp" id="hAreaT"></span></button>');
$('#hArea').addEventListener('click', openRewards);
function areaTemp(mode) {
  const h = mode === 'stn' && stnState() ? stnState().now / 3600 % 24 : mode === 'term' ? (tstate ? tstate.now / 3600 % 24 : 7) : state.t / DAY_LEN * 24;
  const rain = mode === 'net' && state.event && state.event.type === 'rain';
  return Math.round(28 + 6 * Math.sin((h - 9) / 24 * Math.PI * 2) - (rain ? 4 : 0));
}
function areaHud() {
  const term = MODE === 'term';
  const sn = MODE === 'stn';
  $('#hAreaN').textContent = sn ? STN.cur : term ? 'HLP' : 'TH';
  const n = sn ? stnStars(STN.cur) : term ? termStars() : netStars(), sig = MODE + (STN.cur || '') + n;
  if ($('#hAreaS').dataset.k !== sig) { $('#hAreaS').dataset.k = sig; $('#hAreaS').innerHTML = starRow(n); }
  $('#hAreaT').textContent = areaTemp(MODE) + '°C';
}
const ZONES = [
  { k: 'all', l: '⌂', t: 'ทั้งสถานี' }, { k: 'G', l: '★', t: 'หน้าสถานี ลานน้ำพุ และถนนพระรามที่ 4', x: -112, z: 43, zoom: 2.0, az: Math.PI * 1.25 }, { k: 'A', l: 'A', t: 'ปลายราง / กันชน', x: 0, z: 43, zoom: 2.2 },
  { k: 'B', l: 'B', t: 'ชานชาลา 1–6', x: 150, z: 17, zoom: 2.4 }, { k: 'C', l: 'C', t: 'ชานชาลา 7–10', x: 150, z: 51, zoom: 2.4 },
  { k: 'D', l: 'D', t: 'ชานชาลา 11–14', x: 150, z: 80, zoom: 2.4 }, { k: 'E', l: 'E', t: 'คอขวดและประแจสลับคู่', x: 450, z: 43, zoom: 2.4 },
  { k: 'F', l: 'F', t: 'สัญญาณเข้า H / ทางออก', x: 640, z: 43, zoom: 2.6 },
];
$('#stage').insertAdjacentHTML('beforeend', `<div class="zones" id="zoneBar" hidden aria-label="มุมกล้องสถานี">${ZONES.map(z => `<button data-zone="${z.k}" title="${z.t}" aria-label="${z.t}">${z.l}</button>`).join('')}<button data-zone="gs" title="โรงรถบริการ" aria-label="โรงรถบริการ"><svg viewBox="0 0 24 24"><path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7M7 16h10"/></svg></button></div>`);
$('#zoneBar').addEventListener('click', e => {
  const b = e.target.closest('[data-zone]'); if (!b || MODE !== 'term') return;
  if (b.dataset.zone === 'gs') { openGS(); return; }
  const z = ZONES.find(x => x.k === b.dataset.zone); camTerm.follow = null;
  if (z.k === 'all') camTerm.home(); else { camTerm.tx = z.x; camTerm.tz = z.z; camTerm.zoom = clamp(narrow() ? z.zoom * 0.7 : z.zoom, camTerm.zmin, camTerm.zmax); }
  camTerm.azT = z.az || Math.PI / 4;
  document.querySelectorAll('#zoneBar [data-zone]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
});
TOOLS.term.splice(TOOLS.term.findIndex(t => t[0] === 'tcrew'), 0, ['gs', 'รถบริการ'], ['contracts', 'สัญญา']);
TOOLS.term.unshift(['sinfo', 'ข้อมูลจริง']);
ICONS.gs = '<path d="M3 20V9l9-5 9 5v11"/><path d="M7 20v-7h10v7M7 16h10"/>';
