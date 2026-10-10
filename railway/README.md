# RailTrack Thailand — ต้นแบบเว็บ

เกมบริหารการเดินรถไฟไทยแนว World of Airports ใช้แผนที่ประเทศไทยจริง ตารางเดินรถจริงของ รฟท. และโมเดลรถตามรถที่ใช้งานจริง
จัดทำเพื่อการศึกษาและพัฒนา (ยังไม่ได้ขออนุญาตใช้ตราสัญลักษณ์และชื่อการรถไฟแห่งประเทศไทย)

## เปิดเล่น
เปิด `railway/index.html` ในเบราว์เซอร์ได้ทันที (ไฟล์เดียว โหลด three.js และฟอนต์จาก CDN)

| ท้าย URL | ผล |
|---|---|
| `#rtdebug` | ข้ามเมนู + เปิด `window.__rt` สำหรับสั่งงานใน console |
| `#rtdebug-menu` | เหมือน `#rtdebug` แต่แสดงเมนูหลัก |
| `#play` | ข้ามเมนูหลัก |
| `#hualamphong` | เข้าสถานีหัวลำโพงทันที |

ตัวอย่างคำสั่งใน console (โหมด `#rtdebug`): `__rt.stnEnter('CMI')`, `__rt.gainXP(500)`, `__rt.s` (สถานะเครือข่าย), `__rt.t` (สถานะหัวลำโพง), `__rt.stn()` (สถานะสถานีปัจจุบัน)

## โครงสร้าง
```
railway/
  index.html          ไฟล์เกมที่ build แล้ว (อย่าแก้ตรง ๆ ให้แก้ใน src แล้ว build ใหม่)
  build.py            รวม src/* เป็น index.html
  src/                ซอร์สแยกโมดูล (ดูลำดับใน build.py)
  data/geo_data.json  พรมแดนและแนวทางรถไฟจริง (Natural Earth 1:10m) ที่ฉายเป็นพิกัดเกมแล้ว
  tools/geo.py        สคริปต์สร้าง geo_data.json จากไฟล์ Natural Earth + tools/stations.json
  tools/export_unity.js ส่งออกข้อมูลเกมเป็น JSON ไปที่ unity/Assets/StreamingAssets/RailTrack/
  tests/              เทสต์ Playwright (ดู tests/README.md)
docs/                 เอกสารสถาปัตยกรรม การทดสอบ และแหล่งอ้างอิง
```

| โมดูล | หน้าที่ |
|---|---|
| `core_net.js` | แกนหลัก: ยูทิลิตี, สถานะเครือข่าย, สถานี/เส้นทางบนแผนที่ไทย, การจำลองรถในเครือข่าย, แผนที่ 2D |
| `geo.js` | หาเส้นทางตามรางจริง (Dijkstra), Path2D ของแผนที่ |
| `fx.js` | แสง กลางวัน/กลางคืน, bloom, billboard, ตัวช่วยกราฟิก |
| `ui_net.js`, `ux.js` | แถบเครื่องมือ, ลิ้นชัก, ตารางเวลา, บทสอน |
| `timetable.js` | ตารางเดินรถจริงจากคู่มือ รฟท. |
| `rolling_stock.js` | โมเดลรถไฟตามรถจริง (atlas texture, ภาพตัวอย่าง 3D) |
| `meta.js` | เลเวล/XP, เหรียญ, รางวัล, ห้องควบคุม, แผนชานชาลา, ฝูงรถ, สัญญา, เมนูหลัก, หน้าเลือกสถานี |
| `difficulty.js` | ความยาก: ชั่วโมงเร่งด่วน, ขบวนล่าช้าจากต้นทาง, ขัดข้องระหว่างจอด, ฝนรายวัน, ARS ที่ไม่สมบูรณ์ |
| `hlp_engine.js`, `hlp_fx.js`, `hlp_scenery.js`, `hlp_ui.js` | สถานีหัวลำโพง: interlocking/NX, ETCS, กลับขบวน, ฉาก, ตัวช่วยข้อมูลขบวน |
| `stations_data.js`, `stations.js` | สถานีจริงอื่น ๆ: ผังราง อาคาร และการเดินรถตามตาราง |
| `world.js` | นาฬิกาโลกร่วม, บัญชีความล่าช้าข้ามสถานี, ขบวนจริงบนแผนที่ 2D |
| `station_view.js` | UI รายการขบวน การ์ด และแผงเลือกชานชาลาที่ใช้ร่วมกันทุกสถานี (ผ่าน adapter) |
| `perf.js`, `export.js` | วัด FPS/ลดคุณภาพอัตโนมัติ, ส่งออกข้อมูล JSON ให้ Unity |
| `coop.js` | เล่นร่วมกัน (ใช้ capability ของ Claude Artifact) |
| `boot.js` | สลับโหมด, บันทึก/โหลด, ลูปหลัก |

## Build และทดสอบ
```bash
python3 railway/build.py
node --check railway/build/game.js
node railway/tests/smoke.test.js     # ดู tests/README.md สำหรับการติดตั้ง
node railway/tests/world.test.js     # นาฬิกาโลก + ความล่าช้าข้ามสถานี
node railway/tools/export_unity.js   # อัปเดตข้อมูลให้ Unity
sh unity/tools/check/check.sh        # คอมไพล์สคริปต์ Unity + ตรวจข้อมูล (ใช้ mono)
```
