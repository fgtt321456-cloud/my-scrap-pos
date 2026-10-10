
// =================== UI: drawer, toolbar, timeline ===================
let MODE = 'net';
const ICONS = {
  overview: '<path d="M4 13h4v7H4zM10 8h4v12h-4zM16 4h4v16h-4z"/>',
  trains: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M9 21l-2 0M15 21h2M8 17l-2 4M16 17l2 4"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/>',
  stations: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/>',
  contracts: '<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4M10 12h6M10 16h6"/>',
  depot: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  coop: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14 15.5c.9-.3 1.9-.5 3-.5 2.5 0 4 1.5 4 4"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  ping: '<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  timeline: '<path d="M4 6h16M4 12h10M4 18h13"/>',
  nx: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M6 10h4l3 4h5M6 14h3"/>',
  tsvc: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 11h14M8 17l-2 4M16 17l2 4"/>',
  trelay: '<rect x="8" y="2" width="8" height="14" rx="2"/><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="11" r="1.6"/><path d="M12 16v6"/>',
  tcrew: '<circle cx="12" cy="7" r="3"/><path d="M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"/>',
};
const TOOLS = {
  net: [['timeline', 'ตาราง'], ['overview', 'ภาพรวม'], ['trains', 'ขบวนรถ'], ['stations', 'สถานี/ราง'], ['contracts', 'สัญญา'], ['depot', 'อู่ซ่อม'], ['coop', 'Co-op'], ['map', 'แผนที่ 2D'], ['ping', 'ส่งสัญญาณ']],
  term: [['timeline', 'ตาราง'], ['tsvc', 'ขบวนรถ'], ['trelay', 'อาณัติ'], ['tcrew', 'ทีมงาน'], ['nx', 'แผง NX'], ['ping', 'ส่งสัญญาณ']],
};
const DRAWER_TITLE = { overview: 'ภาพรวม', trains: 'ขบวนรถ', stations: 'สถานีและเส้นทาง', contracts: 'สัญญาว่าจ้าง', depot: 'ศูนย์ซ่อมบำรุง', coop: 'เล่นร่วมกัน (Co-op)', tsvc: 'ขบวนรถในสถานี', trelay: 'อาณัติสัญญาณ', tcrew: 'ทีมงานและผลงาน' };
let drawerTab = null;
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ''}</svg>`;
function renderToolbar() {
  const tb = $('#toolbar');
  tb.innerHTML = TOOLS[MODE].map(([k, l]) => `<button data-tool="${k}" class="${k === 'timeline' ? 'only-narrow' : ''}">${icon(k)}<span>${l}</span><em class="badge" data-badge="${k}" hidden></em></button>`).join('');
  RT.toolbarDirty = true;
}
function syncToolbar() {
  document.querySelectorAll('#toolbar [data-tool]').forEach(b => {
    const k = b.dataset.tool;
    let on = drawerTab === k && $('#panel').classList.contains('open');
    if (k === 'map') on = MAP2D.on;
    if (k === 'nx') on = !$('#nx').classList.contains('collapsed');
    if (k === 'timeline') on = $('#tl').classList.contains('show');
    if (k === 'ping') on = !$('#emotePal').hidden;
    b.setAttribute('aria-pressed', String(on));
  });
  const offers = state.contracts.filter(c => c.status === 'offer').length;
  setBadge('contracts', offers, false);
  setBadge('depot', state.trains.filter(t => !offLine(t) && t.cond < 30).length, true);
  setBadge('coop', typeof coopBadge === 'function' ? coopBadge() : 0, true);
  document.querySelectorAll('#toolbar [data-tool]').forEach(b => b.classList.toggle('min', b.dataset.tool === minTab && !$('#panel').classList.contains('open')));
}
function setBadge(k, n, urgent) { const b = document.querySelector(`[data-badge="${k}"]`); if (b) { b.hidden = !n; b.textContent = n; b.classList.toggle('urgent', !!urgent); } }
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('[data-tool]'); if (!b) return;
  const k = b.dataset.tool;
  if (k === 'map') { setMap2d(!MAP2D.on); }
  else if (k === 'ping') { $('#emotePal').hidden = !$('#emotePal').hidden; }
  else if (k === 'timeline') { $('#tl').classList.toggle('show'); }
  else if (k === 'nx') { $('#nx').classList.toggle('collapsed'); }
  else if (k === 'fleet') openFleet();
  else if (k === 'contracts') openContracts();
  else if (k === 'sinfo' || k === 'sboard' || k === 'screw') stnTool(k);
  else if (k === 'gs') openGS();
  else if (k === 'plan') openPlanner();
  else if (k === 'ctrl') openCtrlModal();
  else if (drawerTab === k && $('#panel').classList.contains('open')) closeDrawer();
  else openDrawer(k);
  syncToolbar();
});
function openDrawer(tab) {
  minTab = null;
  if (tab) {
    drawerTab = tab;
    if (MODE === 'net') document.querySelectorAll('#netPanel [data-body]').forEach(b => { b.hidden = b.dataset.body !== tab; });
    else tSwitchTabRaw(tab);
    $('#drawerTitle').textContent = DRAWER_TITLE[tab] || '';
    if (tab === 'coop' && typeof coopRender === 'function') coopRender();
    if (tab === 'contracts') RT.contractsDirty = true;
  }
  $('#panel').classList.add('open'); $('#app').classList.add('drawer-open');
  if (narrow()) $('#tl').classList.remove('show');
  syncToolbar();
}
function closeDrawer() { $('#panel').classList.remove('open'); $('#app').classList.remove('drawer-open'); syncToolbar(); }
$('#drawerClose').addEventListener('click', closeDrawer);
$('#tlClose').addEventListener('click', () => { $('#tl').classList.remove('show'); syncToolbar(); });

// ---------- left timeline (net) ----------
const gameMin = simSec => Math.max(0, Math.round(simSec * 1440 / DAY_LEN));
function trainStatus(tr) {
  if (tr.leasedOut) return ['ให้เพื่อนเช่า', 'mute', 0];
  if (tr.rescue) return ['ไปช่วยเพื่อน', 'warn', 1 - tr.rescue.t / 25];
  if (tr.depot) return [tr.depot.wait ? 'รอคิวอู่' : 'อยู่ในอู่ซ่อม', 'mute', tr.depot.wait ? 0 : 1 - tr.depot.t / tr.depot.dur];
  if (tr.broken) return [tr.repair > 0 ? 'กำลังซ่อม' : 'ขัดข้อง · แตะประแจ', tr.repair > 0 ? 'mute' : 'act', 0];
  if (tr.cond < 30 && !tr.leased) return ['ต้องเข้าอู่', 'act', 0];
  const rl = RT.lines[tr.line]; if (!rl) return ['—', 'mute', 0];
  const [s0, s1] = stopPoints(tr), legLen = Math.max(1, s1 - s0);
  if (tr.st === 'unload' || tr.st === 'load') {
    const here = trainEnds(tr)[0];
    return [SMAP[here].type === 'T' && !TIERS[tr.tier].pp && tr.st === 'load' ? 'สับหลีกหัวรถจักร' : 'จอดรับส่ง', 'mute', 0];
  }
  if (tr.holding) return ['รอชานชาลา', 'warn', clamp(tr.leg / legLen, 0, 1)];
  if (tr.blocked) return ['รอสัญญาณ', 'warn', clamp(tr.leg / legLen, 0, 1)];
  return ['กำลังวิ่ง', 'good', clamp(tr.leg / legLen, 0, 1)];
}
function etaOf(tr) {
  if (offLine(tr)) { if (tr.depot && !tr.depot.wait) return `เสร็จใน ${gameMin(tr.depot.t)} นาที`; if (tr.leasedOut) return 'ระหว่างเช่า'; return ''; }
  if (tr.st === 'run') { const [s0, s1] = stopPoints(tr), rem = Math.abs((tr.dir > 0 ? s1 : s0) - tr.s); return `ถึงใน ${gameMin(rem / vMax(tr) + 1)} นาที`; }
  return `ออกใน ${gameMin(tr.timer + (tr.st === 'unload' ? 2.6 : 0))} นาที`;
}
let tlSig = '';
function renderTimeline() {
  if (MODE !== 'net') return;
  const list = state.trains.slice().sort((a, b) => (offLine(a) - offLine(b)) || a.name.localeCompare(b.name));
  const sig = list.map(t => t.id + t.tier).join(',');
  const body = $('#tlBody');
  if (sig !== tlSig || RT.tlDirty) {
    tlSig = sig; RT.tlDirty = false;
    body.innerHTML = list.map(t => `<button class="tl-row${sel && sel.id === t.id ? ' sel' : ''}" data-id="${t.id}">
      <i class="tier" style="--c:${TIERS[t.tier].color}"></i>
      <span class="tl-main"><span class="tl-top"><b>${esc(t.name)}</b><span class="tl-eta num" data-f="eta"></span></span>
      <span class="tl-route" data-f="route"></span><span class="bar"><i data-f="bar"></i></span></span>
      <span class="pill" data-f="st"></span></button>`).join('') || '<p class="info">ยังไม่มีขบวนรถ ซื้อได้จากแถบเครื่องมือ "ขบวนรถ"</p>';
  }
  for (const row of body.querySelectorAll('.tl-row')) {
    const tr = trainById(row.dataset.id); if (!tr) continue;
    const [label, cls, p] = trainStatus(tr), [a, b] = trainEnds(tr);
    setF(row, 'st', el => { if (el.textContent !== label) el.textContent = label; el.className = 'pill ' + cls; });
    setF(row, 'eta', el => { el.textContent = etaOf(tr); });
    setF(row, 'route', el => { el.textContent = offLine(tr) ? `${TIERS[tr.tier].name} · สาย ${lineName(lineById(tr.line))}` : (tr.st === 'run' ? `${SMAP[tr.origin || a].name.replace(/\(.*\)/, '')} → ${SMAP[b].name.replace(/\(.*\)/, '')}` : `ที่ ${SMAP[a].name.replace(/\(.*\)/, '')} → ${SMAP[b].name.replace(/\(.*\)/, '')}`); });
    setF(row, 'bar', el => { el.style.width = (p * 100) + '%'; el.className = cls; });
  }
}
$('#tlBody').addEventListener('click', e => { const r = e.target.closest('.tl-row'); if (!r) return; const tr = trainById(r.dataset.id); if (!tr) return; select({ type: 'train', id: tr.id }); if (!offLine(tr)) cam.follow = tr.id; });

// ---------- drawer content (net) ----------
let buyTier = 'THN', buyKind = 'P';
function tierCard(k) {
  const T = TIERS[k], un = state.tiers[k], p = clamp(state.stats.lifetime / Math.max(1, T.unlock), 0, 1);
  return `<button class="tiercard${buyTier === k ? ' on' : ''}${un ? '' : ' locked'}" data-tier="${k}" ${un ? '' : 'aria-disabled="true"'}>
    <span class="tc-head"><i style="--c:${T.color}"></i><b>${T.full}</b><span class="chip">T${T.tier}</span></span>
    <span class="tc-desc">${T.desc}</span>
    <span class="tc-stats num"><span>${baht(T.price)}</span><span>${Math.round(T.v * 18)} กม./ชม.</span><span>${T.kinds.includes('P') ? T.capP + ' คน/ตู้' : ''}${T.kinds.length > 1 ? ' · ' : ''}${T.kinds.includes('C') ? T.capC + ' ตัน/ตู้' : ''}</span></span>
    ${un ? '' : `<span class="tc-lock">ปลดล็อกเมื่อรายได้สะสมถึง ${baht(T.unlock)}<span class="bar"><i style="width:${p * 100}%"></i></span></span>`}
  </button>`;
}
function refreshStatic() {
  // buy form
  const bl = $('#buyLine'), cur = bl.value;
  bl.innerHTML = state.lines.map(l => `<option value="${l.id}">${esc(SMAP[l.a].name)} – ${esc(SMAP[l.b].name)} (${state.trains.filter(t => t.line === l.id && !offLine(t)).length}/${maxTrainsOn(l)})</option>`).join('') || '<option value="">ยังไม่มีเส้นทาง</option>';
  if (state.lines.some(l => l.id === cur)) bl.value = cur;
  $('#tierPick').innerHTML = TIER_LIST.map(tierCard).join('');
  // line form
  const opts = STATIONS.filter(d => state.stations[d.id].unlocked).map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  for (const id of ['#lineA', '#lineB']) { const s = $(id), v = s.value; s.innerHTML = opts; if ([...s.options].some(o => o.value === v)) s.value = v; }
  if ($('#lineA').value === $('#lineB').value && $('#lineB').options.length > 1) $('#lineB').selectedIndex = 1;
  // train list
  $('#trainList').innerHTML = state.trains.map(tr => {
    const l = lineById(tr.line), T = TIERS[tr.tier];
    return `<article class="card" data-id="${tr.id}">
      <header><i class="tier" style="--c:${T.color}"></i><b>${esc(tr.name)}</b><span class="chip" style="--c:${l ? l.color : '#999'}">${l ? lineName(l) : '—'}</span><span class="pill" data-f="st"></span></header>
      <div class="meta"><span>${T.full}</span><span>${tr.kind === 'P' ? (T.fareMul > 1 ? 'ผู้โดยสาร (ตั๋ว ×' + T.fareMul + ')' : 'ผู้โดยสาร') : 'สินค้า'}</span><span data-f="cars"></span><span data-f="daily"></span>${tr.leased ? '<span class="chip">เช่าจากเพื่อน</span>' : ''}</div>
      <div class="meter"><div class="lbl"><span>บรรทุก</span><b data-f="load"></b></div><div class="bar ${tr.kind === 'C' ? 'cargo' : ''}"><i data-f="loadbar"></i></div></div>
      <div class="meter"><div class="lbl"><span>ความพร้อม (cooldown)</span><b data-f="cond"></b></div><div class="bar cond" data-f="condwrap"><i data-f="condbar"></i></div></div>
      <div class="acts">
        <button data-a="follow">ติดตาม</button>
        <button data-a="repair" class="danger" data-f="rep"></button>
        <button data-a="rescue" class="primary" data-f="resc">ขอเพื่อนช่วยลาก</button>
        <button data-a="depot" data-f="dep"></button>
        <button data-a="car" data-f="car"></button>
        ${tr.leased ? '' : '<button data-a="lease" data-f="lease"></button><button data-a="sell" class="ghost">ขาย</button>'}
      </div></article>`;
  }).join('') || '<p class="info">ยังไม่มีขบวนรถ</p>';
  // line list
  $('#lineList').innerHTML = state.lines.map(l => `<li><span class="chip" style="--c:${l.color}">${lineName(l)}</span><span>${fmt(lineKm(l))} กม. · ทางหลีก ${l.loops || 0} · รับ ${maxTrainsOn(l)} ขบวน</span><button data-loop="${l.id}" ${(l.loops || 0) >= 2 ? 'disabled' : ''}>${(l.loops || 0) >= 2 ? 'ทางหลีกครบ' : 'เพิ่มทางหลีก ' + baht(loopCost(l))}</button></li>`).join('') || '<li class="info">ยังไม่มีเส้นทาง</li>';
  // station list
  $('#stationList').innerHTML = STATIONS.map(d => {
    const st = state.stations[d.id], ls = stationLines(d.id);
    if (!st.unlocked) return `<article class="card locked" data-id="${d.id}"><header><span class="stype t-${d.type}"></span><b>${esc(d.name)}</b><span class="pill mute">ยังไม่เปิด</span></header>
      <div class="meta"><span>${TYPE_LABEL[d.type]}</span><span>${d.plat} ชานชาลา</span><span>ผู้โดยสาร ${d.pax}/วิ</span><span>สินค้า ${d.cargo} ตัน/วิ</span></div>
      <div class="acts"><button class="primary" data-s="unlock" data-f="unlock">เปิดสถานี ${baht(d.cost)}</button></div></article>`;
    return `<article class="card" data-id="${d.id}"><header><span class="stype t-${d.type}"></span><b>${esc(d.name)}</b><span class="pill" data-f="lvl"></span></header>
      <div class="meta"><span>${TYPE_LABEL[d.type]}</span><span data-f="plat"></span>${ls.map(l => `<span class="chip" style="--c:${l.color}">${lineName(l)}</span>`).join('') || '<span>ยังไม่มีราง</span>'}</div>
      <div class="info">${d.type === 'T' ? 'ปลายทาง: ขบวนหัวรถจักรต้องสับหลีกก่อนตีกลับ ใช้เวลาจอดนานขึ้น' : d.type === 'J' ? 'ชุมทาง: ชานชาลาจำกัด รถด่วนได้เข้าชานชาลาก่อน' : 'ICD: โกดังตู้สินค้า ขนได้เฉพาะขบวนหัวรถจักร (AD24C/QSY) ระดับสูงขึ้นยกตู้ไวขึ้น'}</div>
      ${d.type !== 'I' ? `<div class="meter"><div class="lbl"><span>ผู้โดยสารรอ</span><b data-f="pax"></b></div><div class="bar"><i data-f="paxbar"></i></div></div>` : ''}
      <div class="meter"><div class="lbl"><span>${d.type === 'I' ? 'ตู้สินค้าในโกดัง (ตัน)' : 'สินค้ารอ (ตัน)'}</span><b data-f="cargo"></b></div><div class="bar cargo"><i data-f="cargobar"></i></div></div>
      <div class="acts"><button data-s="upgrade" data-f="upg"></button><button data-s="plat" data-f="platb"></button><button data-s="view">ดูบนแผนที่</button>${d.id === 'BKK' ? '<button data-s="term" class="primary">เปิดสถานีหัวลำโพง</button>' : ''}</div></article>`;
  }).join('');
  $('#depotLevel').textContent = state.depot.level;
  RT.goalsDirty = true; RT.chartDirty = true; RT.contractsDirty = true; RT.tlDirty = true;
  if (sel) { const c = document.querySelector(`#netPanel .card[data-id="${sel.id}"]`); if (c) c.classList.add('sel'); }
  updateForms(); updateUI();
}
$('#tierPick').addEventListener('click', e => {
  const b = e.target.closest('[data-tier]'); if (!b) return;
  const k = b.dataset.tier; if (!state.tiers[k]) { toast(`${TIERS[k].full} ยังไม่ปลดล็อก`); return; }
  buyTier = k; if (!TIERS[k].kinds.includes(buyKind)) buyKind = TIERS[k].kinds[0];
  $('#tierPick').innerHTML = TIER_LIST.map(tierCard).join(''); updateForms();
});
document.querySelectorAll('#buyKind button').forEach(b => b.addEventListener('click', () => { if (!TIERS[buyTier].kinds.includes(b.dataset.k)) return; buyKind = b.dataset.k; updateForms(); }));
function updateForms() {
  const T = TIERS[buyTier];
  document.querySelectorAll('#buyKind button').forEach(x => { x.setAttribute('aria-pressed', String(x.dataset.k === buyKind)); x.disabled = !T.kinds.includes(x.dataset.k); });
  const l = lineById($('#buyLine').value), bi = $('#buyInfo'), bb = $('#buyBtn');
  if (!l) { bi.textContent = 'สร้างเส้นทางก่อนในหน้าสถานี/ราง'; bi.className = 'info err'; bb.disabled = true; }
  else {
    const n = state.trains.filter(t => t.line === l.id && !offLine(t)).length, full = n >= maxTrainsOn(l);
    const icdBad = buyKind === 'P' && (SMAP[l.a].type === 'I' && SMAP[l.b].type === 'I');
    bi.className = 'info' + (full || icdBad ? ' err' : '');
    bi.textContent = full ? `เส้นทางนี้รับได้ ${maxTrainsOn(l)} ขบวน สร้างทางหลีกเพื่อเพิ่ม` : icdBad ? 'สองปลายเป็น ICD แทบไม่มีผู้โดยสาร ควรใช้รถสินค้า' : `${T.full} · 2 ตู้ · ${fmt(lineKm(l))} กม. · ค่าดูแล ${baht(T.maint + 500)}/วัน · น้ำมัน ฿${T.fuel}/กม.`;
    bb.disabled = full || state.money < T.price || !state.tiers[buyTier];
    bb.textContent = `ซื้อ ${T.name} ${buyKind === 'P' ? 'ผู้โดยสาร' : 'สินค้า'} ${baht(T.price)}`;
  }
  const ev = evalLineCached(true), li = $('#lineInfo'), lb = $('#lineBtn');
  li.className = 'info' + (ev.ok ? '' : ' err');
  li.textContent = ev.ok ? `รางคู่ ${fmt(ev.km)} กม. · ค่าก่อสร้าง ${baht(ev.cost)}` : ev.reason;
  lb.disabled = !ev.ok || state.money < ev.cost; lb.textContent = ev.ok ? `วางรางคู่ ${baht(ev.cost)}` : 'วางรางคู่';
}
let evCache = { k: '', v: { ok: false } };
function evalLineCached(force) { const k = $('#lineA').value + $('#lineB').value + state.lines.length + Object.values(state.stations).filter(s => s.unlocked).length; if (force || evCache.k !== k) evCache = { k, v: evalLine($('#lineA').value, $('#lineB').value) }; return evCache.v; }
$('#buyLine').addEventListener('change', updateForms); $('#lineA').addEventListener('change', updateForms); $('#lineB').addEventListener('change', updateForms);
$('#buyBtn').addEventListener('click', () => { const tr = buyTrain($('#buyLine').value, buyTier, buyKind); if (tr) { refreshStatic(); select({ type: 'train', id: tr.id }); } });
$('#lineBtn').addEventListener('click', () => { const l = addLine($('#lineA').value, $('#lineB').value); if (l) { refreshStatic(); toast(`วางรางเสร็จ ซื้อขบวนรถเพื่อเปิดเดินรถสาย ${lineName(l)}`); } });
$('#lineList').addEventListener('click', e => { const b = e.target.closest('[data-loop]'); if (b) addLoop(b.dataset.loop); });
$('#trainList').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]');
  if (!b) { const c = e.target.closest('.card'); if (c) select({ type: 'train', id: c.dataset.id }); return; }
  const tr = trainById(b.closest('.card').dataset.id); if (tr) trainAction(b.dataset.a, tr);
});
$('#stationList').addEventListener('click', e => {
  const c = e.target.closest('.card'); if (!c) return;
  const id = c.dataset.id, b = e.target.closest('button[data-s]');
  if (!b) { select({ type: 'station', id }); return; }
  const a = b.dataset.s;
  if (a === 'unlock') unlockStation(id);
  if (a === 'upgrade') upgradeStation(id);
  if (a === 'plat') addPlatform(id);
  if (a === 'term') setMode('term');
  if (a === 'view') { const d = SMAP[id]; setMap2d(false); cam.tx = d.x; cam.tz = d.z; cam.follow = null; select({ type: 'station', id }); if (narrow()) closeDrawer(); }
});
// contracts
function renderContracts() {
  const card = c => {
    const unit = c.kind === 'P' ? 'คน' : 'ตัน', from = SMAP[c.from].name, to = SMAP[c.to].name;
    const left = c.status === 'active' ? `เหลือ ${c.deadline - state.day + 1} วัน` : c.status === 'offer' ? `ข้อเสนอหมดอายุวันที่ ${c.expires}` : c.status === 'done' ? 'สำเร็จ' : 'ล้มเหลว';
    return `<article class="card contract ${c.status}" data-cid="${c.id}">
      <header>${c.cls ? `<span class="ccls c-${c.cls}">${CCLASS[c.cls].name}</span>` : ''}<span class="chip">${c.kind === 'P' ? 'ผู้โดยสาร' : 'สินค้า'}</span><b>${esc(from)} → ${esc(to)}</b><span class="pill ${c.status === 'done' ? 'good' : c.status === 'failed' ? 'bad' : c.status === 'active' ? 'warn' : 'mute'}">${left}</span></header>
      <div class="meta"><span>ขน ${fmt(c.amount)} ${unit}</span><span>ภายใน ${c.days} วัน</span><span class="num reward">${baht(c.reward)}</span></div>
      ${c.status === 'active' ? `<div class="meter"><div class="lbl"><span>ความคืบหน้า</span><b>${fmt(c.progress)} / ${fmt(c.amount)}</b></div><div class="bar"><i style="width:${c.progress / c.amount * 100}%"></i></div></div><p class="info">ต้องขนจาก${esc(from)}ไปลงที่${esc(to)} ด้วยรถ${c.kind === 'P' ? 'โดยสาร' : 'สินค้า'}บนสายที่เชื่อมสองสถานีนี้</p>` : ''}
      ${c.status === 'offer' ? '<div class="acts"><button class="primary" data-accept="' + c.id + '">รับสัญญา</button></div>' : ''}
    </article>`;
  };
  const offers = state.contracts.filter(c => c.status === 'offer'), act = state.contracts.filter(c => c.status !== 'offer');
  $('#offerList').innerHTML = offers.map(card).join('') || '<p class="info">นายหน้า AI จะส่งข้อเสนอใหม่ทุกวัน เมื่อมีเส้นทางเปิดให้บริการ</p>';
  $('#activeList').innerHTML = act.map(card).join('') || '<p class="info">ยังไม่มีสัญญาที่รับไว้</p>';
  $('#repInfo').innerHTML = contractClassStrip() + `ชื่อเสียง <b class="num">${Math.round(state.rep)}</b>/100 · ค่าตอบแทน ×${repMul().toFixed(2)} · ข้อเสนอใหญ่ขึ้นเมื่อชื่อเสียงสูง`;
}
$('#offerList').addEventListener('click', e => { const b = e.target.closest('[data-accept]'); if (b) { acceptContract(b.dataset.accept); renderContracts(); } });
// depot
function renderDepot() {
  const D = DEPOT[state.depot.level], nx = DEPOT[state.depot.level + 1];
  $('#depotInfo').innerHTML = `<div><span>ระดับ</span><b class="num">${state.depot.level}</b></div><div><span>ช่องซ่อม</span><b class="num">${D.bays}</b></div><div><span>ความเร็ว</span><b class="num">×${D.speed}</b></div><div><span>ค่าซ่อม</span><b class="num">×${D.cost}</b></div>`;
  const up = $('#depotUp'); up.hidden = !nx; if (nx) { up.textContent = `อัปเกรดเป็นระดับ ${state.depot.level + 1} ${baht(nx.up)}`; up.disabled = state.money < nx.up; }
  $('#depotAuto').setAttribute('aria-pressed', String(state.depot.auto));
  const list = state.trains.filter(t => t.depot || (!offLine(t) && t.cond < 60)).sort((a, b) => (b.depot ? 1 : 0) - (a.depot ? 1 : 0) || a.cond - b.cond);
  $('#depotList').innerHTML = list.map(t => {
    const d = t.depot;
    return `<li><i class="tier" style="--c:${TIERS[t.tier].color}"></i><span><b>${esc(t.name)}</b> · ${d ? (d.wait ? 'รอคิวช่องซ่อม' : `ซ่อมอยู่ เหลือ ${gameMin(d.t)} นาที`) : `ความพร้อม ${Math.round(t.cond)}%`}</span>
      ${d ? `<span class="bar"><i style="width:${d.wait ? 0 : (1 - d.t / d.dur) * 100}%"></i></span>` : `<button data-depot="${t.id}" ${t.leased ? 'disabled' : ''}>ส่งเข้าอู่ ${baht(depotCost(t))}</button>`}</li>`;
  }).join('') || '<li class="info">ทุกขบวนพร้อมใช้งาน</li>';
}
$('#depotUp').addEventListener('click', () => { const nx = DEPOT[state.depot.level + 1]; if (!nx || !spend(nx.up)) return; state.depot.level++; log(`อัปเกรดศูนย์ซ่อมบำรุงเป็นระดับ ${state.depot.level}`); renderDepot(); });
$('#depotAuto').addEventListener('click', () => { state.depot.auto = !state.depot.auto; renderDepot(); });
$('#depotList').addEventListener('click', e => { const b = e.target.closest('[data-depot]'); if (b) { const t = trainById(b.dataset.depot); if (t) sendToDepot(t, false); renderDepot(); } });

