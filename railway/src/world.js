// =================== Network link: one world clock, a delay ledger, real timetable trains on the Thailand map ===================
// The timetable stations (KRT, CMI, NKI, UBN, HDY) share WORLD.now. A station you leave falls behind and is
// caught up by its duty crew when you return. A real train that leaves one player station late carries the
// delay (partly recovered en route) to the next player station on its run, keyed by train number + start day.
// Hua Lamphong keeps its own clock: it runs ordinary/commuter trains that are not in the long-distance timetable.
const WORLD_SAVE = 'railtrack-world-v1';
const WORLD_NET_RATE = 120;     // world seconds per real second on the network map at 1×
const WORLD = { v: 1, now: 6 * 3600, ledger: {} };
function worldLoad() { try { const o = JSON.parse(localStorage.getItem(WORLD_SAVE)); if (o && o.v === 1) Object.assign(WORLD, o); } catch (e) {} }
function worldSave() { try { localStorage.setItem(WORLD_SAVE, JSON.stringify(WORLD)); } catch (e) {} }

// ---------- delay ledger ----------
/** Start day of a timetable run for an event on `day`: an event earlier in the day than the departure belongs to yesterday's run. */
const runDay = (e, day) => (e.t >= e.dep ? day : day - 1);
const ledgerKey = (no, dday) => no + '#' + dday;
function ledgerPut(no, dday, min, at) {
  WORLD.ledger[ledgerKey(no, dday)] = { min: Math.max(0, Math.round(min)), at, t: WORLD.now };
  const old = WORLD.now - 3 * 86400; for (const k in WORLD.ledger) if (WORLD.ledger[k].t < old) delete WORLD.ledger[k];
}
const ledgerGet = (no, dday) => WORLD.ledger[ledgerKey(no, dday)];
/** Upstream delay recovered en route: about 15% plus 2 minutes of timetable slack. */
const recover = min => Math.max(0, Math.round(min * 0.85 - 2));
/** Resolve a service's inbound delay once, about two hours before it is due: the ledger first, else a random roll. */
function worldResolveDelay(S, s) {
  s.dly = 1;
  if (s.mode === 'orig') return;    // starts here from the depot: no inbound delay
  let d = 0;
  const L = s.real && s.no ? ledgerGet(s.no, s.dday) : null;
  if (L && L.at !== S.id) { d = recover(L.min); s.delaySrc = L.at; }
  else d = rollDelay(s.schedArr);
  if (d) { s.inDelay = d; s.eta = s.schedArr + d * 60; slog(S, `${s.name} แจ้งล่าช้าจากต้นทาง ${d} นาที${s.delaySrc ? ` (จาก${ttName(s.delaySrc)})` : ''}`, 'bad'); }
}
/** Record a real train leaving a player station, so the stations further down its run inherit the delay. */
function worldRecordDeparture(S, s, lateMin) { if (s.real && s.no && s.mode !== 'term') ledgerPut(s.no, s.dday, lateMin, S.id); }

// ---------- catch-up when re-entering a station ----------
/** Bring a station that was left behind up to WORLD.now: the duty crew handles every train that would have finished. */
function worldCatchUp(S) {
  const T = WORLD.now; if (S.now >= T - 60) { WORLD.now = Math.max(WORLD.now, S.now); return 0; }
  if (T - S.now > 2 * 86400) { S.now = T - 86400; S.services = []; S.genDay = -1; }   // long absence: replay the last day only
  for (let day = Math.floor(S.now / 86400); day <= Math.floor(T / 86400) + (T % 86400 > 20 * 3600 ? 1 : 0); day++) if (S.genDay < day) stnGenDay(S, day);
  let n = 0, rev = 0;
  S.services = S.services.filter(s => {
    if (s.schedDep + 600 >= T || s.phase === 'gone') return true;
    const late = rollDelay(s.schedDep);
    if (s.real && s.no && s.mode !== 'term' && !ledgerGet(s.no, s.dday)) ledgerPut(s.no, s.dday, late, S.id);
    S.stats.dep++; if (late <= 3) S.stats.onTime++; rev += Math.round(s.rev * 0.5); n++;
    return false;
  });
  S.now = T;
  for (const k of ['lockE', 'lockW']) if (!S.services.some(s => s.lock === k && ['entering', 'departing'].includes(s.phase))) S[k] = 0;
  if (n) { S.stats.rev += rev; earn(rev, 'term'); slog(S, `ระหว่างที่ไม่อยู่ ทีมเวรจัดการ ${n} ขบวน (รายได้ครึ่งหนึ่ง ${baht(rev)})`); toast(`ทีมเวรจัดการ ${n} ขบวนระหว่างที่ไม่อยู่ · +${baht(rev)}`); }
  return n;
}
function worldTick(raw) {
  if (MODE === 'stn') { const S = stnState(); if (S) WORLD.now = Math.max(WORLD.now, S.now); }
  else if (MODE === 'net') WORLD.now += raw * WORLD_NET_RATE * (state.speed || 0);
}

