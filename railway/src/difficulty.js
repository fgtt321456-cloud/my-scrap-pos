// =================== Difficulty: rush hours, inbound delays, faults, weather, imperfect automation ===================
// One tuning table shared by Hua Lamphong and the timetable stations (and exported for the Unity port).
// Pressure grows with player level so the first hours stay gentle.
const DIFF = {
  rush: [[6.5, 9, 0.55], [16.5, 19, 0.6]],         // [from h, to h, headway factor]
  delay: { p: 0.22, pLv: 0.012, pMax: 0.45, mean: 7, max: 40 },   // chance a train arrives late (no ledger entry) and the size of the delay
  fault: { p: 0.05, pLv: 0.004, pMax: 0.12, min: 4, max: 11, kinds: ['ประตูขัดข้อง', 'ระบบปรับอากาศขัดข้อง', 'เบรกต้องตรวจซ้ำ', 'รอพนักงานขบวนเปลี่ยนกะ'] },
  rain: { p: 0.3, approach: 0.75, dwellMin: 2, delayP: 0.15 },     // rainy-day share, approach speed factor, extra dwell, extra late chance
  ars: { reactArr: [20, 70], lagDep: [0, 90], pickWrong: 0.1 },    // automation reaction (game s) and the chance ARS takes a worse platform
};
const diffLv = () => { try { return Math.max(1, M_().lv || 1); } catch (e) { return 1; } };
const diffP = o => Math.min(o.pMax, o.p + o.pLv * (diffLv() - 1));
/** Headway factor at hour-of-day h: < 1 during the morning and evening peaks. */
function rushFactor(sec) { const h = (sec / 3600) % 24; for (const [a, b, f] of DIFF.rush) if (h >= a && h < b) return f; return 1; }
const isRush = sec => rushFactor(sec) < 1;
/** Deterministic weather per game day, so every station sees the same sky on the same day. */
function wxRain(sec) { const d = Math.floor(sec / 86400) + 1; const x = Math.sin(d * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x) < DIFF.rain.p; }
/** Random inbound delay in minutes (0 most of the time), larger and likelier in rain. */
function rollDelay(sec) {
  const p = diffP(DIFF.delay) + (wxRain(sec) ? DIFF.rain.delayP : 0);
  if (Math.random() >= p) return 0;
  return Math.min(DIFF.delay.max, Math.max(2, Math.round(-Math.log(1 - Math.random()) * DIFF.delay.mean)));
}
/** A fault at dwell start: [text, extra minutes] or null. */
function rollFault() { if (Math.random() >= diffP(DIFF.fault)) return null; return [pickOne(DIFF.fault.kinds), rint(DIFF.fault.min, DIFF.fault.max)]; }
const arsReact = () => rint(DIFF.ars.reactArr[0], DIFF.ars.reactArr[1]);
const arsLag = () => rint(DIFF.ars.lagDep[0], DIFF.ars.lagDep[1]);
