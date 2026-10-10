// =================== Shared station UI: live train list, train card, platform sheet ===================
// Every playable station exposes the same adapter, so one UI serves Hua Lamphong (full interlocking engine)
// and the timetable-driven stations. The Unity port mirrors this split (IStationAdapter + TrainViewModel).
//
// adapter = {
//   items(filter)  → services to list, most urgent first
//   vm(svc)        → TrainViewModel (see below)
//   platforms(svc) → [{ n, ok, why, max, planned }] for the platform sheet (sheetTitle/sheetSub on the vm)
//   choose(svc, n) → assign or plan a platform; returns true when accepted
//   act(svc, kind) → card action ('go' = release / send to depot)
//   follow(svc), select(id|null), preview(n|null), info(svc)?
// }
// TrainViewModel = { id, alert, icon: 'arr'|'in'|'dep', code, cls, lift, real, right, sub, special,
//   name, label, typeName, phase, platform, revenue?, op, consist, sched: { label, value, tone, progress },
//   contract?: { title, n, up, down }, status, action: { label, enabled, kind: 'sheet'|'go'|'' } }
const SV = { sel: null, filter: 'all', sheet: null, listSig: '', cardSig: '' };
const LV_IC = {
  arr: '<path d="M3 17h18M6 13l4 2 9-6-2-1-6 3-4-3-2 1 3 3"/>',
  in: '<rect x="5" y="4" width="14" height="13" rx="3"/><path d="M5 11h14M8 20l2-3M16 20l-2-3"/>',
  dep: '<path d="M3 19h18M5 15l5-1 9-7-1-2-8 4-4-2-2 1 3 3"/>',
};
const FILTERS = [['all', 'ทั้งหมด'], ['arr', 'ขาเข้า'], ['in', 'ในชานชาลา']];
const face = r => r == null ? '<i class="face"></i>' : `<i class="face ${r >= 0.8 ? 'good' : r >= 0.5 ? 'mid' : 'bad'}"><svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="8.5"/><circle cx="7" cy="8" r="1" class="e"/><circle cx="13" cy="8" r="1" class="e"/><path d="${r >= 0.8 ? 'M6 12q4 4 8 0' : r >= 0.5 ? 'M6.5 13h7' : 'M6 14q4-4 8 0'}"/></svg></i>`;
const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

