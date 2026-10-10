// =================== Real SRT timetable (from the supplied "คู่มือสรุปข้อมูลโครงข่ายและการเดินรถไฟไทย") ===================
// Long-distance express trains start at Krung Thep Aphiwat (KRT); ordinary and commuter trains still use Hua Lamphong.
const TT_PLACES = { KRT: 'กรุงเทพอภิวัฒน์', CMI: 'เชียงใหม่', NKI: 'หนองคาย', UBN: 'อุบลราชธานี', HDY: 'ชุมทางหาดใหญ่', SGK: 'สุไหงโก-ลก', PBR: 'ปาดังเบซาร์', TRG: 'ตรัง', UDN: 'อุดรธานี', VTE: 'เวียงจันทน์ (คำสะหวาด)' };
const TT = [
  { no: '9', cls: 'ด่วนพิเศษ CNR', line: 'N', from: 'KRT', to: 'CMI', dep: '18:40', arr: '07:15' },
  { no: '10', cls: 'ด่วนพิเศษ CNR', line: 'N', from: 'CMI', to: 'KRT', dep: '18:00', arr: '06:50' },
  { no: '7', cls: 'ด่วนพิเศษ (ดีเซลราง)', line: 'N', from: 'KRT', to: 'CMI', dep: '09:05', arr: '19:30' },
  { no: '51', cls: 'ด่วน', line: 'N', from: 'KRT', to: 'CMI', dep: '22:30', arr: '12:10' },
  { no: '109', cls: 'เร็ว', line: 'N', from: 'KRT', to: 'CMI', dep: '14:15', arr: '04:05' },
  { no: '25', cls: 'ด่วนพิเศษ CNR', line: 'NE', from: 'KRT', to: 'NKI', dep: '20:25', arr: '06:45' },
  { no: '26', cls: 'ด่วนพิเศษ CNR', line: 'NE', from: 'NKI', to: 'KRT', dep: '19:40', arr: '05:50' },
  { no: '75', cls: 'ด่วน', line: 'NE', from: 'KRT', to: 'NKI', dep: '08:45', arr: '17:30' },
  { no: '23', cls: 'ด่วนพิเศษ CNR', line: 'NE', from: 'KRT', to: 'UBN', dep: '21:05', arr: '06:35' },
  { no: '21', cls: 'ด่วนพิเศษ', line: 'NE', from: 'KRT', to: 'UBN', dep: '06:10', arr: '14:00' },
  { no: '67', cls: 'ด่วน', line: 'NE', from: 'KRT', to: 'UBN', dep: '21:30', arr: '07:50' },
  { no: '31', cls: 'ด่วนพิเศษ CNR', line: 'S', from: 'KRT', to: 'HDY', dep: '16:45', arr: '06:40' },
  { no: '32', cls: 'ด่วนพิเศษ CNR', line: 'S', from: 'HDY', to: 'KRT', dep: '17:45', arr: '08:10' },
  { no: '37', cls: 'ด่วนพิเศษ', line: 'S', from: 'KRT', to: 'SGK', dep: '16:10', arr: '10:50', note: 'พ่วง 45 ไปปาดังเบซาร์ ถึง 08:05' },
  { no: '45', cls: 'ด่วนพิเศษ', line: 'S', from: 'KRT', to: 'PBR', dep: '16:10', arr: '08:05', note: 'พ่วงกับขบวน 37' },
  { no: '83', cls: 'ด่วน', line: 'S', from: 'KRT', to: 'TRG', dep: '18:50', arr: '08:15' },
  { no: '171', cls: 'เร็ว', line: 'S', from: 'KRT', to: 'SGK', dep: '15:10', arr: '10:10' },
  { no: '133', cls: 'ด่วนพิเศษ', line: 'INT', from: 'KRT', to: 'VTE', dep: '21:25', arr: '09:05', note: 'ข้ามสะพานมิตรภาพไทย-ลาว แห่งที่ 1' },
  { no: '134', cls: 'ด่วนพิเศษ', line: 'INT', from: 'VTE', to: 'KRT', dep: '18:25', arr: '07:30' },
  { no: '147', cls: 'เร็ว', line: 'INT', from: 'UDN', to: 'VTE', dep: '16:00', arr: '17:55' },
  { no: '148', cls: 'เร็ว', line: 'INT', from: 'VTE', to: 'UDN', dep: '09:35', arr: '11:25' },
  { no: '947', cls: 'Shuttle', line: 'INT', from: 'HDY', to: 'PBR', dep: '07:30', arr: '08:25' },
  { no: '949', cls: 'Shuttle', line: 'INT', from: 'HDY', to: 'PBR', dep: '14:00', arr: '14:55' },
  { no: '948', cls: 'Shuttle', line: 'INT', from: 'PBR', to: 'HDY', dep: '08:55', arr: '09:50' },
  { no: '950', cls: 'Shuttle', line: 'INT', from: 'PBR', to: 'HDY', dep: '15:40', arr: '16:35' },
];
const TT_LINES = { N: 'สายเหนือ', NE: 'สายตะวันออกเฉียงเหนือ', S: 'สายใต้', INT: 'ขบวนรถระหว่างประเทศ' };
/** Departures/arrivals at one place from the real timetable, sorted by time. */
function ttBoard(code) {
  const out = [];
  TT.forEach(t => { if (t.from === code) out.push({ t: t.dep, kind: 'dep', tr: t, other: t.to }); if (t.to === code) out.push({ t: t.arr, kind: 'arr', tr: t, other: t.from }); });
  return out.sort((a, b) => a.t.localeCompare(b.t));
}
const ttName = c => TT_PLACES[c] || (SMAP[c] && SMAP[c].name) || c;
