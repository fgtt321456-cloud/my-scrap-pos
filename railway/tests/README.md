# เทสต์อัตโนมัติ RailTrack (Playwright)

```bash
cd railway/tests
npm init -y && npm i playwright three@0.128.0
npx playwright install chromium   # ถ้ายังไม่มี Chromium
cd ../.. && python3 railway/build.py && node railway/tests/smoke.test.js
```

- `harness.js` เปิดเกมแบบ headless และเสิร์ฟ three.js จาก `node_modules` เพื่อให้รันได้แบบออฟไลน์
- `smoke.test.js` ตรวจเส้นทางหลัก: เมนู → เลือกสถานี → หัวลำโพง (เลือกชานชาลา, จำลอง 4 ชม.) → 5 สถานีจริง → แผนที่ไทย
- ผลลัพธ์พิมพ์เป็น `PASS`/`FAIL` และ exit code ไม่เป็น 0 ถ้ามีข้อใดไม่ผ่าน
- ตัวแปรแวดล้อม: `THREE_DIR` (ที่อยู่ของแพ็กเกจ three), `CHROMIUM` (ไฟล์ Chromium), `PLAYWRIGHT` (ที่อยู่โมดูล playwright)
