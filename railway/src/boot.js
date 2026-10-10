
// =================== mode switch, save/load, main loop ===================
function setMode(m, quiet) {
  MODE = m;
  if (m === 'net') setMap2d(true);
  if (m === 'stn') setMap2d(false);
  if (typeof stnShowUI === 'function') stnShowUI(m === 'stn');
  if (m === 'term') { tBuildScene(); if (!TRT.nxE) nxBuild(); if (!$('#dmi').firstChild) dmiBuild(); setMap2d(false); }
  cam = m === 'term' ? camTerm : m === 'stn' ? camStn : camNet; VIEW = cam.view;
  $('#app').classList.toggle('mode-term', m === 'term'); $('#app').classList.toggle('mode-net', m === 'net'); $('#app').classList.toggle('mode-stn', m === 'stn');
  document.querySelectorAll('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  $('#netStatus').hidden = m !== 'net'; $('#termStatus').hidden = m !== 'term';
  $('#nx').hidden = m !== 'term'; $('#dmi').hidden = m !== 'term' || !TRT.sel;
  if ($('#zoneBar')) $('#zoneBar').hidden = m !== 'term'; if (typeof areaHud === 'function' && state) areaHud();
  $('#netPanel').hidden = m !== 'net'; $('#termPanel').hidden = m !== 'term';
  $('#tlBody').hidden = m !== 'net'; $('#tArrivals').hidden = m !== 'term';
  $('#tlTitle').textContent = m === 'net' ? 'ตารางเดินรถ' : 'กำลังจะเข้าหัวลำโพง';
  $('#eventChip').hidden = m !== 'net' || !state.event;
  clearPops(); closeDrawer(); renderToolbar(); resize(); updateSpeedSeg(); tlSig = '';
  RT.preview = null; RT.routeFrom = null; renderRouteCard(); minTab = null;
  if (m === 'term' && !TRT.nxInit) { TRT.nxInit = true; $('#nx').classList.add('collapsed'); }
  try { if (m !== 'stn') localStorage.setItem('railtrack-mode', m); } catch (e) {}
  if (m === 'term') {
    computeOcc(); tUpdateUI();
    if (!tstate.hinted && !quiet) { tstate.hinted = true; toast('ชานเมืองที่ราง 13 พร้อมออกแล้ว: กดสามเหลี่ยม S13 แล้วกด "ออก" บนแผง NX'); }
  } else updateUI();
  syncToolbar();
}
document.querySelectorAll('#modeSeg button').forEach(b => b.addEventListener('click', () => { if (b.dataset.mode !== MODE) setMode(b.dataset.mode); }));

const NET_CENTER = { x: 0, y: 0, z: 0 };
$('#tutBtn').addEventListener('click', () => { state.tut = null; state.stats.legs = Math.min(state.stats.legs, 40); closeDrawer(); tutStart(); });
const SAVE_KEY = 'railtrack-th-v2';
function save() { try { metaSave(); stnSave(); localStorage.setItem(SAVE_KEY, JSON.stringify(state, (k, v) => (k === 'rescueReq' ? undefined : v))); if (tstate) localStorage.setItem(TSAVE_KEY, tSerialize()); } catch (e) {} }
function loadSaved() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.v === 2 && s.stations && Array.isArray(s.lines) && ['BKK', 'BPC', 'CMI'].every(id => s.stations[id])) {
    STATIONS.forEach(d => { if (!s.stations[d.id]) s.stations[d.id] = { unlocked: false, level: 1, plat: 0, pax: 0, cargo: 0 }; });
    for (const k in s.stations) if (!SMAP[k]) delete s.stations[k];
    s.lines = s.lines.filter(l => SMAP[l.a] && SMAP[l.b] && railPath(l.a, l.b));
    return s;
  } } catch (e) {} return null; }
