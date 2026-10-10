// =================== Hua Lamphong live list, train card and platform selection (WoA-style) ===================
const CLS = 'ABCD';
// consist length class: A ≤4 vehicles, B ≤6, C ≤8, D 9–10; platforms 1–6 take D, 7–10 take C, 11–14 take B
const trainClass = s => { const n = s.kind === 'LH' ? 1 + s.coaches : s.cars + 2; return n <= 4 ? 0 : n <= 6 ? 1 : n <= 8 ? 2 : 3; };
const platClass = T => (T <= 6 ? 3 : T <= 10 ? 2 : 1);
const ORIG_CODE = { 'นครสวรรค์': 'NSN', 'บ้านตาคลี': 'BTK', 'ตะพานหิน': 'TPH', 'สุรินทร์': 'SUR', 'อรัญประเทศ': 'ARN', 'จุกเสม็ด': 'CSM', 'ชุมทางบ้านภาชี': 'BPC', 'ชุมทางแก่งคอย': 'KKY', 'เชียงใหม่': 'CMI', 'อุบลราชธานี': 'UBN', 'หนองคาย': 'NKI', 'สุไหงโก-ลก': 'SGK', 'ชุมทางหาดใหญ่': 'HDY', 'พิษณุโลก': 'PLK', 'สุราษฎร์ธานี': 'SNI', 'ตรัง': 'TRG', 'ศิลาอาสน์': 'SLA',
  'ลพบุรี': 'LBR', 'อยุธยา': 'AYA', 'ฉะเชิงเทรา': 'CCO', 'ราชบุรี': 'RBR', 'ปราจีนบุรี': 'PCB', 'นครปฐม': 'NPT', 'บ้านภาชี': 'BPC', 'แก่งคอย': 'KKY', 'หัวหิน': 'HHN', 'กาญจนบุรี': 'KAN' };
const ROUTE_REGION = { NSN: 'สายเหนือ', BTK: 'สายเหนือ', TPH: 'สายเหนือ', SUR: 'สายอีสาน', ARN: 'สายตะวันออก', CSM: 'สายตะวันออก', CMI: 'สายเหนือ', PLK: 'สายเหนือ', SLA: 'สายเหนือ', LBR: 'สายเหนือ', AYA: 'สายเหนือ', BPC: 'สายเหนือ', UBN: 'สายอีสาน', NKI: 'สายอีสาน', KKY: 'สายอีสาน',
  SGK: 'สายใต้', HDY: 'สายใต้', SNI: 'สายใต้', TRG: 'สายใต้', RBR: 'สายใต้', NPT: 'สายใต้', HHN: 'สายใต้', KAN: 'สายตะวันตก', CCO: 'สายตะวันออก', PCB: 'สายตะวันออก' };
