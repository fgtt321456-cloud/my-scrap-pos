# Thai Railway Management (Unity) · ระบบ Object Pooling

สคริปต์ C# สำหรับ Unity 2020.3 LTS ขึ้นไป (เขียนด้วย C# 7.x) ใช้ pool ตู้รถไฟ ตู้สินค้า และรถบริการภาคพื้นดิน

```
Assets/Scripts/
  Pooling/        PoolId, IPoolable, PooledObject, PoolCatalog, GameObjectPool, PoolManager
  Trains/         TrainCar, TrainDefinition, TrainConsist (+ ClassPool)
  GroundServices/ GroundServiceVehicle (+ ServiceType, IServiceRequester)
  Stations/       StationController (ตัวอย่างการขอ/คืนจาก pool)
```

## ข้อมูลเกมและระบบจำลอง (ย้ายมาจากต้นแบบเว็บ)

ภาพรวมระบบและแผนการย้ายอยู่ที่ [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)

```
Assets/StreamingAssets/RailTrack/   stations, timetable, rolling_stock, progression, difficulty, network (.json)
Assets/Scripts/
  Data/        RailTrackData (โมเดลข้อมูลตรงกับ JSON), RailTrackDataLoader (โหลดตอนเริ่มเกม รองรับ Android)
  Simulation/  Difficulty, WorldClock + DelayLedger, RailGraph (เส้นทางตามรางจริง), TimetableEvents,
               TimetableStationSim + StationService + StationTrackPath (จำลองสถานีตามตาราง, C# ล้วน)
  Game/        RailTrackWorld (นาฬิกาโลก, สถานีทุกแห่ง, กระเป๋าเงินชั่วคราว, บันทึกเกม)
  Stations/    IStationAdapter + TrainViewModel, TimetableStationAdapter, TimetableStationRunner (วางตู้รถตามราง),
               StationCameraRig (กล้องไอโซเมตริก เมาส์/สัมผัส)
  Scenery/     MeshData + StationSceneModel (ฉากสถานีจากผังจริง, C# ล้วน), TrainMeshModel (รถจำลองจากสีลายรถ),
               StationSceneBuilder (สร้าง Mesh 2 ชิ้น = 2 draw call + ป้ายชื่อ)
  UI/          StationHud (HUD สร้างด้วยโค้ด อ่านจาก adapter อย่างเดียว)
  Game/        StationSceneBootstrap (ฉากเปล่า → สถานีที่เล่นได้)
  Trains/      TrainLibrary (โมเดลรถไฟละเอียดจาก Resources), RollingStockCatalog (รหัสรุ่นรถ → prefab ใน pool),
               CarSources (prefab จริง → โมเดลละเอียด → รถจำลองแบบง่าย ตามที่มี)
Assets/Resources/RailTrack/  shader สีตามจุดยอด (ทึบ/โปร่งใส), shader รถไฟ (ลายรถ + ไฟหน้าต่างกลางคืน)
Assets/Resources/RailTrack/Trains/  โมเดลรถไฟละเอียด 17 แบบ (trains.json) + atlas ลายรถ 12 แบบ (ส่งออกจากเว็บ ภาพเหมือนกัน)
tools/check/   คอมไพล์สคริปต์ทั้งหมดและตรวจข้อมูลโดยไม่ต้องเปิด Unity: sh unity/tools/check/check.sh
               ดูภาพฉากที่สร้าง: DUMP=<dir> sh unity/tools/check/check.sh && node unity/tools/check/render_scenery.js <dir>
               ดูภาพรถไฟ (ตรวจด้านและตัวอักษรข้างรถ): node unity/tools/check/render_trains.js <dir>
```

- อัปเดต JSON: `node railway/tools/export_unity.js` (อย่าแก้ไฟล์ JSON ด้วยมือ ให้แก้ที่ `railway/src` แล้วส่งออกใหม่)
- ระบบใน `Simulation/` เป็น C# ล้วน รับ `System.Random` จากภายนอกเพื่อให้ทดสอบซ้ำได้