function clearWorld() {
  for (const id of Object.keys(RT.trains)) removeTrainMesh(id);
  [stationRoot, lineRoot].forEach(g => { while (g.children.length) g.remove(g.children[0]); });
  pickables.length = 0; RT.lines = {}; RT.trains = {}; RT.stations = {}; RT.platQ = {};
  DECOR.trees.forEach(t => { t.hidden = false; }); DECOR.houses.forEach(h => { h.hidden = false; });
}
function boot(saved) {
  clearWorld(); sel = null;
  if (saved) {
    state = saved;
    STATIONS.forEach(d => makeStation(d));
    state.lines.forEach(l => buildTrack(l));
    state.trains = state.trains.filter(t => RT.lines[t.line] && !t.leased);
    state.contracts = state.contracts.filter(c => SMAP[c.from] && SMAP[c.to]);
    state.trains.forEach(t => { t.rescueReq = null; const [s0, s1] = stopPoints(t); if (t.s < s0 - 0.01 || t.s > s1 + 0.01) placeOnLine(t); makeTrain(t); if (offLine(t)) RT.trains[t.id].group.visible = false; });
  } else {
    state = newState();
    STATIONS.forEach(d => makeStation(d));
    const l = addLine('BKK', 'BPC', true);
    buyTrain(l.id, 'THN', 'P', true);
    log('เปิดเดินรถสายแรก กรุงเทพ (หัวลำโพง) – ชุมทางบ้านภาชี', 'good');
    genContracts();
  }
  writeDecor(); updateSpeedSeg(); refreshStatic();
  renderGoals(); renderLog(); renderChart();
  $('#soundBtn').setAttribute('aria-pressed', String(state.sound));
}
let last = performance.now(), uiAcc = 0, saveAcc = 0, tSec = 0;
function frame(now) {
  const raw = Math.min(0.1, (now - last) / 1000); last = now; tSec += raw;
  worldTick(raw);
  if (MODE === 'stn') stnFrame(raw);
  else if (MODE === 'term') {
    let rem = raw * tstate.speed * TRATE;
    while (rem > 1e-6) { const d = Math.min(0.25, rem); tStep(d); rem -= d; }
    tVisuals(raw); tFxUpdate(tSec, raw); fxRender(tScene);
    uiAcc += raw; if (uiAcc > 0.25) { uiAcc = 0; tUpdateUI(); updateStatus(); syncToolbar(); }
  } else {
    let rem = raw * state.speed;
    while (rem > 1e-6) { const d = Math.min(0.05, rem); simStep(d); rem -= d; }
    if (MAP2D.on) { cam.az += (cam.azT - cam.az) * Math.min(1, raw * 6); drawMap2d(tSec); updatePops(raw); updateEmotes(); }
    else { updateVisuals(raw); applyDayNight(state.t / DAY_LEN * 24, scene, hemi, sun, NET_CENTER, 170, NET_LAMPS); netBillboards(tSec); updatePreview(tSec); fxRender(scene); }
    uiAcc += raw; if (uiAcc > 0.25) { uiAcc = 0; updateUI(); }
  }
  if (MODE === 'term') updateEmotes();
  tutTick();
  perfTick(raw);
  saveAcc += raw; if (saveAcc > 5) { saveAcc = 0; save(); }
  requestAnimationFrame(frame);
}
window.addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
window.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea')) return;
  if (e.key === 'Escape') { closeDrawer(); $('#emotePal').hidden = true; }
});
applySceneTheme();
try { matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySceneTheme); } catch (e) {}
new MutationObserver(applySceneTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function start(data) {
  boot((data && data.state) || loadSaved());
  tstate = (data && data.tstate) || tLoad();
  if (!tstate) tScenario();
  tWireUI();
  renderToolbar();
  try { window.claude && window.claude.hot && window.claude.hot.snapshot && window.claude.hot.snapshot(() => ({ state: JSON.parse(JSON.stringify(state)), tstate: JSON.parse(tSerialize()) })); } catch (e) {}
  let m = 'net'; try { m = localStorage.getItem('railtrack-mode') || m; } catch (e) {}
  if (location.hash === '#hualamphong') m = 'term';
  setMode(m, true);
  fxSetQuality(state.quality || (narrow() ? 'eco' : 'high'));
  if (!narrow()) $('#tl').classList.add('show');
  metaBoot();
  resize(); syncToolbar();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { RT.labelsDirty = true; themeVer++; });
  coopInit();
  setInterval(metaTick, 1000);
  requestAnimationFrame(t => { last = t; frame(t); });
}
if (location.hash.startsWith('#rtdebug')) window.__rt = { meta: () => M_(), gainXP, openFleet, openPlanner, openCtrlModal, metaPick, stnEnter, perf: () => Object.assign({ fps: PERF.ema, q: FX.quality, px: renderer.getPixelRatio() }, renderer.info.render, { geo: renderer.info.memory.geometries, tex: renderer.info.memory.textures }), thumb: (c, w, h) => trainThumb(c, w, h), stn: () => stnState(), stnReset: id => { STN.st[id] = stnNew(id); }, exportData: () => rtExport(), exportTrains: () => rtExportTrains(), world: () => WORLD, ttRunning: n => ttRunning(n), catchUp: () => worldCatchUp(stnState()), rush: rushFactor, rain: wxRain, stnStep: dt => stnStep(stnState(), dt), stnRelease: s => stnRelease(stnState(), s), openGS, openContracts, genOffer, stars: () => [netStars(), termStars()], tStep, simStep, get t() { return tstate; }, get s() { return state; }, setMode, computeOcc, showReceipt, setMap2d, openDrawer, pool: () => ({ made: meshPool.made, reused: meshPool.reused }), hit: () => MAP2D.hit, heldRect: () => worldRect(termHeldPos()), platRect: () => worldRect(termPlatformPos()), readyRect: () => worldRect(termReadyPos()), routes: () => tstate.routes.map(r => r.kind + ':' + r.state), fx: () => ({ q: FX.quality, composer: !!FX.composer, lamp: FX.lamp }) };
const hot = window.claude && window.claude.hot;
if (hot && hot.ready) hot.ready(start); else start((hot && hot.data) || {});
})();