const origCode = s => ORIG_CODE[s.from] || ORIG_CODE[String(s.from).split(' ')[0]] || 'SPC';
const LOCO_T = ['GEA', 'ALS', 'HID', 'CSR'], DMU_T = ['THN', 'NKF', 'APD', 'ASR'];
const svcType = s => s.ty || (s.ty = (s.kind === 'LH' ? LOCO_T : DMU_T)[Math.floor(Math.random() * 4)]);
const needsLift = s => !!(s.tasks ? s.tasks.lift : s.lift);
const svcRev = s => { const late = Math.max(0, (Math.max(tstate.now, s.phase === 'dwell' || s.phase === 'departing' ? tstate.now : s.schedDep) - s.schedDep) / 60); return Math.round(Math.max(1000, Math.round((s.kind === 'LH' ? 12000 : 7000) - late * 400)) * (s.special ? 2 : 1)); };
const LIVE = { sel: null, filter: 'all', sig: '', cardSig: '', sheet: null };
const isNextArrival = s => { const n = nextArrivalSvc(); return n && n.id === s.id; };
function svcAlert(s) {
  if (s.phase === 'held') return true;
  if (s.phase === 'approach' && isNextArrival(s) && !tstate.routes.some(r => r.from === 'HA')) return true;
  if (s.phase === 'dwell' && s.state === 'ready' && tstate.now >= s.schedDep - 30 && !tstate.routes.some(r => r.from === 'ST' + s.track)) return true;
  return false;
}
// per-region operating contracts: every 5 departures is one contract period, scored by on-time thumbs
function routeContractTick(svc, late) {
  const reg = ROUTE_REGION[origCode(svc)] || 'ขบวนพิเศษ';
  const R = (tstate.rstat = tstate.rstat || {})[reg] || (tstate.rstat[reg] = { n: 0, up: 0, down: 0, done: 0 });
  R.n++; if (late <= 3) R.up++; else R.down++;
  if (R.n >= 5) {
    const ok = R.up >= 4;
    if (ok) { earn(20000, 'term'); gainXP(15); toast(`ต่อสัญญาเดินรถ${reg}สำเร็จ +${baht(20000)}`); tlog(`ต่อสัญญาเดินรถ${reg} (${R.up}/5 ตรงเวลา)`, 'good'); }
    else { state.rep = Math.max(0, state.rep - 3); toast(`สัญญาเดินรถ${reg}ไม่ผ่าน: ตรงเวลาแค่ ${R.up}/5`); tlog(`สัญญาเดินรถ${reg}ไม่ผ่านเกณฑ์`, 'bad'); }
    R.done++; R.n = 0; R.up = 0; R.down = 0;
  }
}
const regStat = s => { const reg = ROUTE_REGION[origCode(s)] || 'ขบวนพิเศษ'; return [reg, (tstate.rstat && tstate.rstat[reg]) || { n: 0, up: 0, down: 0 }]; };

// ---------- DOM ----------
$('#stage').insertAdjacentHTML('beforeend', `
<aside class="live" id="live" hidden aria-label="ขบวนรถเข้า-ออก">
  <div class="live-head"><b>ขบวนรถ</b><button class="iconbtn" id="liveFilter" aria-label="ตัวกรอง" title="ตัวกรอง"><svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v5l-4 2v-7z"/></svg></button></div>
  <div class="live-list" id="liveList"></div>
</aside>
<section class="tcard" id="tcard" hidden aria-label="ข้อมูลขบวนรถ"></section>
<section class="psheet" id="psheet" hidden aria-label="เลือกชานชาลา"><header><div><b id="psTitle">เลือกชานชาลา</b><small id="psSub"></small></div><button class="iconbtn" id="psClose" aria-label="ปิด"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="ps-list" id="psList"></div></section>`);
const LV_IC = {
  arr: '<path d="M3 17h18M6 13l4 2 9-6-2-1-6 3-4-3-2 1 3 3"/>',
  in: '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 20l2-3M16 20l-2-3"/>',
  dep: '<path d="M3 19h18M5 15l5-1 9-7-1-2-8 4-4-2-2 1 3 3"/>',
};
const FILTERS = [['all', 'ทั้งหมด'], ['arr', 'ขาเข้า'], ['in', 'ในชานชาลา']];
$('#liveFilter').addEventListener('click', () => { const i = FILTERS.findIndex(f => f[0] === LIVE.filter); LIVE.filter = FILTERS[(i + 1) % FILTERS.length][0]; toast('แสดง: ' + FILTERS[(i + 1) % FILTERS.length][1]); LIVE.sig = ''; liveRender(); });
$('#liveList').addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (!b) return; const s = tSvc(b.dataset.lv); if (!s) return; tSelect(TRT.sel && TRT.sel.sid === s.id ? null : { sid: s.id }); });
const liveIcon = s => (['sched', 'approach', 'held'].includes(s.phase) ? 'arr' : s.phase === 'departing' ? 'dep' : 'in');
function liveItems() {
  const ph = { held: 0, approach: 1, entering: 2, dwell: 3, departing: 4, sched: 5 };
  let list = tstate.services.filter(s => ph[s.phase] !== undefined);
  if (LIVE.filter === 'arr') list = list.filter(s => ['sched', 'approach', 'held', 'entering'].includes(s.phase));
  if (LIVE.filter === 'in') list = list.filter(s => s.phase === 'dwell' || s.phase === 'departing');
  return list.sort((a, b) => (svcAlert(b) - svcAlert(a)) || ((a.phase === 'sched') - (b.phase === 'sched')) || (a.schedArr - b.schedArr)).slice(0, 14);
}
function liveRender(force) {
  if (!tstate || MODE !== 'term') { $('#live').hidden = true; $('#tcard').hidden = true; $('#psheet').hidden = true; $('#app').classList.remove('livecard'); return; }
  $('#live').hidden = false;
  const sel = TRT.sel && TRT.sel.sid;
  const html = liveItems().map(s => {
    const al = svcAlert(s), t = s.phase === 'dwell' || s.phase === 'departing' ? tClock(s.schedDep) : tClock(s.schedArr);
    return `<button class="lv${al ? ' alert' : ''}${sel === s.id ? ' sel' : ''}${s.special ? ' sp' : ''}" data-lv="${s.id}"><span class="lv-st"><svg viewBox="0 0 24 24">${al ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>' : LV_IC[liveIcon(s)]}</svg></span>
      <span class="lv-ty"><b>${svcType(s)}</b><span><i class="cl">${CLS[trainClass(s)]}</i>${needsLift(s) ? '<i class="wc" title="ต้องใช้ลิฟต์วีลแชร์">♿</i>' : ''}</span></span>
      <span class="lv-or"><b>${origCode(s)}</b><small>${s.track ? 'ราง ' + s.track : t}</small></span></button>`;
  }).join('') || '<p class="info">ไม่มีขบวน</p>';
  if (html !== LIVE.sig || force) { LIVE.sig = html; $('#liveList').innerHTML = html; }
  liveCard(force);
}