### เริ่มเร็วที่สุด: ฉากเปล่า + คอมโพเนนต์เดียว
1. สร้าง scene ใหม่ → GameObject เปล่า → เพิ่ม `StationSceneBootstrap` → กด Play
2. ได้สถานีเชียงใหม่ที่สร้างจากผังจริงทันที: ราง ชานชาลา หลังคา อาคารทรงล้านนา โรงรถจักร วงเวียนกลับรถจักร ดอยสุเทพ
   พร้อมขบวนรถตามตารางจริงด้วยโมเดลรถไฟละเอียดชุดเดียวกับเว็บ (ไฟหน้าต่างและไฟหน้าติดตอนกลางคืน), กล้องไอโซเมตริก, HUD และกลางวัน/กลางคืน
3. ปุ่มมุมขวาบน: หยุด/1×/2×/4× และสลับสถานี CMI NKI UBN HDY KRT · ตั้ง `font` เป็นฟอนต์ไทย (เช่น IBM Plex Sans Thai) เพื่อให้ตัวอักษรไทยสวย
4. ควบคุม: ลากเพื่อเลื่อน, ล้อเมาส์/บีบนิ้วเพื่อซูม, คลิกขวาลาก/หมุนสองนิ้วเพื่อหมุน, แตะขบวนเพื่อเลือก

ข้อกำหนด: Built-in Render Pipeline (shader อยู่ที่ `Assets/Resources/RailTrack/`), Active Input Handling = "Input Manager" หรือ "Both"
ถ้าใช้ URP ให้ทำ Shader Graph ที่คูณ Base Color ด้วย Vertex Color แล้วใส่ให้ `StationSceneBuilder` และ `TimetableStationRunner`

### ตั้งฉากสถานีตามตาราง (แบบประกอบเอง)
1. Bootstrap scene: `RailTrackDataLoader`, `RailTrackWorld`, `PoolManager` (DontDestroyOnLoad)
2. `Create > Thai Railway > Rolling Stock Catalog`: เพิ่มแถว `HID`, `ALS`, `GEK`, `cnr`, `coach`, `THN`, `THN_car`, `NKF`, `NKF_car`, `ASR`, `ASR_car`, `APD`, `APD_car` → PoolId ของ prefab (รุ่นที่ยังไม่มีโมเดลจะใช้ `fallback`)
3. ฉากสถานี: GameObject ที่มี `TimetableStationRunner` ตั้ง `stationId` (CMI/NKI/UBN/HDY/KRT) และ catalog
   พิกัด 1 หน่วย = 1 เมตร แกน x ตามชานชาลา (ฝั่งกันชนของสถานีปลายตันอยู่ด้าน −x) ตรงกับ `StationDef`
4. UI: อ่าน `runner.Adapter` (`Items`, `ViewModel`, `Platforms`, `Choose`, `Act`) เท่านั้น


## ติดตั้ง

1. **Prefab**: ใส่ `TrainCar` ให้ prefab ตู้รถไฟแต่ละแบบ (ตั้ง `role`, `length`, และ `cargoSlots` สำหรับตู้สินค้า) ใส่ `GroundServiceVehicle` ให้รถยก รถน้ำมัน และรถทำความสะอาด ส่วนตู้คอนเทนเนอร์ไม่ต้องใส่สคริปต์ (`PooledObject` ถูกเพิ่มให้อัตโนมัติ)
2. **Pool Catalog**: `Create > Thai Railway > Pool Catalog` แล้วเพิ่มแถวละ `PoolId` กับ prefab กำหนด `prewarm` (จำนวนสร้างล่วงหน้า) และ `maxSize`
3. **Train Definition**: `Create > Thai Railway > Train Definition` หนึ่งไฟล์ต่อรุ่นรถ:

   | รุ่น | head | middle | tail | runAround |
   |---|---|---|---|---|
   | THN DMU (T1) | ThnDmuCab | ThnDmuTrailer ×1–2 | ThnDmuCab | ไม่ |
   | Alsthom AD24C (T2) | Ad24cLocomotive | ContainerFlatWagon ×4–8 | None | ใช่ |
   | ASR Sprinter (T3) | AsrSprinterCab | AsrSprinterCoach ×1–2 | AsrSprinterCab | ไม่ |
   | QSY Ultraman (T4) | QsyLocomotive | QsyVipCoach / ContainerFlatWagon | None | ใช่ |