// ---------- status bar + periodic UI ----------
function updateStatus() {
  $('#sMoney').textContent = baht(state.money); $('#sMoney').classList.toggle('neg', state.money < 0);
  $('#sClock').textContent = `วันที่ ${state.day} · ${clockStr(state.t)}`;
  $('#sOnTime').textContent = state.stats.legs ? Math.round(state.stats.onTimeLegs / state.stats.legs * 100) + '%' : '—';
  $('#sRep').textContent = '★'.repeat(Math.max(1, Math.round(state.rep / 20))) + ' ' + Math.round(state.rep);
  const nextT = TIER_LIST.find(k => !state.tiers[k]);
  $('#sTier').textContent = nextT ? `${TIERS[nextT].name} ${Math.floor(clamp(state.stats.lifetime / TIERS[nextT].unlock, 0, 1) * 100)}%` : 'ครบทุก Tier';
  const ec = $('#eventChip'); ec.hidden = MODE !== 'net' || !state.event; if (state.event) ec.textContent = state.event.text;
}
function updateUI() {
  updateStatus();
  checkUnlocks();
  if (RT.staticDirty) { RT.staticDirty = false; refreshStatic(); return; }
  document.querySelectorAll('#trainList .card').forEach(card => {
    const tr = trainById(card.dataset.id); if (!tr) return;
    const [label, cls] = trainStatus(tr), cap = capOf(tr) || 1, T = TIERS[tr.tier];
    setF(card, 'st', el => { el.textContent = label; el.className = 'pill ' + cls; });
    setF(card, 'cars', el => { el.textContent = `${tr.cars} ตู้`; });
    setF(card, 'daily', el => { el.textContent = tr.leased ? `แบ่งรายได้ 30% ให้เจ้าของ` : `ค่าดูแล ${baht(trainDailyCost(tr))}/วัน`; });
    setF(card, 'load', el => { el.textContent = `${fmt(tr.load)} / ${fmt(cap)} ${tr.kind === 'P' ? 'คน' : 'ตัน'}`; });
    setF(card, 'loadbar', el => { el.style.width = (tr.load / cap * 100) + '%'; });
    setF(card, 'cond', el => { el.textContent = Math.round(tr.cond) + '%'; });
    setF(card, 'condbar', el => { el.style.width = tr.cond + '%'; });
    setF(card, 'condwrap', el => el.classList.toggle('low', tr.cond < 35));
    setF(card, 'rep', el => { el.hidden = !tr.broken; el.textContent = tr.repair > 0 ? 'กำลังซ่อม…' : `ส่งทีมซ่อม ${baht(6000)}`; el.disabled = tr.repair > 0 || state.money < 6000; });
    setF(card, 'resc', el => { el.hidden = !tr.broken || tr.repair > 0 || !(typeof coopReady === 'function' && coopReady()); el.disabled = !!tr.rescueReq; el.textContent = tr.rescueReq ? 'รอเพื่อนตอบรับ…' : 'ขอเพื่อนช่วยลาก'; });
    setF(card, 'dep', el => { el.textContent = tr.depot ? 'อยู่ในอู่' : `ส่งเข้าอู่ ${baht(depotCost(tr))}`; el.disabled = offLine(tr) || !!tr.leased || tr.cond >= 99 || state.money < depotCost(tr); });
    setF(card, 'car', el => { el.textContent = tr.cars >= T.maxCars ? 'ตู้ครบแล้ว' : `+1 ตู้ ${baht(CAR_PRICE)}`; el.disabled = tr.cars >= T.maxCars || state.money < CAR_PRICE || !!tr.leased; });
    setF(card, 'lease', el => { el.textContent = tr.leasedOut ? 'กำลังถูกเช่า' : tr.leasable ? 'ปิดให้เช่า' : 'เปิดให้เพื่อนเช่า'; el.disabled = !!tr.leasedOut; el.setAttribute('aria-pressed', String(!!tr.leasable)); });
  });
  document.querySelectorAll('#stationList .card').forEach(card => {
    const d = SMAP[card.dataset.id], st = state.stations[d.id], cap = stationCap(st);
    setF(card, 'unlock', el => { el.disabled = state.money < d.cost; });
    setF(card, 'lvl', el => { el.textContent = `ระดับ ${st.level}`; el.className = 'pill'; });
    setF(card, 'plat', el => { const occ = state.trains.filter(t => t.plat === d.id && !offLine(t)).length; el.textContent = `ชานชาลา ${occ}/${platformsOf(d.id)}`; });
    setF(card, 'pax', el => { el.textContent = `${fmt(st.pax)} / ${fmt(cap)}`; });
    setF(card, 'paxbar', el => { el.style.width = (st.pax / cap * 100) + '%'; });
    setF(card, 'cargo', el => { el.textContent = `${fmt(st.cargo)} / ${fmt(cap)}`; });
    setF(card, 'cargobar', el => { el.style.width = (st.cargo / cap * 100) + '%'; });
    setF(card, 'upg', el => { el.textContent = st.level >= 3 ? 'ความจุเต็มระดับ' : `ขยายความจุ ${baht(upgradeCost(st))}`; el.disabled = st.level >= 3 || state.money < upgradeCost(st); });
    setF(card, 'platb', el => { el.textContent = st.plat >= 3 ? 'ชานชาลาครบ' : `+1 ชานชาลา ${baht(platCost(st))}`; el.disabled = st.plat >= 3 || state.money < platCost(st); });
  });
  const l = lineById($('#buyLine').value);
  if (l) $('#buyBtn').disabled = state.trains.filter(t => t.line === l.id && !offLine(t)).length >= maxTrainsOn(l) || state.money < TIERS[buyTier].price || !state.tiers[buyTier];
  const ev = evalLineCached(); $('#lineBtn').disabled = !ev.ok || state.money < ev.cost;
  checkGoals();
  if (RT.goalsDirty) { RT.goalsDirty = false; renderGoals(); }
  if (RT.chartDirty) { RT.chartDirty = false; renderChart(); }
  if (RT.logDirty) { RT.logDirty = false; renderLog(); }
  if (drawerTab === 'contracts' && (RT.contractsDirty || Math.random() < 0.25)) { RT.contractsDirty = false; renderContracts(); }
  if (drawerTab === 'depot') renderDepot();
  renderTimeline(); syncToolbar();
}
function renderGoals() { $('#goals').innerHTML = GOALS.map(g => `<li class="${state.goals[g.id] ? 'done' : ''}"><span class="ck"></span><span>${g.text}</span><span class="rw">+${baht(g.reward)}</span></li>`).join(''); }
function renderLog() { $('#log').innerHTML = state.log.slice(0, 14).map(e => `<li class="${e.kind}"><time>ว.${e.d} ${e.t}</time><span>${esc(e.text)}</span></li>`).join('') || '<li><time></time><span>ยังไม่มีบันทึก</span></li>'; }
function renderChart() {
  const days = state.stats.history.slice(-6).concat([{ day: state.day, rev: state.stats.revToday, cost: state.stats.costToday, live: true }]);
  const W2 = 320, H = 140, pl = 40, pb = 20, pt = 8, max = Math.max(10000, ...days.map(d => Math.max(d.rev, d.cost)));
  const nice = Math.ceil(max / 10000) * 10000, sy = v => H - pb - (v / nice) * (H - pb - pt), bw = (W2 - pl - 8) / 7;
  let s = `<svg viewBox="0 0 ${W2} ${H}" role="img" aria-label="กราฟรายได้และค่าใช้จ่ายรายวัน">`;
  [0, 0.5, 1].forEach(f => { const y = sy(nice * f); s += `<line x1="${pl}" x2="${W2 - 4}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-dasharray="${f ? '3 3' : '0'}"/><text x="${pl - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="var(--muted)" font-family="IBM Plex Mono, monospace">${f ? fmt(nice * f / 1000) + 'k' : '0'}</text>`; });
  days.forEach((d, i) => {
    const x = pl + 4 + i * bw, w = bw * 0.36;
    s += `<rect x="${x}" y="${sy(d.rev)}" width="${w}" height="${Math.max(0, H - pb - sy(d.rev))}" rx="2" fill="var(--chart-a)" opacity="${d.live ? 0.55 : 1}"/>`;
    s += `<rect x="${x + w + 2}" y="${sy(d.cost)}" width="${w}" height="${Math.max(0, H - pb - sy(d.cost))}" rx="2" fill="var(--chart-b)" opacity="${d.live ? 0.55 : 0.9}"/>`;
    s += `<text x="${x + w + 1}" y="${H - 5}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.live ? 'วันนี้' : 'ว.' + d.day}</text>`;
  });
  $('#chart').innerHTML = s + '</svg>';
}
setInterval(() => { RT.chartDirty = true; }, 3000);