// ---------- train card ----------
function phaseText(s) {
  const c = s.cid && tCons(s.cid);
  switch (s.phase) {
    case 'sched': return ['ตามกำหนด', `กำหนดเข้า ${tClock(s.schedArr)}${s.plan ? ` · วางแผนราง ${s.plan}` : ''}`];
    case 'approach': return ['กำลังเข้าเขต', c ? `ห่างสัญญาณ H ${Math.max(0, Math.round(c.stopS - c.s))} ม. · ${Math.round(c.v * 3.6)} กม./ชม.` : 'กำลังเข้าเขตสถานี'];
    case 'held': return ['รอสัญญาณ H', `หยุดรอที่สัญญาณ H มา ${Math.floor(s.hold / 60)}:${String(Math.floor(s.hold % 60)).padStart(2, '0')} นาที`];
    case 'entering': return ['เข้าชานชาลา', `กำลังเข้าราง ${s.track}${c ? ` · ${Math.round(c.v * 3.6)} กม./ชม.` : ''}`];
    case 'dwell': { const k = s.tasks ? Object.values(s.tasks) : [], d = k.filter(t => t.st === 'done').length; return [s.state === 'ready' ? 'พร้อมออก' : 'กลับขบวน', s.state === 'ready' ? `พร้อมออกจากราง ${s.track}` : `งานกลับขบวน ${d}/${k.length}${k.some(t => t.st === 'queue') ? ' · มีงานรอทีม' : ''}`]; }
    case 'departing': return ['กำลังออก', 'ออกจากสถานีผ่านคอขวด'];
  }
  return ['—', ''];
}
function schedText(s) {
  if (s.phase === 'dwell' || s.phase === 'departing') {
    const late = Math.round((tstate.now - s.schedDep) / 60);
    if (late > 0) return ['ล่าช้า', `${late} นาที`, 'bad', 1];
    const left = Math.max(0, s.schedDep - tstate.now);
    return ['ออกตามกำหนด', `${tClock(s.schedDep)} · อีก ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`, 'good', 1 - left / ((s.schedDep - s.schedArr) || 1)];
  }
  if (s.phase === 'held') return ['ค่าปรับรอสัญญาณ', baht(s.hold * 2.5), 'bad', 1];
  const left = s.schedArr - tstate.now;
  return ['ถึงสัญญาณ H', left > 0 ? `อีก ${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}` : 'กำลังถึง', '', 0.5];
}
function cardAction(s) {
  if (s.phase === 'approach' || s.phase === 'held') {
    if (tstate.routes.some(r => r.from === 'HA')) return ['ตั้งเส้นทางเข้าแล้ว', false, ''];
    return isNextArrival(s) ? ['เลือกชานชาลา', true, 'route'] : ['รอคิวขบวนก่อนหน้า', false, ''];
  }
  if (s.phase === 'sched') return [s.plan ? `เปลี่ยนแผน (ราง ${s.plan})` : 'วางแผนชานชาลา', true, 'plan'];
  if (s.phase === 'dwell') {
    if (tstate.routes.some(r => r.from === 'ST' + s.track)) return ['ตั้งเส้นทางออกแล้ว', false, ''];
    if (s.state === 'ready') return ['ปล่อยรถ', true, 'dep'];
    return [phaseText(s)[1].replace(' · มีงานรอทีม', ''), false, ''];
  }
  return [s.phase === 'entering' ? 'กำลังเข้าชานชาลา' : 'กำลังออก', false, ''];
}
const face = r => r == null ? '<i class="face"></i>' : `<i class="face ${r >= 0.8 ? 'good' : r >= 0.5 ? 'mid' : 'bad'}"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5"/><circle cx="7" cy="8" r="1" class="e"/><circle cx="13" cy="8" r="1" class="e"/><path d="${r >= 0.8 ? 'M6 12q4 4 8 0' : r >= 0.5 ? 'M6.5 13h7' : 'M6 14q4-4 8 0'}"/></svg></i>`;
function liveCard(force) {
  const s = TRT.sel && tSvc(TRT.sel.sid), el = $('#tcard');
  $('#app').classList.toggle('livecard', !!s);
  if (!s) { el.hidden = true; LIVE.cardSig = ''; closePlatSheet(); return; }
  el.hidden = false;
  const sig = s.id + s.phase + (s.state || '') + (s.track || 0);
  if (sig !== LIVE.cardSig || force) {
    LIVE.cardSig = sig;
    const op = s.special ? String(s.from).split(' · ').pop() : 'การรถไฟแห่งประเทศไทย';
    el.innerHTML = `<header><div class="tc-id"><b>${esc(s.name)}</b><small>${origCode(s)} · ${esc(s.from)}</small></div><div class="tc-ty"><b>${svcType(s)}</b><span><i class="cl">${CLS[trainClass(s)]}</i>${needsLift(s) ? '<i class="wc">♿</i>' : ''}</span></div><span class="tc-al" data-f="al"></span></header>
      <div class="tc-body">
        <div class="tc-main"><div><small>สถานะ</small><b data-f="ph"></b></div><div><small>ชานชาลา</small><b data-f="tr"></b></div><div><small>รายได้คาดการณ์</small><b class="num" data-f="rev"></b></div><div><small>ผู้ให้บริการ</small><span class="tc-op">${esc(op)}</span></div></div>
        <div class="tc-pic">${thumbImg(s.kind === 'LH' ? [svcType(s), 'coach', 'coach'] : [svcType(s), svcType(s) + '_car', svcType(s)])}</div>
        <div class="tc-sched"><span data-f="sl"></span><b data-f="sv"></b><div class="bar"><i data-f="sb"></i></div></div>
        <div class="tc-ct"><span class="ct-ic">${cgIcon('L')}</span><div><small data-f="reg"></small><b data-f="ct"></b></div><span class="thumbs" data-f="th"></span><span data-f="face"></span></div>
        <div class="tc-status"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="14" rx="2"/><circle cx="12" cy="7" r="1.3"/><circle cx="12" cy="12" r="1.3"/><path d="M12 17v4"/></svg><span data-f="st"></span></div>
        <button class="btn action big" data-f="act"></button>
      </div>
      <nav class="tc-side"><button data-tc="follow" title="ติดตามกล้อง" aria-label="ติดตามกล้อง"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button><button data-tc="info" title="รายละเอียดงานกลับขบวน" aria-label="รายละเอียด"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg></button><button data-tc="close" title="ปิด" aria-label="ปิด"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></nav>`;
  }
  const [ph, st] = phaseText(s), [sl, sv, scl, sp] = schedText(s), [reg, R] = regStat(s), [al, en, kind] = cardAction(s);
  setF(el, 'ph', x => { x.textContent = ph; }); setF(el, 'tr', x => { x.textContent = s.track ? `ราง ${s.track}` : s.plan ? `แผน ${s.plan}` : '—'; });
  setF(el, 'rev', x => { x.textContent = baht(svcRev(s)); });
  setF(el, 'sl', x => { x.textContent = sl; }); setF(el, 'sv', x => { x.textContent = sv; x.className = scl; });
  setF(el, 'sb', x => { x.style.width = clamp(sp, 0, 1) * 100 + '%'; x.className = scl; });
  setF(el, 'reg', x => { x.textContent = `สัญญาเดินรถ${reg}`; }); setF(el, 'ct', x => { x.textContent = `${R.n}/5`; });
  setF(el, 'th', x => { x.innerHTML = `<span class="up">👍 ${R.up}</span><span class="dn">👎 ${R.down}</span>`; });
  setF(el, 'face', x => { const r = R.up + R.down ? R.up / (R.up + R.down) : null; const h = face(r); if (x.innerHTML !== h) x.innerHTML = h; });
  setF(el, 'st', x => { x.textContent = st; });
  setF(el, 'al', x => { x.hidden = !svcAlert(s); x.textContent = '!'; });
  setF(el, 'act', x => { if (x.textContent !== al) x.textContent = al; x.disabled = !en; x.dataset.kind = kind; });
}
$('#tcard').addEventListener('click', e => {
  const s = TRT.sel && tSvc(TRT.sel.sid); if (!s) return;
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.tc === 'close') { tSelect(null); return; }
  if (b.dataset.tc === 'follow') { if (s.cid) { camTerm.follow = s.cid; toast(`กล้องติดตาม ${s.name}`); } else toast('ขบวนยังไม่เข้าเขตสถานี'); return; }
  if (b.dataset.tc === 'info') { openDrawer('tsvc'); return; }
  if (b.dataset.f === 'act') {
    const k = b.dataset.kind;
    if (k === 'dep') { if (requestDeparture(s.track, false)) sfxPing(); liveRender(true); }
    else if (k === 'route' || k === 'plan') openPlatSheet(s, k);
  }
});