4. **PoolManager**: วางบน GameObject ใน scene แรก (bootstrap/loading) แล้วผูก catalog ไว้ ตั้งค่าให้อยู่ข้าม scene ได้
5. **StationController**: ตั้ง `platforms` (จุดหยุดรถ โดยแกน forward หันเข้าหากันชน และเส้นทางถนนจากอู่ไปยังข้างชานชาลา) และ `serviceDepot`

## การใช้งาน

```csharp
// ขบวนรถได้ชานชาลา: สร้างตู้จาก pool
station.AssignTrainToPlatform(ad24cDefinition, platformIndex: 2);

// ผู้เล่นแตะไอคอนบริการ: รถบริการออกจาก pool ไปทำงานแล้วคืนตัวเองเมื่อเสร็จ
station.RequestService(2, ServiceType.Refuel);

// ปุ่มเหลือง Depart: ตู้ทุกตู้และตู้คอนเทนเนอร์กลับเข้า pool
if (station.IsReadyToDepart(2)) station.Depart(2);

// ใช้ pool ตรงๆ
var car = PoolManager.Instance.Spawn<TrainCar>(PoolId.QsyVipCoach, pos, rot);
PoolManager.Instance.Release(car.Pooled);
PoolManager.Instance.ReleaseAfter(effect, 2f); // ปลอดภัยแม้ object ถูกคืนแล้วนำไปใช้ใหม่ก่อนครบเวลา
```

สถานะต่อรอบการใช้งานต้องรีเซ็ตใน `IPoolable.OnSpawned/OnDespawned` ไม่ใช่ใน `Awake` เพราะ `Awake` ทำงานครั้งเดียวต่อ instance

## สิ่งที่ทำเพื่อประสิทธิภาพบนมือถือ

- ค้นหา pool ด้วย `PoolId` เป็น index ของ array: ไม่มี string ไม่มี dictionary
- Spawn/Release ไม่เรียก `GetComponent` (cache ไว้ใน `PooledObject`) ไม่สร้าง garbage ไม่ใช้ LINQ หรือ lambda
- Instance เก็บใต้ root ที่ปิดอยู่ การ spawn จึงเป็นการย้าย parent ครั้งเดียว และ object ใหม่ไม่รัน `OnEnable` หรือ render ก่อนถูกใช้
- Prewarm แบ่งทำทีละไม่กี่ชิ้นต่อเฟรม (`prewarmPerFrame`) ระหว่างหน้าโหลด จึงไม่กระตุก
- ลบออกจากรายการที่ใช้งานอยู่แบบ swap-remove (O(1))
- `ReleaseAfter` ใช้รายการเดียวที่ tick ใน `Update` แทน coroutine ต่อ object
- เปลี่ยนสีตอนเลือกตู้ด้วย `MaterialPropertyBlock` จึงไม่สร้าง material ใหม่และไม่ทำลาย batching
- `TrainConsist` เป็น class ธรรมดาที่ recycle ผ่าน `ClassPool<T>`
- รถบริการที่อยู่ใน pool ถูกปิดอยู่ จึงไม่กิน `Update`

## ปรับจำนวน prewarm

เล่นช่วงที่สถานีพลุกพล่านที่สุดใน Editor หรือ Development Build แล้วคลิกขวาที่ PoolManager เลือก **Log Pool Stats** จากนั้นตั้ง `prewarm` ให้เท่ากับค่า `peak` ค่า `runtime instantiations` ควรเป็น 0 ถ้าไม่ใช่ จะมีคำเตือนใน Console ครั้งแรกที่ pool นั้นหมด

## การตรวจสอบ

โค้ดผ่านการคอมไพล์ด้วย Mono C# (`-langversion:7.2`) กับ stub ของ UnityEngine API เท่านั้น ยังไม่ได้รันใน Unity Editor จริง