// ---------- Hua Lamphong adapter ----------
const HLP_ADAPTER = {
  get: id => tSvc(id),
  items(filter) {
    const ph = { held: 0, approach: 1, entering: 2, dwell: 3, departing: 4, sched: 5 };
    let list = tstate.services.filter(s => ph[s.phase] !== undefined);
    if (filter === 'arr') list = list.filter(s => ['sched', 'approach', 'held', 'entering'].includes(s.phase));
    if (filter === 'in') list = list.filter(s => s.phase === 'dwell' || s.phase === 'departing');
    return list.sort((a, b) => (svcAlert(b) - svcAlert(a)) || ((a.phase === 'sched') - (b.phase === 'sched')) || (a.schedArr - b.schedArr)).slice(0, 14);
  },
  vm(s) {
    const [ph, st] = phaseText(s), [sl, sv, tone, prog] = schedText(s), [reg, R] = regStat(s), [al, en, kind] = cardAction(s), ty = svcType(s);
    const t = s.phase === 'dwell' || s.phase === 'departing' ? tClock(s.schedDep) : tClock(s.schedArr);
    return { id: s.id, alert: svcAlert(s), icon: ['sched', 'approach', 'held'].includes(s.phase) ? 'arr' : s.phase === 'departing' ? 'dep' : 'in', code: ty, cls: trainClass(s), lift: needsLift(s), real: false, special: !!s.special,
      right: origCode(s), sub: s.track ? 'ราง ' + s.track : t, name: s.name, label: `${origCode(s)} · ${s.from}`, typeName: ty, phase: ph, platform: s.track ? `ราง ${s.track}` : s.plan ? `แผน ${s.plan}` : '—',
      revenue: svcRev(s), op: s.special ? String(s.from).split(' · ').pop() : 'การรถไฟแห่งประเทศไทย', consist: s.kind === 'LH' ? [ty, 'coach', 'coach'] : [ty, ty + '_car', ty],
      sched: { label: sl, value: sv, tone, progress: prog }, contract: { title: `สัญญาเดินรถ${reg}`, n: R.n, up: R.up, down: R.down }, status: st,
      action: { label: al, enabled: en, kind: kind === 'dep' ? 'go' : kind ? 'sheet' : '' }, sheetMode: kind === 'route' ? 'route' : 'plan',
      sheetTitle: kind === 'route' ? 'เลือกชานชาลา' : 'วางแผนชานชาลา', sheetSub: `${s.name} · ขนาด ${CLS[trainClass(s)]} · ${s.kind === 'LH' ? 'หัวรถจักร (ต้องสับหลีก)' : 'push-pull'}`,
      sheetOpen: ['approach', 'held', 'sched'].includes(s.phase) };
  },
  platforms(s) { const mode = ['approach', 'held'].includes(s.phase) ? 'route' : 'plan'; return Array.from({ length: 14 }, (_, i) => { const T = i + 1, [ok, why] = platInfo(s, T, mode); return { n: T, ok, why, max: platClass(T), planned: s.plan === T }; }); },
  choose(s, T) {
    if (['approach', 'held'].includes(s.phase)) { if (requestArrival(T, false)) { TRT.assign = false; sfxPing(); return true; } return false; }
    s.plan = T; toast(`วางแผน ${s.name} เข้าราง ${T}${ctrlOn('app') ? '' : ' · เปิดผู้ควบคุมขาเข้าให้ ARS ทำตามแผน หรือเลือกเองเมื่อขบวนมาถึง'}`); return true;
  },
  act(s, kind) { if (kind === 'go' && requestDeparture(s.track, false)) sfxPing(); },
  follow(s) { if (s.cid) { camTerm.follow = s.cid; toast(`กล้องติดตาม ${s.name}`); } else toast('ขบวนยังไม่เข้าเขตสถานี'); },
  select(id) { TRT.sel = id ? { sid: id } : null; $('#dmi').hidden = !id || MODE !== 'term'; },
  preview(n, s) { if (n == null || !s || !['approach', 'held'].includes(s.phase)) previewTrack(null); else previewTrack(n); },
  info() { openDrawer('tsvc'); },
};