// ---------- platform selection sheet ----------
function previewTrack(T) {
  if (T == null) { TRT.prev = null; return; }
  const path = findPath({ e: 'aFar', dir: 1 }, x => x.e === 'pw' + T && x.dir === -1, false);
  TRT.prev = path ? new Set(path.map(x => x.e)) : null;
}
function planClash(s, T) {
  const a = s.schedArr, b = s.schedDep + 300;
  return tstate.services.find(o => o !== s && ((o.track === T && ['entering', 'dwell', 'departing'].includes(o.phase) && o.schedDep + 300 > a) || (o.plan === T && o.phase === 'sched' && o.schedArr < b && a < o.schedDep + 300)));
}
function platInfo(s, T, mode) {
  const occ = trackSvc(T);
  if (trainClass(s) > platClass(T)) return [false, 'สั้นเกินไป'];
  if (mode === 'route') {
    if (!trackFree(T)) return [false, occ ? `มี ${occ.name}` : 'ทางถูกล็อก'];
    const why = arrivalRule(T, s); if (why) return [false, /รางคู่/.test(why) ? 'รางคู่กำลังสับหลีก' : /ปลายราง/.test(why) ? 'มีหัวรถจักรที่ปลายราง' : 'ขัดระเบียบ'];
    return [true, s.plan === T ? 'ตามแผน ✓' : 'ว่าง'];
  }
  const c = planClash(s, T); if (c) return [false, `ชนกับ ${c.name}`];
  return [true, s.plan === T ? 'แผนปัจจุบัน' : 'ว่างช่วงเวลานี้'];
}
function openPlatSheet(s, mode) {
  LIVE.sheet = { sid: s.id, mode };
  $('#psTitle').textContent = mode === 'route' ? 'เลือกชานชาลา' : 'วางแผนชานชาลา';
  $('#psSub').textContent = `${s.name} · ขนาด ${CLS[trainClass(s)]} · ${s.kind === 'LH' ? 'หัวรถจักร (ต้องสับหลีก)' : 'push-pull'}`;
  $('#psheet').hidden = false; renderPlatSheet();
}
function closePlatSheet() { LIVE.sheet = null; $('#psheet').hidden = true; previewTrack(null); }
function renderPlatSheet() {
  const sh = LIVE.sheet, s = sh && tSvc(sh.sid);
  if (!s || (sh.mode === 'route' && !['approach', 'held'].includes(s.phase)) || (sh.mode === 'plan' && s.phase !== 'sched')) { closePlatSheet(); return; }
  const html = Array.from({ length: 14 }, (_, i) => {
    const T = i + 1, [ok, why] = platInfo(s, T, sh.mode), mx = platClass(T);
    return `<button class="pcard${ok ? '' : ' no'}${s.plan === T ? ' plan' : ''}" data-pt="${T}" ${ok ? '' : 'aria-disabled="true"'}><b>ชานชาลา ${T}</b><span class="pc-cl">${[0, 1, 2, 3].map(c => `<i class="${c <= mx ? 'on' : ''}">${CLS[c]}</i>`).join('')}</span><small>${why}</small></button>`;
  }).join('');
  if ($('#psList').dataset.h !== html) { $('#psList').dataset.h = html; $('#psList').innerHTML = html; }
}
$('#psClose').addEventListener('click', closePlatSheet);
$('#psList').addEventListener('pointerover', e => { const b = e.target.closest('[data-pt]'); if (b && LIVE.sheet && LIVE.sheet.mode === 'route' && !b.classList.contains('no')) previewTrack(+b.dataset.pt); });
$('#psList').addEventListener('pointerleave', () => previewTrack(null));
$('#psList').addEventListener('click', e => {
  const b = e.target.closest('[data-pt]'); if (!b || !LIVE.sheet) return;
  const s = tSvc(LIVE.sheet.sid), T = +b.dataset.pt; if (!s) return;
  const [ok, why] = platInfo(s, T, LIVE.sheet.mode);
  if (!ok) { toast(`ชานชาลา ${T}: ${why}`); previewTrack(null); return; }
  if (LIVE.sheet.mode === 'route') { if (requestArrival(T, false)) { TRT.assign = false; closePlatSheet(); sfxPing(); } }
  else { s.plan = T; toast(`วางแผน ${s.name} เข้าราง ${T}${ctrlOn('app') ? '' : ' · เปิดผู้ควบคุมขาเข้าให้ ARS ทำตามแผน หรือเลือกเองเมื่อขบวนมาถึง'}`); closePlatSheet(); }
  liveRender(true);
});
setInterval(() => { if (!state || !tstate) return; liveRender(); if (LIVE.sheet) renderPlatSheet(); }, 300);