// ---------- real timetable trains on the 2D map ----------
const TT_LINE_COL = { N: '#d4572a', NE: '#2f7fd1', S: '#2a9d6a' };
const TT_PATHS = {};
function ttPath(a, b) {
  const k = a + '>' + b; if (TT_PATHS[k] !== undefined) return TT_PATHS[k];
  const P = railPath(a, b); if (!P || P.length < 2) return (TT_PATHS[k] = null);
  const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z));
  return (TT_PATHS[k] = { P, cum, len: cum[cum.length - 1] });
}
function ttAt(R, f) {
  const s = clamp(f, 0, 1) * R.len; let i = 0; while (i < R.cum.length - 2 && R.cum[i + 1] < s) i++;
  const a = R.P[i], b = R.P[i + 1], u = (s - R.cum[i]) / ((R.cum[i + 1] - R.cum[i]) || 1);
  return { x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, tx: b.x - a.x, tz: b.z - a.z };
}
/** Real trains running at WORLD.now: [{ t, dday, f, delay, x, z, tx, tz }]. */
function ttRunning(now = WORLD.now) {
  const out = [], day = Math.floor(now / 86400);
  for (const t of TT) {
    if (t.no === '45') continue;
    const dep = toSec(t.dep), arr0 = toSec(t.arr), arr = arr0 < dep ? arr0 + 86400 : arr0, R = ttPath(t.from, t.to); if (!R) continue;
    for (const dday of [day - 1, day]) {
      const L = ledgerGet(t.no, dday), delay = L ? recover(L.min) : 0, start = dday * 86400 + dep + delay * 60, end = dday * 86400 + arr + delay * 60;
      if (now < start || now > end) continue;
      const f = (now - start) / (end - start), p = ttAt(R, f);
      out.push(Object.assign({ t, dday, f, delay }, p));
    }
  }
  return out;
}
function drawTTTrains(g, C) {
  const run = ttRunning(), k = MAP2D.view.k;
  g.textAlign = 'center';
  for (const r of run) {
    const q = map2dPt(r.x, r.z), col = TT_LINE_COL[r.t.line] || C.fg;
    const a = Math.atan2(r.tz, r.tx);
    g.save(); g.translate(q.x, q.y); g.rotate(a);
    g.fillStyle = col; g.strokeStyle = C.panel; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(8, 0); g.lineTo(4, -4); g.lineTo(-7, -4); g.lineTo(-7, 4); g.lineTo(4, 4); g.closePath(); g.fill(); g.stroke();
    g.restore();
    if (k >= 1.2 || r.delay) { g.font = `600 10px ${cssVar('--f-mono')}`; g.fillStyle = r.delay > 3 ? C.bad : C.fg; g.fillText(`${r.t.no}${r.delay > 3 ? ` +${r.delay}′` : ''}`, q.x, q.y - 8); }
    MAP2D.hit.push({ type: 'tt', id: r.t.no + '#' + r.dday, x: q.x, y: q.y, r: 10, info: r });
  }
  // world clock badge (top-right of the map)
  const w = $('#map2d').clientWidth;
  g.textAlign = 'right'; g.font = `600 12px ${cssVar('--f-mono')}`; g.fillStyle = C.fg;
  g.fillText(`เวลาเครือข่าย ${hm(WORLD.now)} · ขบวนจริงกำลังวิ่ง ${run.length}`, w - 72, narrow() ? 132 : 84);
  g.textAlign = 'left';
}
function ttHitInfo(hit) {
  const r = hit.info, t = r.t, ETA = toSec(t.arr) + r.delay * 60;
  toast(`${t.cls} ${t.no} ${ttName(t.from)} → ${ttName(t.to)} · ${Math.round(r.f * 100)}% ของเส้นทาง · ถึง ${hm(ETA)}${r.delay ? ` (ช้า ${r.delay} นาที)` : ' ตรงเวลา'}`);
}
worldLoad();