// ---------- timetable-driven station adapter ----------
const STN_ADAPTER = {
  get: id => stnState().services.find(x => x.id === id),
  items(filter) {
    const S = stnState();
    let list = S.services.filter(s => s.phase !== 'gone' && s.schedArr - S.now < 3 * 3600);
    if (filter === 'arr') list = list.filter(s => ['sched', 'approach', 'held', 'entering'].includes(s.phase));
    if (filter === 'in') list = list.filter(s => ['dwell', 'ready', 'departing'].includes(s.phase));
    return list.sort((a, b) => (sAlert(S, b) - sAlert(S, a)) || (a.schedArr - b.schedArr)).slice(0, 14);
  },
  vm(s) {
    const S = stnState(), late = Math.round((s.mode === 'term' ? (s.arrAt || S.now) - s.schedArr : S.now - s.schedDep) / 60);
    const status = { sched: `เข้าเขตสถานีเวลา ${hm((s.eta || s.schedArr) - 300)}${s.inDelay ? ` · ต้นทางช้า ${s.inDelay} นาที` : ''}`, approach: s.track ? `ได้รางที่ ${s.track} แล้ว กำลังรอเปิดสัญญาณ` : 'ยังไม่ได้เลือกชานชาลา', held: `หยุดรอที่สัญญาณเข้า ${Math.floor(s.hold / 60)} นาที · เสียค่าปรับ`, entering: `กำลังเข้าราง ${s.track}`,
      dwell: `${sPhase(s)} · เสร็จราว ${hm(s.readyAt)}${s.lift ? ' · ใช้ลิฟต์วีลแชร์' : ''}${s.fault ? ' · ' + s.fault : ''}`, ready: s.mode === 'term' ? 'ส่งขบวนเปล่าเข้าศูนย์ซ่อมเพื่อคืนชานชาลา' : 'ผู้โดยสารขึ้นครบ รอปล่อยรถ', departing: 'ออกจากสถานีผ่านคอขวด' }[s.phase] || '';
    let action = { label: sPhase(s), enabled: false, kind: '' };
    if (['sched', 'approach', 'held'].includes(s.phase)) action = { label: s.track ? `เปลี่ยนชานชาลา (ราง ${s.track})` : 'เลือกชานชาลา', enabled: true, kind: 'sheet' };
    else if (s.phase === 'ready') action = { label: s.mode === 'term' ? 'ส่งเข้าศูนย์ซ่อม' : 'ปล่อยรถ', enabled: true, kind: 'go' };
    return { id: s.id, alert: sAlert(S, s), icon: ['sched', 'approach', 'held'].includes(s.phase) ? 'arr' : s.phase === 'departing' ? 'dep' : 'in', code: s.name.split(' ').pop(), cls: stnCls(s), lift: s.lift, real: s.real,
      right: String(s.cls).split(' ')[0], sub: s.track ? 'ราง ' + s.track : hm(s.mode === 'orig' ? s.schedDep : s.schedArr), name: s.name, label: s.label, typeName: s.kind === 'LH' ? RS[rsResolve(s.veh[0]).k].name.split(' ')[0] + ' ' + (RS[rsResolve(s.veh[0]).k].name.split(' ')[1] || '') : 'ดีเซลราง',
      phase: sPhase(s), platform: s.track ? 'ราง ' + s.track : '—', op: s.real ? `ตารางเดินรถจริง${s.est ? ' (เวลาผ่านโดยประมาณ)' : ''}` : 'ขบวนจำลองเสริมตาราง', consist: s.veh.slice(0, 3),
      sched: { label: s.mode === 'term' ? `ถึงตามกำหนด ${hm(s.schedArr)}` : `ออกตามกำหนด ${hm(s.schedDep)}`, value: late > 0 ? `ช้า ${late} นาที` : `อีก ${-late} นาที`, tone: late > 3 ? 'bad' : 'good', progress: s.phase === 'dwell' ? clamp(1 - (s.readyAt - S.now) / (20 * 60), 0, 1) : s.phase === 'ready' ? 1 : 0.3 },
      status, action, sheetTitle: 'เลือกชานชาลา', sheetSub: `${s.name} · ขนาด ${CLS[stnCls(s)]} · ${s.veh.length} คัน`, sheetOpen: ['sched', 'approach', 'held'].includes(s.phase) };
  },
  platforms(s) { const S = stnState(), d = stnDef(); return d.tracks.map(t => { const [ok, why] = stnTrackInfo(S, d, s, t); return { n: t.n, ok, why: s.track === t.n ? 'เลือกแล้ว' : why, max: t.cls, planned: s.track === t.n }; }); },
  choose(s, n) { const S = stnState(); s.track = n; sfxPing(); toast(`${s.name} เข้าราง ${n}`); slog(S, `จัด ${s.name} เข้าราง ${n}`); return true; },
  act(s, kind) { if (kind === 'go') stnRelease(stnState(), s); },
  follow(s) { cam.follow = s.id; },
  select(id) { STN.sel = id; },
  preview() {},
};
const svAdapter = () => (MODE === 'term' && tstate ? HLP_ADAPTER : MODE === 'stn' && stnState() ? STN_ADAPTER : null);

// ---------- DOM ----------
$('#stage').insertAdjacentHTML('beforeend', `
<aside class="live" id="live" hidden aria-label="ขบวนรถเข้า-ออก">
  <div class="live-head"><b>ขบวนรถ</b><button class="iconbtn" id="liveFilter" aria-label="ตัวกรอง" title="ตัวกรอง"><svg viewBox="0 0 24 24"><path d="M4 5h16l-6 8v5l-4 2v-7z"/></svg></button></div>
  <div class="live-list" id="liveList"></div>
</aside>
<section class="tcard" id="tcard" hidden aria-label="ข้อมูลขบวนรถ"></section>
<section class="psheet" id="psheet" hidden aria-label="เลือกชานชาลา"><header><div><b id="psTitle">เลือกชานชาลา</b><small id="psSub"></small></div><button class="iconbtn" id="psClose" aria-label="ปิด"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header><div class="ps-list" id="psList"></div></section>`);