// ---------- confirm dialog ----------
let confirmFn = null;
function ask(text, fn) { $('#confirmText').textContent = text; confirmFn = fn; $('#confirm').hidden = false; $('#confirmYes').focus(); }
$('#confirmNo').addEventListener('click', () => { $('#confirm').hidden = true; confirmFn = null; });
$('#confirmYes').addEventListener('click', () => { $('#confirm').hidden = true; const f = confirmFn; confirmFn = null; if (f) f(); });
$('#resetBtn').addEventListener('click', () => ask('เริ่มเกมเครือข่ายใหม่? ความคืบหน้าทั้งหมดจะถูกลบ', () => { boot(null); toast('เริ่มเกมใหม่แล้ว'); }));

// ---------- weekly thermal receipt ----------
const INC_LBL = { pax: 'ค่าโดยสาร', cargo: 'ค่าขนส่งสินค้า', bonus: 'โบนัสตรงเวลา', contract: 'สัญญา/เป้าหมาย', coop: 'Co-op (เช่า/กู้ภัย/ส่งไม้ต่อ)', term: 'สถานีหัวลำโพง' };
const EXP_LBL = { fuel: 'ค่าเชื้อเพลิง', maint: 'ค่าบำรุงรักษาขบวน', staff: 'ค่าพนักงานสถานี', depot: 'ศูนย์ซ่อม/ซ่อมฉุกเฉิน', penalty: 'ค่าปรับล่าช้า', capex: 'ลงทุน (รถ/ราง/อัปเกรด)' };
let receiptPrevSpeed = 1;
function showReceipt(wk) {
  const inc = Object.values(wk.inc).reduce((a, b) => a + b, 0), exp = Object.values(wk.exp).reduce((a, b) => a + b, 0), net = inc - exp;
  const row = (l, v, neg) => `<div class="r-row"><span>${l}</span><i></i><b>${neg ? '-' : ''}${fmt(Math.abs(v))}</b></div>`;
  const now = new Date();
  $('#receiptPaper').innerHTML = `
    <div class="r-head"><b>RAILTRACK THAILAND</b><span>ใบสรุปผลประกอบการ</span><span>สัปดาห์ที่ ${wk.n} · วันที่ ${wk.day}–${wk.day + 6}</span></div>
    <div class="r-rule"></div>
    <div class="r-sec">รายรับ</div>${Object.keys(INC_LBL).filter(k => wk.inc[k]).map(k => row(INC_LBL[k], wk.inc[k])).join('') || row('—', 0)}
    <div class="r-row r-sub"><span>รวมรายรับ</span><i></i><b>${fmt(inc)}</b></div>
    <div class="r-sec">รายจ่าย</div>${Object.keys(EXP_LBL).filter(k => wk.exp[k]).map(k => row(EXP_LBL[k], wk.exp[k], true)).join('') || row('—', 0)}
    <div class="r-row r-sub"><span>รวมรายจ่าย</span><i></i><b>-${fmt(exp)}</b></div>
    <div class="r-rule"></div>
    <div class="r-row r-net ${net < 0 ? 'loss' : ''}"><span>${net >= 0 ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}</span><i></i><b>${net < 0 ? '-' : ''}฿${fmt(Math.abs(net))}</b></div>
    <div class="r-rule"></div>
    ${row('เที่ยววิ่งทั้งหมด', wk.legs)}${row('ตรงเวลา', wk.legs ? Math.round(wk.onTime / wk.legs * 100) : 0)}
    <div class="r-row"><span>ชื่อเสียง</span><i></i><b>${Math.round(wk.rep0)} → ${Math.round(state.rep)}</b></div>
    <div class="r-row"><span>เงินทุนคงเหลือ</span><i></i><b>${fmt(state.money)}</b></div>
    <div class="r-bar" aria-hidden="true"></div>
    <div class="r-foot">${now.toLocaleDateString('th-TH')} · ขอบคุณที่ใช้บริการรถไฟไทย</div>`;
  receiptPrevSpeed = state.speed || 1; state.speed = 0; updateSpeedSeg();
  const r = $('#receipt'); r.hidden = false; r.classList.remove('print'); void r.offsetWidth; r.classList.add('print');
  sfxCounter(30);
  $('#receiptOk').focus();
}
$('#receiptOk').addEventListener('click', () => { $('#receipt').hidden = true; state.speed = receiptPrevSpeed; updateSpeedSeg(); });

