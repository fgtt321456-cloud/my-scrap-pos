// =================== Rolling stock models based on real SRT fleet (one textured mesh per vehicle) ===================
// Each vehicle is merged into a single geometry that samples one canvas atlas (side livery, cab face, end, roof and
// colour swatches), so a whole train costs one draw call per vehicle. Windows also get an emissive atlas for night.
const TR3 = { mats: {}, geos: {}, night: -1, all: [] };
const AT_W = 1024, AT_H = 512;
const SW = { bogie: 0, wheel: 1, under: 2, silver: 3, roof: 4, black: 5, yellow: 6, red: 7, white: 8, glass: 9, orange: 10, navy: 11, lamp: 12, coupler: 13, body: 14, body2: 15 };
const SW_COL = ['#2b313a', '#15181c', '#3a3f47', '#b9c1cc', '#8f99a6', '#101215', '#f5b400', '#c8102e', '#f4f5f8', '#1c2a3f', '#e2602a', '#1f2f5a', '#fff6d8', '#4a4f57'];
// liveries (approximations of the paint schemes seen on SRT stock)
const LIV = {
  srtLoco: { body: '#E2602A', low: '#1F2F5A', line: '#F4F1E6', roof: '#6B7380' },        // SRT orange / dark blue diesel livery
  ultra:   { body: '#F2F3F5', low: '#C8102E', line: '#9AA3AE', roof: '#9AA3AE' },        // CSR SDA3 "Ultraman": white, red and silver
  cnr:     { body: '#F2F3F5', low: '#C8102E', line: '#1F2F5A', roof: '#B9C1CC' },        // CNR sleeper: white with red and navy bands
  coach:   { body: '#EFE6CF', low: '#A3262A', line: '#EFE6CF', roof: '#7B8390' },        // standard SRT coach: cream over red
  thn:     { body: '#F1E9D2', low: '#D2652A', line: '#7A3B22', roof: '#9AA3AE' },        // THN / NKF DMU: cream with orange-brown bands
  apd:     { body: '#F4F5F8', low: '#1F4FA8', line: '#C8102E', roof: '#A7B0BC' },        // Daewoo APD: white with blue and red
  asr:     { body: '#F4F5F8', low: '#1F2F5A', line: '#C8102E', roof: '#A7B0BC' },        // ASR (BR Class 158): white, navy, red
  red:     { body: '#F4F5F8', low: '#C8102E', line: '#C8102E', roof: '#C7CDD6' },        // SRT Red Line (Hitachi AT100)
};
function rr(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function glassFill(g, x, y, w, h, r = 6) {
  const gr = g.createLinearGradient(x, y, x + w * 0.4, y + h); gr.addColorStop(0, '#5C7A99'); gr.addColorStop(0.45, '#22324A'); gr.addColorStop(1, '#141E2E');
  g.fillStyle = gr; rr(g, x, y, w, h, r); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.moveTo(x + w * 0.1, y + 2); g.lineTo(x + w * 0.35, y + 2); g.lineTo(x + w * 0.15, y + h - 2); g.lineTo(x + 2, y + h - 2); g.closePath(); g.fill();
}
const SRT_TXT = 'การรถไฟแห่งประเทศไทย';
function srtLogo(g, x, y, r) { g.fillStyle = '#1F2F5A'; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = '#F5B400'; g.lineWidth = r * 0.18; g.beginPath(); g.arc(x, y, r * 0.7, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = `700 ${Math.round(r * 0.75)}px "IBM Plex Sans Thai", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('รฟท', x, y + 1); }
/** Paints the atlas for one vehicle model; returns {tex, em}. em = emissive (lit windows, head lamps). */
function paintAtlas(spec) {
  const c = document.createElement('canvas'); c.width = AT_W; c.height = AT_H; const g = c.getContext('2d');
  const e = document.createElement('canvas'); e.width = AT_W; e.height = AT_H; const k = e.getContext('2d'); k.fillStyle = '#000'; k.fillRect(0, 0, AT_W, AT_H);
  const L = spec.liv, lit = (x, y, w, h) => { k.fillStyle = '#FFD99A'; k.fillRect(x, y, w, h); };
  // swatches
  SW_COL.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 32, 448, 32, 64); });
  g.fillStyle = L.body; g.fillRect(14 * 32, 448, 32, 64); g.fillStyle = L.low; g.fillRect(15 * 32, 448, 32, 64);
  g.fillStyle = L.roof; g.fillRect(16 * 32, 448, 32, 64);
  k.fillStyle = '#FFF4D0'; k.fillRect(12 * 32, 448, 32, 64);
  // roof strip
  g.fillStyle = L.roof; g.fillRect(512, 192, 512, 64); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 2; for (let x = 512; x < 1024; x += 24) { g.beginPath(); g.moveTo(x, 192); g.lineTo(x, 256); g.stroke(); }
  // side (0,0)-(1024,192): body 2.9 m tall drawn across 192 px
  spec.side(g, lit, L);
  // cab face (0,192)-(256,448) and end (256,192)-(512,448)
  g.save(); g.translate(0, 192); spec.front(g, (x, y, w, h) => { k.fillStyle = '#FFF4D0'; k.fillRect(x, y + 192, w, h); }, L); g.restore();
  g.save(); g.translate(256, 192); (spec.back || endGangway)(g, L); g.restore();
  // hood side (512,256)-(1024,448) for hood units
  if (spec.hood) { g.save(); g.translate(512, 256); spec.hood(g, L); g.restore(); }
  const tex = new THREE.CanvasTexture(c), em = new THREE.CanvasTexture(e);
  tex.anisotropy = 4;
  return { tex, em };
}
function endGangway(g, L) {
  g.fillStyle = L.body; g.fillRect(0, 0, 256, 256); g.fillStyle = L.low; g.fillRect(0, 170, 256, 86);
  g.fillStyle = '#1b1f26'; rr(g, 70, 30, 116, 200, 10); g.fill(); g.fillStyle = '#2b313a'; rr(g, 84, 44, 88, 150, 6); g.fill();
}
// --- side painters ---
const sideCoach = (opt) => (g, lit, L) => {
  g.fillStyle = L.body; g.fillRect(0, 0, 1024, 192);
  g.fillStyle = L.low; g.fillRect(0, 120, 1024, 72);
  if (opt.band) { g.fillStyle = L.line; g.fillRect(0, 112, 1024, 8); }
  if (opt.navy) { g.fillStyle = L.line; g.fillRect(0, 26, 1024, 6); }
  const doors = opt.doors || [40, 940], wins = opt.wins || 12, wy = opt.wy || 42, wh = opt.wh || 52;
  doors.forEach(x => { g.fillStyle = opt.doorCol || L.body; g.fillRect(x, 18, 44, 166); g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2; g.strokeRect(x, 18, 44, 166); glassFill(g, x + 8, 34, 28, 46, 4); lit(x + 8, 34, 28, 46); });
  const x0 = doors[0] + 60, x1 = doors[doors.length - 1] - 16, step = (x1 - x0) / wins;
  for (let i = 0; i < wins; i++) { const x = x0 + i * step + 4, w = step - (opt.pillar || 10); glassFill(g, x, wy, w, wh, opt.round || 6); lit(x, wy, w, wh); if (opt.berth) { glassFill(g, x, wy + wh + 8, w, 26, 4); lit(x, wy + wh + 8, w, 26); } }
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.font = '600 15px "IBM Plex Sans Thai", sans-serif'; g.textAlign = 'center';
  g.fillStyle = opt.txtCol || '#1F2F5A'; g.fillText(opt.txt || SRT_TXT, 512, 150 + (opt.txtDy || 0));
  if (opt.num) { g.font = '700 14px "IBM Plex Mono", monospace'; g.fillText(opt.num, 880, 150); }
  if (opt.logo) srtLogo(g, 140, 150, 14);
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, 1024, 4);
};
const sideLoco = (opt) => (g, lit, L) => {
  g.fillStyle = L.body; g.fillRect(0, 0, 1024, 192); g.fillStyle = L.low; g.fillRect(0, 128, 1024, 64);
  g.fillStyle = L.line; g.fillRect(0, 120, 1024, 8);
  // cab windows at both ends
  for (const x of opt.cabs || [24, 900]) { glassFill(g, x, 30, 96, 52, 8); lit(x + 10, 34, 70, 40); g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(x - 6, 22, 108, 98); }
  // engine-room grilles and doors
  for (let x = 170; x < 840; x += 70) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, 26, 54, 80); g.strokeStyle = 'rgba(0,0,0,0.35)'; for (let y = 30; y < 104; y += 6) { g.beginPath(); g.moveTo(x + 4, y); g.lineTo(x + 50, y); g.stroke(); } }
  g.fillStyle = '#F4F1E6'; g.font = '700 26px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.fillText(opt.num, 512, 165);
  srtLogo(g, 330, 160, 18);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.font = '600 14px "IBM Plex Sans Thai", sans-serif'; g.fillText(opt.maker || '', 700, 166);
};
const sideDmu = (opt) => sideCoach(Object.assign({ doors: [70, 520, 910], wins: 10, band: true }, opt));
// --- cab faces (256×256 = 2.9 m wide × 2.9 m tall) ---
const faceLoco = (opt) => (g, lit, L) => {
  g.fillStyle = L.body; g.fillRect(0, 0, 256, 256); g.fillStyle = L.low; g.fillRect(0, 170, 256, 86);
  if (opt.vee) { g.fillStyle = L.line; g.beginPath(); g.moveTo(0, 150); g.lineTo(128, 200); g.lineTo(256, 150); g.lineTo(256, 166); g.lineTo(128, 216); g.lineTo(0, 166); g.fill(); }
  else { g.fillStyle = L.line; g.fillRect(0, 160, 256, 10); }
  const ws = opt.ws || [[22, 40, 96, 66], [138, 40, 96, 66]];
  ws.forEach(([x, y, w, h]) => glassFill(g, x, y, w, h, 8));
  [[40, 196], [216, 196]].forEach(([x, y]) => { g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(x, y, 11, 0, 7); g.fill(); lit(x - 11, y - 11, 22, 22); });
  g.fillStyle = '#fff6d8'; g.beginPath(); g.arc(128, 18, 9, 0, 7); g.fill(); lit(119, 9, 18, 18);
  g.fillStyle = opt.numCol || '#F4F1E6'; g.font = '700 22px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.fillText(opt.num, 128, 140);
};
const faceDmu = (opt) => (g, lit, L) => {
  g.fillStyle = L.body; g.fillRect(0, 0, 256, 256); g.fillStyle = L.low; g.fillRect(0, 168, 256, 88); g.fillStyle = L.line; g.fillRect(0, 160, 256, 8);
  if (opt.gangway) { g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, 92, 30, 72, 200, 6); g.fill(); glassFill(g, 104, 44, 48, 70, 5); glassFill(g, 14, 44, 70, 76, 8); glassFill(g, 172, 44, 70, 76, 8); }
  else { glassFill(g, 16, 40, 104, 80, 10); glassFill(g, 136, 40, 104, 80, 10); }
  [[36, 200], [220, 200]].forEach(([x, y]) => { g.fillStyle = '#fff6d8'; rr(g, x - 16, y - 8, 32, 16, 6); g.fill(); lit(x - 16, y - 8, 32, 16); });
  g.fillStyle = '#1F2F5A'; g.font = '700 18px "IBM Plex Mono", monospace'; g.textAlign = 'center'; g.fillText(opt.num || '', 128, 146);
};
const faceRed = (g, lit, L) => {
  g.fillStyle = '#C8102E'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#F4F5F8'; g.fillRect(0, 196, 256, 60);
  glassFill(g, 14, 22, 228, 104, 18);
  [[40, 168], [216, 168]].forEach(([x, y]) => { g.fillStyle = '#fff6d8'; rr(g, x - 22, y - 7, 44, 14, 6); g.fill(); lit(x - 22, y - 7, 44, 14); });
};
const hoodSide = (g, L) => {   // GE hood: orange hood with grille doors
  g.fillStyle = L.body; g.fillRect(0, 0, 512, 192); g.fillStyle = L.low; g.fillRect(0, 140, 512, 52); g.fillStyle = L.line; g.fillRect(0, 132, 512, 8);
  for (let x = 12; x < 500; x += 62) { g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(x, 14, 52, 112); for (let y = 22; y < 70; y += 6) { g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + 46, y); g.stroke(); } }
};
// --- model catalogue (real SRT stock) ---
const RS = {
  GEA: { name: 'GE UM12C', liv: LIV.srtLoco, kind: 'hood', len: 17.0, maker: 'General Electric · สหรัฐฯ', side: sideLoco({ num: '4021', maker: 'GE' }), front: faceLoco({ num: '4021', ws: [[50, 46, 70, 56], [136, 46, 70, 56]] }), hood: hoodSide },
  ALS: { name: 'Alsthom AD24C', liv: LIV.srtLoco, kind: 'loco', len: 17.4, nose: 0.9, side: sideLoco({ num: '4135', maker: 'Alsthom' }), front: faceLoco({ num: '4135', vee: true }) },
  HID: { name: 'Hitachi 8FA-36C', liv: LIV.srtLoco, kind: 'loco', len: 18.4, side: sideLoco({ num: '4512', maker: 'Hitachi' }), front: faceLoco({ num: '4512', ws: [[18, 36, 104, 70], [134, 36, 104, 70]] }) },
  CSR: { name: 'CSR SDA3 “Ultraman”', liv: LIV.ultra, kind: 'loco', len: 19.2, slope: true, side: sideLoco({ num: '5114', maker: 'CSR Qishuyan', cabs: [20, 904] }), front: faceLoco({ num: '5114', vee: true, numCol: '#1F2F5A', ws: [[16, 30, 224, 76]] }) },
  cnr: { name: 'CNR sleeper', liv: LIV.cnr, kind: 'car', len: 19.6, ac: true, side: sideCoach({ wins: 10, wy: 34, wh: 46, berth: true, band: true, navy: true, num: 'บนท.ป.', txtDy: 14 }), front: endGangway },
  coach: { name: 'รถโดยสารมาตรฐาน', liv: LIV.coach, kind: 'car', len: 19.4, side: sideCoach({ wins: 14, wy: 40, wh: 50, num: 'บชส.', logo: true, txtCol: '#EFE6CF' }), front: endGangway },
  THN: { name: 'THN DMU', liv: LIV.thn, kind: 'dmu', len: 20, side: sideDmu({ num: 'THN 1107', txtCol: '#F1E9D2' }), front: faceDmu({ num: '1107' }) },
  NKF: { name: 'NKF DMU', liv: LIV.thn, kind: 'dmu', len: 20, side: sideDmu({ num: 'NKF 1218', txtCol: '#F1E9D2' }), front: faceDmu({ num: '1218' }) },
  APD: { name: 'Daewoo APD', liv: LIV.apd, kind: 'dmu', len: 20, ac: true, side: sideDmu({ num: 'APD 2516', txtCol: '#F4F5F8' }), front: faceDmu({ num: '2516' }) },
  ASR: { name: 'ASR (BR Class 158)', liv: LIV.asr, kind: 'dmu', len: 20, ac: true, slope: true, side: sideDmu({ num: 'ASR 2507', doors: [60, 900], wins: 11, txtCol: '#F4F5F8' }), front: faceDmu({ num: '2507', gangway: true }) },
  red: { name: 'Hitachi AT100', liv: LIV.red, kind: 'emu', len: 20, ac: true, slope: true, side: sideCoach({ doors: [90, 330, 570, 810], wins: 12, wy: 36, wh: 60, band: false, txt: 'SRT · สายสีแดง', txtCol: '#F4F5F8', round: 4 }), front: faceRed },
  frt: { name: 'แคร่ขนตู้สินค้า', liv: LIV.coach, kind: 'flat', len: 19.4, side: (g) => { g.fillStyle = '#7c8693'; g.fillRect(0, 0, 1024, 192); }, front: (g) => { g.fillStyle = '#7c8693'; g.fillRect(0, 0, 256, 256); } },
};
function uvRect(geo, face, rect) {   // rect = [x0,y0,x1,y1] in atlas px; face 0..5 of a BoxGeometry
  const uv = geo.attributes.uv, u0 = rect[0] / AT_W, u1 = rect[2] / AT_W, v0 = 1 - rect[3] / AT_H, v1 = 1 - rect[1] / AT_H;
  for (let i = face * 4; i < face * 4 + 4; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, u0 + (u1 - u0) * u, v0 + (v1 - v0) * v); }
}
const swR = i => [i * 32 + 6, 452, i * 32 + 26, 508];
const REG = { S: [0, 0, 1024, 192], F: [0, 192, 256, 448], B: [256, 192, 512, 448], R: [512, 192, 1024, 256], H: [512, 256, 1024, 448] };
function part(list, geo, faces, pos, rot) {
  if (rot) geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rot[0], rot[1], rot[2])));
  geo.translate(pos[0], pos[1], pos[2]);
  if (Array.isArray(faces)) faces.forEach((f, i) => uvRect(geo, i, typeof f === 'number' ? swR(f) : REG[f]));
  else { const r = swR(faces), uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (r[0] + r[2]) / 2 / AT_W, 1 - (r[1] + r[3]) / 2 / AT_H); }
  if (geo.index) geo = geo.toNonIndexed();
  list.push(geo);
}
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function bogie(list, z) {
  part(list, B(2.1, 0.45, 2.7), SW.bogie, [0, 0.82, z]);
  for (const dz of [-0.95, 0.95]) for (const x of [-0.56, 0.56]) part(list, new THREE.CylinderGeometry(0.44, 0.44, 0.12, 14), SW.wheel, [x, 0.46, z + dz], [0, 0, Math.PI / 2]);
  part(list, B(2.3, 0.18, 0.4), SW.under, [0, 0.95, z]);
}
function buildModel(id) {
  const M = RS[id], L = M.len, W = 2.9, list = [], yb = 1.25, H = 2.9, top = yb + H;
  bogie(list, -L / 2 + 3); bogie(list, L / 2 - 3);
  for (const s of [-1, 1]) part(list, B(0.34, 0.32, 0.7), SW.coupler, [0, 1.05, s * (L / 2 + 0.25)]);
  if (M.kind === 'flat') {
    part(list, B(2.6, 0.3, L), [SW.under, SW.under, SW.silver, SW.black, SW.under, SW.under], [0, 1.35, 0]);
    [-4.7, 4.7].forEach((z, i) => part(list, B(2.5, 2.55, 8.8), [SW.body2, SW.body2, SW.roof, SW.black, SW.body, SW.body], [0, 2.8, z]));
    return list;
  }
  part(list, B(W * 0.86, 0.5, L - 5), SW.under, [0, 1.05, 0]);
  if (M.kind === 'hood') {
    part(list, B(W, 0.12, L), SW.under, [0, yb, 0]);
    part(list, B(2.1, 2.4, L - 6.2), ['H', 'H', SW.body, SW.under, SW.body, SW.body], [0, yb + 1.2, -1.6]);
    part(list, B(W, 3.0, 3.2), [SW.body, SW.body, SW.roof, SW.under, 'F', SW.body], [0, yb + 1.5, L / 2 - 3.4]);
    part(list, B(2.1, 1.7, 1.6), [SW.body, SW.body, SW.body, SW.under, SW.body2, SW.body], [0, yb + 0.85, L / 2 - 1.0]);
    part(list, new THREE.CylinderGeometry(0.22, 0.26, 0.6, 8), SW.black, [0, yb + 2.7, -3]);
    for (const z of [-6, -1.5]) part(list, new THREE.CylinderGeometry(0.62, 0.62, 0.12, 16), SW.black, [0, yb + 2.45, z]);
    part(list, B(0.5, 0.25, 0.1), SW.lamp, [0, yb + 1.55, L / 2 - 0.15]);
    return list;
  }
  const cab2 = M.kind === 'loco';            // double-ended locomotives
  const frontF = M.kind === 'loco' || M.kind === 'dmu' || M.kind === 'emu' ? 'F' : 'B';
  const ends = M.slope ? (cab2 ? [-1, 1] : [1]) : [], cut = 1.3;
  const bl = L - ends.length * cut, bz = ends.length === 1 ? -cut / 2 : 0;
  part(list, B(W, H, bl), ['S', 'S', 'R', SW.under, ends.includes(1) ? SW.body : frontF, ends.includes(-1) ? SW.body : (cab2 ? 'F' : 'B')], [0, yb + H / 2, bz]);
  for (const s of ends) {   // raked cab: lower nose + windscreen leaning back to the roof line
    const zf = s * (L / 2 - cut / 2);
    part(list, B(W, 1.45, cut), [SW.body, SW.body, SW.body, SW.under, SW.body2, SW.body2], [0, yb + 0.72, zf]);
    const ang = Math.atan2(cut - 0.15, H - 1.45), len = Math.hypot(cut - 0.15, H - 1.45);
    part(list, B(W - 0.04, len, 0.1), [SW.body, SW.body, SW.body, SW.body, s > 0 ? 'F' : SW.body, s > 0 ? SW.body : 'F'], [0, yb + 1.45 + (H - 1.45) / 2, zf + s * 0.02], [-s * ang, 0, 0]);
    for (const x of [-1, 1]) part(list, B(0.08, H - 1.45, cut - 0.1), SW.body, [x * (W / 2 - 0.04), yb + 1.45 + (H - 1.45) / 2 - 0.25, zf - s * 0.1]);
  }
  // roof shoulders and roof equipment
  for (const s of [-1, 1]) part(list, B(0.62, 0.16, bl - 0.2), SW.body + 2, [s * 1.18, top + 0.02, bz], [0, 0, -s * 0.5]);
  part(list, B(2.0, 0.22, bl - 0.4), ['R', 'R', 'R', 'R', 'R', 'R'], [0, top + 0.1, bz]);
  if (M.ac) for (const z of [-L / 2 + 3.5, L / 2 - 3.5]) part(list, B(1.6, 0.36, 2.6), SW.silver, [0, top + 0.38, z]);
  if (M.kind === 'loco') {
    for (const z of [-3.5, 0, 3.5]) part(list, new THREE.CylinderGeometry(0.6, 0.6, 0.12, 16), SW.black, [0, top + 0.27, z]);
    part(list, B(0.5, 0.4, 0.6), SW.black, [0.6, top + 0.4, -6]);
    part(list, B(1.2, 0.9, L - 9), SW.body2, [0, 1.4, 0]);   // fuel tank
  }
  if (M.nose) for (const s of [-1, 1]) part(list, B(W - 0.3, 1.1, M.nose), [SW.body2, SW.body2, SW.body, SW.under, SW.body2, SW.body2], [0, yb + 0.55, s * (L / 2 + M.nose / 2 - 0.05)]);
  if (M.kind === 'emu') { const z = 0; part(list, B(1.6, 0.08, 0.08), SW.black, [0, top + 1.0, z]); for (const s of [-1, 1]) part(list, B(0.06, 0.06, 1.4), SW.black, [0, top + 0.6, z + s * 0.45], [s * 0.9, 0, 0]); }
  if (M.kind === 'car' || M.kind === 'emu') for (const s of [-1, 1]) if (!(M.kind === 'emu' && s === 1)) part(list, B(1.3, 2.2, 0.3), SW.black, [0, yb + 1.2, s * (L / 2 + 0.12)]);
  return list;
}
function mergeParts(list) {
  let n = 0; list.forEach(g => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2); let o = 0;
  for (const g of list) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uv.set(g.attributes.uv.array, o * 2); o += g.attributes.position.count; g.dispose(); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.computeBoundingSphere(); return geo;
}
// legacy vehicle keys → real models
const RS_ALIAS = { loco: 'ALS', coach: 'coach', cab: 'THN', car: 'THN_car', cnr: 'cnr', red: 'red', frt: 'frt', dmu: 'APD' };
function rsResolve(t) {
  let k = RS_ALIAS[t] || t, trailer = false;
  if (k.endsWith('_car')) { trailer = true; k = k.slice(0, -4); }
  if (!RS[k]) k = 'coach';
  return { k, trailer };
}
function trainModel(t) {
  const { k, trailer } = rsResolve(t), key = k + (trailer ? '_car' : '');
  if (!TR3.geos[key]) {
    if (trailer) { const M = Object.assign({}, RS[k], { kind: 'car', slope: false, nose: 0 }); RS[key] = M; }
    TR3.geos[key] = mergeParts(buildModel(key));
  }
  if (!TR3.mats[k]) {
    const { tex, em } = paintAtlas(RS[k]);
    TR3.mats[k] = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: em, emissive: 0xffffff, emissiveIntensity: Math.max(0, TR3.night), roughness: RS[k].liv === LIV.cnr || RS[k].liv === LIV.red ? 0.38 : 0.55, metalness: RS[k].liv === LIV.cnr ? 0.25 : 0.08 });
    TR3.all.push(TR3.mats[k]);
  }
  const m = new THREE.Mesh(TR3.geos[key], TR3.mats[k]); m.castShadow = true; m.receiveShadow = true; m.userData.rs = key; return m;
}
function trainsNight(f) { f = Math.round(f * 20) / 20; if (f === TR3.night) return; TR3.night = f; TR3.all.forEach(m => { m.emissiveIntensity = f * 0.9; }); }
// ---------- reference sheet for RailPedia (real stock, short notes) ----------
const RS_INFO = [
  { id: 'CSR', consist: ['CSR', 'cnr', 'cnr'], tier: 'QSY', role: 'หัวรถจักรดีเซลไฟฟ้า', note: 'ผลิตโดย CSR Qishuyan ประเทศจีน เข้าประจำการราวปี 2556–2558 ฉายา “อุลตร้าแมน” จากสีขาวแดงด้านหน้า' },
  { id: 'cnr', consist: ['cnr', 'cnr', 'cnr'], role: 'รถนั่งและนอนปรับอากาศ', note: 'ขบวนรถนอนรุ่นใหม่จาก CNR Changchun ประเทศจีน เริ่มให้บริการปี 2559 กับขบวนด่วนพิเศษสายเหนือ อีสาน และใต้' },
  { id: 'ALS', consist: ['ALS', 'coach', 'coach'], tier: 'AD24C', role: 'หัวรถจักรดีเซลไฟฟ้า', note: 'Alsthom ประเทศฝรั่งเศส รุ่น AD24C เข้าประจำการช่วงทศวรรษ 2510–2520 เป็นหัวรถจักรที่ใช้งานแพร่หลายที่สุดรุ่นหนึ่ง' },
  { id: 'HID', consist: ['HID', 'coach', 'coach'], role: 'หัวรถจักรดีเซลไฟฟ้า', note: 'Hitachi ประเทศญี่ปุ่น รุ่น 8FA-36C เข้าประจำการราวปี 2536 ห้องขับสองด้าน ตัวรถทรงกล่อง' },
  { id: 'GEA', consist: ['GEA', 'coach', 'coach'], role: 'หัวรถจักรดีเซลไฟฟ้า', note: 'General Electric ประเทศสหรัฐฯ รุ่น UM12C แบบห้องเครื่องแคบ (hood unit) หัวรถจักรรุ่นแรก ๆ ของการรถไฟไทย' },
  { id: 'ASR', consist: ['ASR', 'ASR_car', 'ASR'], tier: 'ASR', role: 'รถดีเซลรางปรับอากาศ', note: 'พื้นฐานจาก British Rail Class 158 สร้างโดย BREL ประเทศอังกฤษ ใช้กับขบวนด่วนพิเศษดีเซลราง' },
  { id: 'APD', consist: ['APD', 'APD_car', 'APD'], role: 'รถดีเซลรางปรับอากาศ', note: 'Daewoo ประเทศเกาหลีใต้ ส่งมอบราวปี 2538–2539 ใช้กับขบวนด่วนพิเศษและด่วนระยะกลาง' },
  { id: 'THN', consist: ['THN', 'THN_car', 'THN'], tier: 'THN', role: 'รถดีเซลราง', note: 'ผลิตโดยกลุ่ม Tokyu–Hitachi–Nippon Sharyo ประเทศญี่ปุ่น (2526) ใช้กับรถธรรมดาและรถชานเมือง' },
  { id: 'NKF', consist: ['NKF', 'NKF_car', 'NKF'], role: 'รถดีเซลราง', note: 'กลุ่ม Nippon Sharyo–Kawasaki–Fuji ประเทศญี่ปุ่น (2528) รุ่นต่อจาก THN ใช้งานลักษณะเดียวกัน' },
  { id: 'red', consist: ['red', 'red_car', 'red_car', 'red'], role: 'รถไฟฟ้า (สายสีแดง)', note: 'Hitachi AT100 ประเทศญี่ปุ่น ให้บริการรถไฟชานเมืองสายสีแดง เริ่มปี 2564 จ่ายไฟเหนือหัว 25 kV' },
];
// ---------- 3D thumbnails for UI (rendered once, cached as data URLs) ----------
const THUMB = { r: null, cache: {} };
function trainThumb(consist, w = 520, h = 130) {
  const key = consist.join(',') + w + 'x' + h; if (THUMB.cache[key]) return THUMB.cache[key];
  try {
    if (!THUMB.r) { THUMB.r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); THUMB.r.outputEncoding = renderer.outputEncoding; }
    const r = THUMB.r; r.setPixelRatio(1); r.setSize(w * 2, h * 2, false);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x9aa4b3, 0.95)); const dl = new THREE.DirectionalLight(0xffffff, 0.75); dl.position.set(30, 40, 50); sc.add(dl);
    let z = 0; const g = new THREE.Group();
    consist.forEach((t, i) => { const m = trainModel(t), len = RS[rsResolve(t).k].len; z -= i ? len / 2 + 0.6 : 0; m.position.z = z; if (i === consist.length - 1 && i > 0 && /^(THN|NKF|APD|ASR|red)$/.test(t)) m.rotation.y = Math.PI; g.add(m); z -= len / 2; });
    sc.add(g);
    const box3 = new THREE.Box3().setFromObject(g), c = box3.getCenter(new THREE.Vector3()), sz = box3.getSize(new THREE.Vector3());
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, -200, 200), asp = w / h, half = Math.max(sz.z * 0.47, sz.y * asp * 0.7);
    cam.left = -half; cam.right = half; cam.top = half / asp; cam.bottom = -half / asp; cam.updateProjectionMatrix();
    cam.position.set(c.x + 40, c.y + 14, c.z + 18); cam.lookAt(c); cam.position.copy(c).add(new THREE.Vector3(40, 12, 14)); cam.lookAt(c);
    r.setClearColor(0x000000, 0); r.render(sc, cam);
    return (THUMB.cache[key] = r.domElement.toDataURL('image/png'));
  } catch (e) { return ''; }
}
const thumbImg = (consist, cls = '') => { const u = trainThumb(consist); return u ? `<img class="rsimg ${cls}" src="${u}" alt="">` : ''; };
const TIER_CONSIST = { THN: ['THN', 'THN_car', 'THN'], AD24C: ['ALS', 'coach', 'coach'], ASR: ['ASR', 'ASR_car', 'ASR'], QSY: ['CSR', 'cnr', 'cnr'] };
