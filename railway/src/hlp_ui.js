// =================== Hua Lamphong: train classes, origins, contracts and view helpers ===================
const CLS = 'ABCD';
// consist length class: A ≤4 vehicles, B ≤6, C ≤8, D 9–10; platforms 1–6 take D, 7–10 take C, 11–14 take B
const trainClass = s => { const n = s.kind === 'LH' ? 1 + s.coaches : s.cars + 2; return n <= 4 ? 0 : n <= 6 ? 1 : n <= 8 ? 2 : 3; };
const platClass = T => (T <= 6 ? 3 : T <= 10 ? 2 : 1);
const ORIG_CODE = { 'นครสวรรค์': 'NSN', 'บ้านตาคลี': 'BTK', 'ตะพานหิน': 'TPH', 'สุรินทร์': 'SUR', 'อรัญประเทศ': 'ARN', 'จุกเสม็ด': 'CSM', 'ชุมทางบ้านภาชี': 'BPC', 'ชุมทางแก่งคอย': 'KKY', 'เชียงใหม่': 'CMI', 'อุบลราชธานี': 'UBN', 'หนองคาย': 'NKI', 'สุไหงโก-ลก': 'SGK', 'ชุมทางหาดใหญ่': 'HDY', 'พิษณุโลก': 'PLK', 'สุราษฎร์ธานี': 'SNI', 'ตรัง': 'TRG', 'ศิลาอาสน์': 'SLA',
  'ลพบุรี': 'LBR', 'อยุธยา': 'AYA', 'ฉะเชิงเทรา': 'CCO', 'ราชบุรี': 'RBR', 'ปราจีนบุรี': 'PCB', 'นครปฐม': 'NPT', 'บ้านภาชี': 'BPC', 'แก่งคอย': 'KKY', 'หัวหิน': 'HHN', 'กาญจนบุรี': 'KAN' };
const ROUTE_REGION = { NSN: 'สายเหนือ', BTK: 'สายเหนือ', TPH: 'สายเหนือ', SUR: 'สายอีสาน', ARN: 'สายตะวันออก', CSM: 'สายตะวันออก', CMI: 'สายเหนือ', PLK: 'สายเหนือ', SLA: 'สายเหนือ', LBR: 'สายเหนือ', AYA: 'สายเหนือ', BPC: 'สายเหนือ', UBN: 'สายอีสาน', NKI: 'สายอีสาน', KKY: 'สายอีสาน',
  SGK: 'สายใต้', HDY: 'สายใต้', SNI: 'สายใต้', TRG: 'สายใต้', RBR: 'สายใต้', NPT: 'สายใต้', HHN: 'สายใต้', KAN: 'สายตะวันตก', CCO: 'สายตะวันออก', PCB: 'สายตะวันออก' };
const origCode = s => ORIG_CODE[s.from] || ORIG_CODE[String(s.from).split(' ')[0]] || 'SPC';
const LOCO_T = ['GEK', 'ALS', 'HID', 'ALS'], DMU_T = ['THN', 'NKF', 'APD', 'ASR'];
const svcType = s => s.ty || (s.ty = (s.kind === 'LH' ? LOCO_T : DMU_T)[Math.floor(Math.random() * 4)]);
const needsLift = s => !!(s.tasks ? s.tasks.lift : s.lift);
const svcRev = s => { const late = Math.max(0, (Math.max(tstate.now, s.phase === 'dwell' || s.phase === 'departing' ? tstate.now : s.schedDep) - s.schedDep) / 60); return Math.round(Math.max(1000, Math.round((s.kind === 'LH' ? 12000 : 7000) - late * 400)) * (s.special ? 2 : 1)); };
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

// ---------- Hua Lamphong view helpers (used by the HLP station adapter in station_view.js) ----------
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
