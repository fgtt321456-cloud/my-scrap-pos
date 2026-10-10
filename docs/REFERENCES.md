# แหล่งอ้างอิงข้อมูลจริงใน RailTrack

ตรวจเมื่อ ต.ค. 2569 ด้วยการค้นเว็บ สถานะ: ✅ ยืนยันจากแหล่งข้อมูล · ⚠️ มีแหล่งเดียว/แหล่งขัดกัน · ❓ ยังไม่พบแหล่งยืนยัน (ระบุในเกมว่าเป็นการประมาณ)

## ตารางเดินรถ
- ✅ ขบวนทางไกลและระหว่างประเทศทั้งหมด: เอกสาร "คู่มือสรุปข้อมูลโครงข่ายและการเดินรถไฟไทย" ที่ผู้ใช้ส่งมา (`railway/src/timetable.js`)
- ⚠️ เวลาที่ขบวนผ่านสถานีระหว่างทาง (เช่น 37/45, 171 ที่หาดใหญ่ และ 133/134, 147/148 ที่หนองคาย) คำนวณจากสัดส่วนระยะทางตามราง
- ❓ เลขขบวนธรรมดาและชานเมืองที่หัวลำโพง (201, 275, 367 ฯลฯ) ใส่จากความจำ ควรตรวจกับตาราง รฟท. ปัจจุบัน

