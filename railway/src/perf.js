// =================== Performance: FPS overlay, automatic quality fallback ===================
const PERF = { ema: 60, slow: 0, shown: false, auto: true, ultra: false, acc: 0, el: null };
try { const p = JSON.parse(localStorage.getItem('railtrack-perf') || '{}'); PERF.shown = !!p.shown || location.hash.startsWith('#rtdebug'); PERF.auto = p.auto !== false; } catch (e) {}
function perfSave() { try { localStorage.setItem('railtrack-perf', JSON.stringify({ shown: PERF.shown, auto: PERF.auto })); } catch (e) {} }
function perfOverlay() {
  if (!PERF.el) { PERF.el = document.createElement('div'); PERF.el.id = 'perfHud'; $('#stage').appendChild(PERF.el); }
  PERF.el.hidden = !PERF.shown;
}
/** Called once per frame with the real frame time. Steps graphics down when the device cannot keep up. */
function perfTick(raw) {
  if (raw <= 0) return;
  PERF.ema += ((1 / raw) - PERF.ema) * 0.05;
  PERF.acc += raw;
  if (PERF.auto && !document.hidden && $('#menu').hidden && $('#hubs').hidden) {
    if (PERF.ema < (FX.quality === 'high' ? 34 : 22)) PERF.slow += raw; else PERF.slow = Math.max(0, PERF.slow - raw * 0.5);
    if (PERF.slow > 5) {
      PERF.slow = 0;
      if (FX.quality === 'high') { fxSetQuality('eco'); toast('ลดคุณภาพกราฟิกอัตโนมัติเพื่อให้ลื่นขึ้น (เปลี่ยนได้ในตั้งค่า)'); }
      else if (!PERF.ultra) { PERF.ultra = true; renderer.setPixelRatio(1); renderer.shadowMap.enabled = false; resize(); toast('โหมดประหยัดสูงสุด: ปิดเงาและลดความละเอียด'); }
    }
  }
  if (PERF.shown && PERF.acc > 0.5) {
    PERF.acc = 0; perfOverlay();
    const i = renderer.info.render;
    PERF.el.textContent = `${Math.round(PERF.ema)} FPS · ${i.calls} draw · ${(i.triangles / 1000).toFixed(0)}k tri · ${FX.quality}${PERF.ultra ? '+ultra' : ''} · px ${renderer.getPixelRatio().toFixed(1)}`;
  }
}