function svSelect(id) {
  SV.sel = id; SV.cardSig = ''; SV.listSig = '';
  const A = svAdapter(); if (A) A.select(id);
  if (!id) svCloseSheet();
  liveRender(true);
}
function liveRender(force) {
  const A = svAdapter();
  if (!A) { $('#live').hidden = true; $('#tcard').hidden = true; $('#psheet').hidden = true; $('#app').classList.remove('livecard'); return; }
  $('#live').hidden = false;
  const html = A.items(SV.filter).map(s => {
    const v = A.vm(s);
    return `<button class="lv${v.alert ? ' alert' : ''}${SV.sel === v.id ? ' sel' : ''}${v.special ? ' sp' : ''}${v.real ? '' : ' sim'}" data-lv="${v.id}"><span class="lv-st"><svg viewBox="0 0 24 24">${v.alert ? '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5v.5"/>' : LV_IC[v.icon]}</svg></span>
      <span class="lv-ty"><b>${esc(v.code)}</b><span><i class="cl">${CLS[v.cls]}</i>${v.lift ? '<i class="wc" title="ต้องใช้ลิฟต์วีลแชร์">♿</i>' : ''}${v.real ? '<i class="rl" title="ขบวนจริงจากตารางเดินรถ">จริง</i>' : ''}</span></span>
      <span class="lv-or"><b>${esc(v.right)}</b><small>${esc(v.sub)}</small></span></button>`;
  }).join('') || '<p class="info">ไม่มีขบวน</p>';
  if (html !== SV.listSig || force) { SV.listSig = html; $('#liveList').innerHTML = html; }
  svCard(force);
  if (SV.sheet) svRenderSheet();
}
function svCard(force) {
  const A = svAdapter(), s = A && SV.sel && A.get(SV.sel), el = $('#tcard');
  $('#app').classList.toggle('livecard', !!s);
  if (!s) { el.hidden = true; SV.cardSig = ''; if (SV.sel) svSelect(null); return; }
  const v = A.vm(s);
  el.hidden = false;
  const sig = v.id + v.phase + v.platform + (v.action.kind || '');
  if (sig !== SV.cardSig || force) {
    SV.cardSig = sig;
    el.innerHTML = `<header><div class="tc-id"><b>${esc(v.name)}</b><small>${esc(v.label)}</small></div><div class="tc-ty"><b>${esc(v.typeName)}</b><span><i class="cl">${CLS[v.cls]}</i>${v.lift ? '<i class="wc">♿</i>' : ''}</span></div><span class="tc-al" data-f="al">!</span></header>
      <div class="tc-body">
        <div class="tc-main"><div><small>สถานะ</small><b data-f="ph"></b></div><div><small>ชานชาลา</small><b data-f="tr"></b></div>${v.revenue != null ? '<div><small>รายได้คาดการณ์</small><b class="num" data-f="rev"></b></div>' : ''}<div><small>${v.revenue != null ? 'ผู้ให้บริการ' : 'ข้อมูล'}</small><span class="tc-op">${esc(v.op)}</span></div></div>
        <div class="tc-pic">${thumbImg(v.consist)}</div>
        <div class="tc-sched"><span data-f="sl"></span><b data-f="sv"></b><div class="bar"><i data-f="sb"></i></div></div>
        ${v.contract ? `<div class="tc-ct"><span class="ct-ic">${cgIcon('L')}</span><div><small data-f="reg"></small><b data-f="ct"></b></div><span class="thumbs" data-f="th"></span><span data-f="face"></span></div>` : ''}
        <div class="tc-status"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="14" rx="2"/><circle cx="12" cy="7" r="1.3"/><circle cx="12" cy="12" r="1.3"/><path d="M12 17v4"/></svg><span data-f="st"></span></div>
        <button class="btn action big" data-f="act"></button>
      </div>
      <nav class="tc-side"><button data-tc="follow" title="ติดตามกล้อง" aria-label="ติดตามกล้อง"><svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg></button>${A.info ? '<button data-tc="info" title="รายละเอียดงานกลับขบวน" aria-label="รายละเอียด"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/></svg></button>' : ''}<button data-tc="close" title="ปิด" aria-label="ปิด"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg></button></nav>`;
  }
  setF(el, 'ph', x => { x.textContent = v.phase; }); setF(el, 'tr', x => { x.textContent = v.platform; });
  if (v.revenue != null) setF(el, 'rev', x => { x.textContent = baht(v.revenue); });
  setF(el, 'sl', x => { x.textContent = v.sched.label; }); setF(el, 'sv', x => { x.textContent = v.sched.value; x.className = v.sched.tone; });
  setF(el, 'sb', x => { x.style.width = clamp(v.sched.progress, 0, 1) * 100 + '%'; x.className = v.sched.tone; });
  if (v.contract) {
    const C = v.contract;
    setF(el, 'reg', x => { x.textContent = C.title; }); setF(el, 'ct', x => { x.textContent = `${C.n}/5`; });
    setF(el, 'th', x => { const h = `<span class="up">👍 ${C.up}</span><span class="dn">👎 ${C.down}</span>`; if (x.innerHTML !== h) x.innerHTML = h; });
    setF(el, 'face', x => { const h = face(C.up + C.down ? C.up / (C.up + C.down) : null); if (x.innerHTML !== h) x.innerHTML = h; });
  }
  setF(el, 'st', x => { x.textContent = v.status; });
  setF(el, 'al', x => { x.hidden = !v.alert; });
  setF(el, 'act', x => { if (x.textContent !== v.action.label) x.textContent = v.action.label; x.disabled = !v.action.enabled; x.dataset.kind = v.action.kind; });
}
function svOpenSheet(s) { SV.sheet = s.id; $('#psheet').hidden = false; svRenderSheet(); }
function svCloseSheet() { SV.sheet = null; $('#psheet').hidden = true; const A = svAdapter(); if (A) A.preview(null); }
function svRenderSheet() {
  const A = svAdapter(), s = A && SV.sheet && A.get(SV.sheet);
  if (!s) { svCloseSheet(); return; }
  const v = A.vm(s); if (!v.sheetOpen) { svCloseSheet(); return; }
  $('#psTitle').textContent = v.sheetTitle; $('#psSub').textContent = v.sheetSub;
  const html = A.platforms(s).map(p => `<button class="pcard${p.ok ? '' : ' no'}${p.planned ? ' plan' : ''}" data-pt="${p.n}" ${p.ok ? '' : 'aria-disabled="true"'}><b>${MODE === 'term' ? 'ชานชาลา' : 'ราง'} ${p.n}</b><span class="pc-cl">${[0, 1, 2, 3].map(c => `<i class="${c <= p.max ? 'on' : ''}">${CLS[c]}</i>`).join('')}</span><small>${esc(p.why)}</small></button>`).join('');
  if ($('#psList').dataset.h !== html) { $('#psList').dataset.h = html; $('#psList').innerHTML = html; }
}
$('#liveFilter').addEventListener('click', () => { const i = FILTERS.findIndex(f => f[0] === SV.filter); SV.filter = FILTERS[(i + 1) % FILTERS.length][0]; toast('แสดง: ' + FILTERS[(i + 1) % FILTERS.length][1]); liveRender(true); });
$('#liveList').addEventListener('click', e => { const b = e.target.closest('[data-lv]'); if (b) svSelect(SV.sel === b.dataset.lv ? null : b.dataset.lv); });
$('#tcard').addEventListener('click', e => {
  const A = svAdapter(), s = A && SV.sel && A.get(SV.sel); if (!s) return;
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.tc === 'close') { svSelect(null); return; }
  if (b.dataset.tc === 'follow') { A.follow(s); return; }
  if (b.dataset.tc === 'info' && A.info) { A.info(s); return; }
  if (b.dataset.f === 'act') { if (b.dataset.kind === 'sheet') svOpenSheet(s); else A.act(s, b.dataset.kind); liveRender(true); }
});
$('#psClose').addEventListener('click', svCloseSheet);
$('#psList').addEventListener('pointerover', e => { const b = e.target.closest('[data-pt]'), A = svAdapter(); if (b && A && !b.classList.contains('no')) A.preview(+b.dataset.pt, A.get(SV.sheet)); });
$('#psList').addEventListener('pointerleave', () => { const A = svAdapter(); if (A) A.preview(null); });
$('#psList').addEventListener('click', e => {
  const b = e.target.closest('[data-pt]'), A = svAdapter(); if (!b || !A || !SV.sheet) return;
  const s = A.get(SV.sheet), n = +b.dataset.pt; if (!s) return;
  const p = A.platforms(s).find(x => x.n === n);
  if (!p || !p.ok) { toast(`ราง ${n}: ${p ? p.why : ''}`); A.preview(null); return; }
  if (A.choose(s, n)) svCloseSheet();
  liveRender(true);
});
setInterval(() => { if (!state) return; liveRender(); }, 300);