// ---------- speed + sound ----------
const speedObj = () => (MODE === 'term' ? tstate : MODE === 'stn' ? stnState() : state);
document.querySelectorAll('[data-sp]').forEach(b => b.addEventListener('click', () => { speedObj().speed = +b.dataset.sp; updateSpeedSeg(); }));
function updateSpeedSeg() { const o = speedObj(); if (!o) return; document.querySelectorAll('[data-sp]').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.sp === o.speed))); }
$('#soundBtn').addEventListener('click', () => { state.sound = !state.sound; $('#soundBtn').setAttribute('aria-pressed', String(state.sound)); if (state.sound) { audio(); sfxCoin(); } });

// ---------- emotes (visual ping) ----------
const EMOTES = {
  clock: { label: 'รอสักครู่ / ล่าช้า', svg: '<circle cx="12" cy="12" r="9" fill="#f5b400"/><path d="M12 7v5l3 2" stroke="#13294b" stroke-width="2.2" fill="none" stroke-linecap="round"/>' },
  ok: { label: 'รับทราบ', svg: '<circle cx="12" cy="12" r="9" fill="#14a37f"/><path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  go: { label: 'ปล่อยรถได้', svg: '<circle cx="12" cy="12" r="9" fill="#2f6bff"/><path d="M8 12h8M13 8l4 4-4 4" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' },
  help: { label: 'ช่วยด้วย', svg: '<circle cx="12" cy="12" r="9" fill="#d33b3b"/><path d="M12 7v6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="12" cy="16.5" r="1.5" fill="#fff"/>' },
  thanks: { label: 'ขอบคุณ', svg: '<circle cx="12" cy="12" r="9" fill="#e2556b"/><path d="M12 16.5s-4-2.5-4-5a2.2 2.2 0 0 1 4-1.3 2.2 2.2 0 0 1 4 1.3c0 2.5-4 5-4 5z" fill="#fff"/>' },
};
$('#emotePal').innerHTML = Object.entries(EMOTES).map(([k, e]) => `<button data-emote="${k}" title="${e.label}"><svg viewBox="0 0 24 24">${e.svg}</svg><span>${e.label}</span></button>`).join('') + '<p class="info" id="emoteHint">เลือกสถานีก่อน ไอคอนจะปักที่สถานีนั้น</p>';
$('#emotePal').addEventListener('click', e => {
  const b = e.target.closest('[data-emote]'); if (!b) return;
  const sid = sel && sel.type === 'station' ? sel.id : null;
  if (typeof coopSendPing === 'function') coopSendPing(b.dataset.emote, sid); else showEmote(b.dataset.emote, sid, 'คุณ');
  $('#emotePal').hidden = true; syncToolbar();
});
const EMO = [];
function showEmote(kind, sid, who) {
  const e = EMOTES[kind]; if (!e) return;
  const el = domPool.get('emote', () => document.createElement('div'));
  el.className = 'emote'; el.innerHTML = `<svg viewBox="0 0 24 24">${e.svg}</svg><span></span>`; el.querySelector('span').textContent = `${who}: ${e.label}`;
  $('#emotes').appendChild(el); EMO.push({ el, sid, t: performance.now() });
  sfxPing();
}
function updateEmotes() {
  const now = performance.now(), w = canvas.clientWidth, h = canvas.clientHeight; let stack = 0;
  for (let i = EMO.length - 1; i >= 0; i--) {
    const m = EMO[i], age = (now - m.t) / 1000;
    if (age > 5) { m.el.remove(); domPool.put('emote', m.el); EMO.splice(i, 1); continue; }
    let x = w / 2, y = 70 + stack++ * 46;
    if (m.sid && MODE === 'net') { const d = SMAP[m.sid]; if (MAP2D.on) { const q = map2dPt(d.x, d.z); x = q.x; y = q.y - 30; } else { tmpV.set(d.x, 9, d.z).project(camera); x = (tmpV.x + 1) / 2 * w; y = (1 - tmpV.y) / 2 * h; } }
    m.el.style.transform = `translate(${x}px, ${y - Math.min(age, 0.3) * 30}px) translate(-50%, -100%)`;
    m.el.style.opacity = String(Math.min(1, (5 - age) * 1.5));
  }
}