## สถานี
| สถานี | ข้อมูลที่ใช้ | สถานะ | แหล่ง |
|---|---|---|---|
| หัวลำโพง | เปิด 25 มิ.ย. 2459, Mario Tamagno + Annibale Rigotti, นีโอเรอเนสซองส์, 14 ชานชาลา, หลัง ม.ค. 2566 รับขบวนธรรมดา/ชานเมือง/สายตะวันออก | ✅ | [Wikipedia](https://en.wikipedia.org/wiki/Hua_Lamphong_railway_station), [Silpa-mag](https://www.silpa-mag.com/?p=83732) |
| หัวลำโพง | น้ำพุ/อนุสาวรีย์หน้าสถานี | ❓ ถอดรูปช้างสามเศียรออกแล้ว เหลือน้ำพุตกแต่ง | — |
| กรุงเทพอภิวัฒน์ | 24–26 ชานชาลา, ทางไกล 12, สายสีแดง 4, ความเร็วสูง 10; ชั้น 2 ทาง 1 ม., ชั้น 3 ทางมาตรฐาน; อาคาร 596.6 ม.; 274,192 ตร.ม.; ชานชาลา ~600 ม. | ⚠️ | [Wikipedia](https://en.wikipedia.org/wiki/Krung_Thep_Aphiwat_Central_Terminal), [Rail Journal](https://www.railjournal.com/passenger/main-line/bang-sue-grand-station-opens-for-mainline-services/), [Thai Train Guide](https://thaitrainguide.com/?p=2803), [Bangkok Post](https://www.bangkokpost.com/thailand/general/2484749) |
| เชียงใหม่ | ถูกทิ้งระเบิด 21 ธ.ค. 2486, อาคารใหม่ออกแบบ 2489 เปิด ~2490–91, 4 ชานชาลา 7 ราง, วงเวียนกลับรถจักร, รางวัลอนุรักษ์ 2549 | ⚠️ | [Wikipedia](https://en.wikipedia.org/wiki/Chiang_Mai_railway_station), [travel-and-history](https://travel-and-history.com/chiang-mai-railway-station/), [docomomo Thailand](https://www.docomomothailand.org/pages/no12.html) |
| ชุมทางหาดใหญ่ | 6 ชานชาลา 16 ราง, เปิด ~2467, ทางไปปาดังเบซาร์เปิด 1 ก.ค. 2461 | ⚠️ (รูปแบบอาคาร ❓) | [Wikipedia](https://en.wikipedia.org/wiki/Hat_Yai_Junction_railway_station) |
| หนองคาย | ต่อขยายข้ามสะพานมิตรภาพ ทดลอง ก.ค. 2551 เปิด มี.ค. 2552, รางอยู่กลางสะพาน รถยนต์หยุดเมื่อรถไฟผ่าน | ✅ (ผังสถานี ❓) | [Wikipedia](https://en.wikipedia.org/wiki/Nong_Khai_railway_station), [Railway Gazette](https://railwaygazette.com/news/laos-link-launched/31848.article) |
| อุบลราชธานี | ต.วารินชำราบ, เปิด 1 เม.ย. 2473 (สถานีวาริน), 2 ชานชาลา 5 ราง, รถจักรไอน้ำ NBL 180 จัดแสดง | ✅ (อาคาร ❓) | [Wikipedia](https://en.wikipedia.org/wiki/Ubon_Ratchathani_railway_station), [Thai Train Guide](https://www.thaitrainguide.com/?p=8529) |

## ล้อเลื่อน
| รุ่น | ข้อมูลที่ใช้ | สถานะ | แหล่ง |
|---|---|---|---|
| GE UM12C (GEK) | ส่งมอบตั้งแต่ 2506, 50 คัน, ~2556 ยังใช้ 45 คัน | ✅ | [GE Reports](https://www.ge.com/news/reports/50-years-reliable-rail-thailand) |
| Alsthom AD24C | ซีรีส์ 4100/4200, เปลี่ยนเครื่อง MTU/Caterpillar | ⚠️ (ปีที่ผลิต ❓) | [RailPictures](https://web.railpictures.net/photo/719997) |
| Hitachi 8FA-36C | 22 คัน ~2536, 4507 ลากขบวนรถนอน CNR สายเชียงใหม่ | ⚠️ | [RailScot](https://railscot.co.uk/img/70/272), [RailPictures](https://web.railpictures.net/photo/584579) |
| CSR SDA3 | 20 คัน สั่ง มิ.ย. 2556 ส่งมอบ ม.ค. 2558 ใช้ขนตู้สินค้า, Caterpillar 2.8 MW, 100 กม./ชม. | ✅ (ชื่อ "Ultraman" ❓ มาจาก GDD) | [Railway Gazette](https://railwaygazette.com/traction-and-rolling-stock/csr-qishuyan-locomotives-delivered-to-thailand/40392.article) |
| รถนอน CNR | 115 คัน (ชั้น 1 9, ชั้น 2 88, เสบียง 9, กำลัง 9) เริ่ม 11 พ.ย./2 ธ.ค. 2559 | ✅ | [Rail Journal](https://www.railjournal.com/rolling-stock/thailand-orders-115-coaches-from-cnr/), [Khaosod](https://www.khaosodenglish.com/news/transpo/2016/10/26/bookings-available-new-overnight-train-chiang-mai-photos/) |
| THN / NKF | 2526 40 คัน / 2528 64+12 คัน | ⚠️ (เว็บผู้ชื่นชอบรถไฟแหล่งเดียว) | [funet Thailand rail](https://ftp.nic.funet.fi/index/railways/Thailand/index.html) |
| ASR | BREL Derby, Class 158, 20 คัน 2533–34 | ✅ | [Wikipedia](https://en.wikipedia.org/wiki/State_Railway_of_Thailand_ASR_class) |
| Daewoo APD | รุ่นย่อยและปี | ❓ | — |
| Hitachi AT100 (สายสีแดง) | 10×4 ตู้ + 15×6 ตู้ = 130 ตู้, 25 kV 50 Hz, ทดลอง 2 ส.ค. เปิด 29 พ.ย. 2564 | ✅ | [Railway Gazette](https://railwaygazette.com/modes/bangkok-red-line-suburban-trains-delivered/54901.article), [Wikipedia](https://en.wikipedia.org/wiki/Light_Red_Line_(Bangkok)) |

ลายสีรถทุกคันเป็นการประมาณ (❓) ควรเทียบกับภาพถ่ายก่อนใช้งานจริง

## ภูมิศาสตร์
- ✅ พรมแดนและแนวทางรถไฟ: Natural Earth 1:10m (`ne_10m_admin_0_countries`, `ne_10m_railroads`) — public domain
- ❓ ทางแยกฉะเชิงเทรา–แหลมฉบัง ลากเองโดยประมาณ (ไม่มีในข้อมูล Natural Earth)
