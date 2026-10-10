
// =================== UX: auto-minimising panels, route building on the 2D map, previews ===================
let minTab = null;
/** Called when the player starts working the map: panels shrink to icons so the map gets the screen. */
function fxMapInteract() {
  if (TUT.active) return;
  if ($('#panel').classList.contains('open') && drawerTab) { minTab = drawerTab; closeDrawer(); }
  $('#emotePal').hidden = true;
  const tl = $('#tl');
  if (tl.classList.contains('show')) { if (narrow()) tl.classList.remove('show'); else tl.classList.add('rail'); }
  if (MODE === 'term') $('#nx').classList.add('collapsed');
  syncToolbar();
}
$('#tl').addEventListener('click', e => { const tl = $('#tl'); if (tl.classList.contains('rail')) { tl.classList.remove('rail'); e.stopPropagation(); e.preventDefault(); } }, true);
canvas.addEventListener('pointerdown', () => { RT.gestureMin = false; });
let lastWheelMin = 0;
canvas.addEventListener('wheel', () => { const t = performance.now(); if (t - lastWheelMin > 600) { lastWheelMin = t; fxMapInteract(); } }, { passive: true });

// ----- 2D network map: tap station A, tap station B, see the route glow, confirm -----
function setSel(s) { sel = s; RT.tlDirty = true; }
function map2dClick(hit) {
  if (!hit) { RT.routeFrom = null; RT.preview = null; setSel(null); renderRouteCard(); return; }
  if (hit.type === 'train') { select({ type: 'train', id: hit.id }); return; }
  const st = state.stations[hit.id];
  if (!st.unlocked) { RT.routeFrom = null; RT.preview = null; select({ type: 'station', id: hit.id }); renderRouteCard(); return; }
  if (RT.routeFrom && RT.routeFrom !== hit.id) { RT.preview = { a: RT.routeFrom, b: hit.id }; RT.routeFrom = null; }
  else { RT.routeFrom = hit.id; RT.preview = null; }
  setSel({ type: 'station', id: hit.id });
  renderRouteCard();
}
function renderRouteCard() {
  const card = $('#routeCard');
  if (RT.preview) {
    const { a, b } = RT.preview, ev = evalLine(a, b);
    $('#rcTitle').textContent = `${SMAP[a].name} → ${SMAP[b].name}`;
    $('#rcInfo').textContent = ev.ok ? `รางคู่ ${fmt(ev.km)} กม. · ค่าก่อสร้าง ${baht(ev.cost)}` : ev.reason;
    $('#rcInfo').className = ev.ok ? '' : 'err';
    const ok = $('#rcOk'); ok.hidden = !ev.ok; ok.disabled = !ev.ok || state.money < ev.cost; if (ev.ok) ok.textContent = `ยืนยันวางราง ${baht(ev.cost)}`;
    card.hidden = false;
  } else if (RT.routeFrom) {
    $('#rcTitle').textContent = `ต้นทาง: ${SMAP[RT.routeFrom].name}`;
    $('#rcInfo').textContent = 'แตะสถานีปลายทางเพื่อดูแนวรางก่อนยืนยัน'; $('#rcInfo').className = '';
    $('#rcOk').hidden = true; card.hidden = false;
  } else card.hidden = true;
}
$('#rcCancel').addEventListener('click', () => { RT.preview = null; RT.routeFrom = null; renderRouteCard(); });
$('#rcOk').addEventListener('click', () => {
  if (!RT.preview) return;
  const l = addLine(RT.preview.a, RT.preview.b);
  if (l) { RT.preview = null; refreshStatic(); toast(`วางรางเสร็จ ซื้อขบวนรถเพื่อเปิดเดินรถสาย ${lineName(l)}`); sfxCoin(); }
  renderRouteCard();
});
/** Glowing, flowing dotted route line on the 2D map (proposed rail or selected line). */
function drawPreview2d(g, time) {
  const P = previewPath();
  if (RT.routeFrom) { const d = SMAP[RT.routeFrom], q = map2dPt(d.x, d.z); g.strokeStyle = PAL.yellow; g.lineWidth = 3; g.beginPath(); g.arc(q.x, q.y, 16 + Math.sin(time * 5) * 2, 0, 7); g.stroke(); }
  if (!P) return;
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = 'rgba(255,194,14,0.9)'; g.shadowBlur = 14;
  g.strokeStyle = PAL.yellow; g.lineWidth = 5; g.setLineDash([2, 12]); g.lineDashOffset = -time * 40;
  g.beginPath(); P.pts.forEach((p, i) => { const q = map2dPt(p.x, p.z); if (i) g.lineTo(q.x, q.y); else g.moveTo(q.x, q.y); }); g.stroke();
  g.restore();
}
$('#qualityBtn').addEventListener('click', () => fxSetQuality(FX.quality === 'high' ? 'eco' : 'high'));

// =================== Onboarding: focus mask for the first minutes (core loop in 4 steps) ===================
const TUT = { active: false, i: 0, t0: 0, clicked: false, trains0: 0, dep0: 0, shownAt: 0 };
const tmpP = new THREE.Vector3();
function worldRect(p, r = 34) {
  if (!p) return null;
  tmpP.set(p.x, p.y, p.z).project(camera);
  const cr = canvas.getBoundingClientRect();
  const x = cr.left + (tmpP.x + 1) / 2 * cr.width, y = cr.top + (1 - tmpP.y) / 2 * cr.height;
  return { left: x - r, top: y - r, width: r * 2, height: r * 2 };
}
const termHeldPos = () => { const c = heldConsist(); if (!c || tstate.routes.some(r => r.from === 'HA')) return null; const p = pAt(c, c.s - 4); return { x: p.x, y: 9, z: p.z }; };
const termPlatformPos = () => { if (!TRT.assign) return null; for (let T = 1; T <= 14; T++) if (allowedTrack(T)) return { x: 172, y: 3.2, z: TZ(T) }; return null; };
const termReadyPos = () => { const s = tstate.services.find(x => x.phase === 'dwell' && x.state === 'ready' && !tstate.routes.some(r => r.from === 'ST' + x.track)); const c = s && tCons(s.cid); if (!c) return null; const p = pAt(c, c.s - 4); return { x: p.x, y: 9, z: p.z }; };
const TUT_STEPS = [
  { n: 1, mode: 'term', text: 'คุมสถานี: ขบวนที่มีไอคอนสีเหลืองกำลังรอสัญญาณเข้า แตะไอคอนนั้น', world: termHeldPos, wait: 'รอขบวนรถเข้าเขตสถานี…', done: () => TRT.assign || tstate.routes.some(r => r.from === 'HA') },
  { n: 1, mode: 'term', text: 'เลือกชานชาลา: แตะหมายเลขชานชาลาสีเหลือง ระบบจะล็อกประแจ ทางจะเรืองเป็นสีเขียว แล้วเปิดสัญญาณให้', world: termPlatformPos, done: () => tstate.routes.some(r => r.from === 'HA') },
  { n: 2, mode: 'term', text: 'ปล่อยรถ: ขบวนที่มีเครื่องหมายถูกสีเขียวกลับขบวนเสร็จแล้ว แตะเพื่อปล่อยรถ', world: termReadyPos, wait: 'รอขบวนรถพร้อมออก…', done: () => tstate.routes.some(r => r.kind === 'dep') || tstate.stats.dep > TUT.dep0 },
  { n: 3, mode: 'any', text: 'ขยายเครือข่าย: เปิดแผนที่ประเทศไทยเพื่อซื้อขบวนรถและเปิดเส้นทาง', el: () => $('[data-mode="net"]'), done: () => MODE === 'net' },
  { n: 3, mode: 'net', text: 'ซื้อรถ: เปิดเมนู "ขบวนรถ" ที่แถบด้านล่าง', el: () => $('[data-tool="trains"]'), done: () => drawerTab === 'trains' && $('#panel').classList.contains('open') },
  { n: 4, mode: 'net', text: 'เลือกรุ่นรถ เริ่มที่ THN ดีเซลราง (Tier 1) ราคาถูก คืนทุนไว', el: () => $('#tierPick .tiercard'), done: () => TUT.clicked },
  { n: 4, mode: 'net', text: 'เลือกเส้นทางที่ขบวนนี้จะวิ่ง เส้นประสีเหลืองบนแผนที่คือแนวรางจริง', el: () => $('#buyLine'), done: () => TUT.clicked },
  { n: 4, mode: 'net', text: 'กดซื้อ รถจะออกวิ่งรับผู้โดยสารตามแนวรางจริงทันที', el: () => $('#buyBtn'), done: () => state.trains.length > TUT.trains0 },
  { n: 4, mode: 'any', final: true, text: 'เยี่ยม! วงจรหลักคือ คุมสถานี → ปล่อยรถตรงเวลา → ซื้อรถ → เปิดเส้นทาง แตะโลโก้ด้านบนเพื่อกลับไปเลือกสถานีได้ทุกเมื่อ' },
];
document.addEventListener('click', e => { if (!TUT.active) return; const s = TUT_STEPS[TUT.i], el = s && s.el && s.el(); if (el && el.contains(e.target)) TUT.clicked = true; }, true);
function tutStart() {
  if (state.tut === 'done' || state.stats.legs > 40) return;
  TUT.active = true; TUT.i = 0; TUT.t0 = performance.now(); TUT.trains0 = state.trains.length; TUT.dep0 = tstate.stats.dep;
  if (MODE !== 'term') setMode('term', true);
  $('#coach').hidden = false; tutEnter();
}
function tutEnd() { TUT.active = false; state.tut = 'done'; $('#coach').hidden = true; }
function tutEnter() {
  const s = TUT_STEPS[TUT.i]; TUT.clicked = false; TUT.shownAt = performance.now();
  if (s.mode !== 'any' && MODE !== s.mode) setMode(s.mode, true);
  $('#coachStep').textContent = s.final ? 'เสร็จแล้ว' : `ขั้นที่ ${s.n} จาก 4`;
  $('#coachText').textContent = s.text;
  $('#coachNext').hidden = !s.final; $('#coachSkip').hidden = !!s.final;
  const el = s.el && s.el(); revealInDrawer(el);
}
/** Scrolls only the drawer's own list (scrollIntoView would also scroll the locked page layout). */
function revealInDrawer(el) {
  const body = el && el.closest && el.closest('.tab-body'); if (!body) return;
  const r = el.getBoundingClientRect(), br = body.getBoundingClientRect();
  body.scrollTop += (r.top - br.top) - br.height / 2 + r.height / 2;
}
function tutTick() {
  if (!TUT.active) return;
  const sc = document.scrollingElement; if (sc && sc.scrollTop) sc.scrollTop = 0;
  if ($('#app').scrollTop) $('#app').scrollTop = 0; if ($('#main').scrollTop) $('#main').scrollTop = 0;
  { const s0 = TUT_STEPS[TUT.i], e0 = s0 && s0.el && s0.el(); if (e0 && performance.now() - TUT.shownAt < 1500) revealInDrawer(e0); }
  if (performance.now() - TUT.t0 > 5 * 60000) { tutEnd(); return; }
  const s = TUT_STEPS[TUT.i];
  if (!s.final && s.done()) { TUT.i++; tutEnter(); return; }
  let rect = null;
  if (s.el) { const el = s.el(); if (el && el.offsetParent !== null) { const r = el.getBoundingClientRect(); rect = { left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 }; } }
  else if (s.world) {
    const wp = s.world();
    rect = worldRect(wp, narrow() ? 38 : 34);
    // camera assist: bring an offscreen target into view
    const cr = canvas.getBoundingClientRect();
    if (wp && rect && (rect.left < cr.left || rect.top < cr.top || rect.left + rect.width > cr.right || rect.top + rect.height > cr.bottom - 90)) { cam.tx += (wp.x - cam.tx) * 0.12; cam.tz += (wp.z - cam.tz) * 0.12; cam.follow = null; rect = null; }
  }
  const hole = $('#coachHole'), tip = $('#coachTip'), vw = window.innerWidth, vh = window.innerHeight;
  if (rect) {
    hole.hidden = false;
    Object.assign(hole.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    const blk = [['coachT', 0, 0, vw, rect.top], ['coachB', 0, rect.top + rect.height, vw, vh - rect.top - rect.height], ['coachL', 0, rect.top, rect.left, rect.height], ['coachR', rect.left + rect.width, rect.top, vw - rect.left - rect.width, rect.height]];
    blk.forEach(([id, x, y, w, h]) => Object.assign($('#' + id).style, { left: x + 'px', top: y + 'px', width: Math.max(0, w) + 'px', height: Math.max(0, h) + 'px', display: 'block' }));
    const below = rect.top + rect.height + 150 < vh;
    const tw = Math.min(340, vw - 32), tx = clamp(rect.left + rect.width / 2 - tw / 2, 16, vw - tw - 16);
    if (s.world) {   // moving 3D targets: keep the tip (and its skip button) still so it stays easy to tap
      const tw2 = Math.min(360, vw - 32), up = rect.top > vh * 0.42;
      Object.assign(tip.style, { left: (vw - tw2) / 2 + 'px', top: (up ? 76 : vh - 250) + 'px', width: tw2 + 'px' });
    } else Object.assign(tip.style, { left: tx + 'px', top: (below ? rect.top + rect.height + 14 : Math.max(12, rect.top - 14 - tip.offsetHeight)) + 'px', width: tw + 'px' });
    $('#coachText').textContent = s.text;
  } else {
    hole.hidden = true;
    ['coachT', 'coachB', 'coachL', 'coachR'].forEach(id => { $('#' + id).style.display = 'none'; });
    const tw = Math.min(360, vw - 32);
    Object.assign(tip.style, { left: (vw - tw) / 2 + 'px', top: (vh * 0.3) + 'px', width: tw + 'px' });
    $('#coachText').textContent = s.final ? s.text : (s.wait || s.text);
  }
  $('#coach').classList.toggle('dim', !rect && !!s.final);
}
$('#coachSkip').addEventListener('click', tutEnd);
$('#coachNext').addEventListener('click', tutEnd);
