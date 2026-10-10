using System;
using System.Collections.Generic;
using ThaiRail.Data;
using ThaiRail.Simulation;

namespace ThaiRail.Stations
{
    /// <summary>
    /// IStationAdapter for the timetable stations. Port of STN_ADAPTER in railway/src/station_view.js:
    /// turns TimetableStationSim services into TrainViewModels and routes UI actions back to the sim.
    /// Camera follow / selection / route preview are raised as events for the scene view to handle.
    /// </summary>
    public sealed class TimetableStationAdapter : IStationAdapter
    {
        readonly TimetableStationSim _sim;
        readonly RailTrackDatabase _db;
        readonly List<string> _items = new List<string>(16);
        readonly List<StationService> _buf = new List<StationService>(64);
        readonly List<PlatformChoice> _plats = new List<PlatformChoice>(16);

        public event Action<string> FollowRequested, SelectionChanged;
        public event Action<string> Message;

        public TimetableStationAdapter(TimetableStationSim sim, RailTrackDatabase db) { _sim = sim; _db = db; }

        static bool IsArrival(ServicePhase p) { return p == ServicePhase.Sched || p == ServicePhase.Approach || p == ServicePhase.Held || p == ServicePhase.Entering; }
        static bool Choosable(ServicePhase p) { return p == ServicePhase.Sched || p == ServicePhase.Approach || p == ServicePhase.Held; }

        public IReadOnlyList<string> Items(ListFilter filter)
        {
            var S = _sim.State; _buf.Clear();
            foreach (var s in S.services)
            {
                if (s.phase == ServicePhase.Gone || s.schedArr - S.now >= 3 * 3600) continue;
                if (filter == ListFilter.Arrivals && !IsArrival(s.phase)) continue;
                if (filter == ListFilter.InPlatform && !(s.phase == ServicePhase.Dwell || s.phase == ServicePhase.Ready || s.phase == ServicePhase.Departing)) continue;
                _buf.Add(s);
            }
            // urgent first, then by scheduled arrival; List.Sort is unstable, so break ties by list order
            var order = new Dictionary<StationService, int>(); for (int i = 0; i < _buf.Count; i++) order[_buf[i]] = i;
            _buf.Sort((a, b) =>
            {
                int c = (_sim.NeedsAttention(b) ? 1 : 0).CompareTo(_sim.NeedsAttention(a) ? 1 : 0); if (c != 0) return c;
                c = a.schedArr.CompareTo(b.schedArr); return c != 0 ? c : order[a].CompareTo(order[b]);
            });
            _items.Clear(); for (int i = 0; i < _buf.Count && i < 14; i++) _items.Add(_buf[i].id);
            return _items;
        }

        public static string PhaseText(StationService s)
        {
            switch (s.phase)
            {
                case ServicePhase.Sched: return "ตามกำหนด";
                case ServicePhase.Approach: return "กำลังเข้าเขต";
                case ServicePhase.Held: return "รอสัญญาณเข้า";
                case ServicePhase.Entering: return "เข้าชานชาลา";
                case ServicePhase.Dwell: return s.mode == StopMode.Terminates ? "ส่งผู้โดยสารลง" : s.mode == StopMode.Originates ? "รับผู้โดยสาร" : "จอดรับส่ง";
                case ServicePhase.Ready: return s.mode == StopMode.Terminates ? "พร้อมเข้าศูนย์ซ่อม" : "พร้อมออก";
                case ServicePhase.Departing: return "กำลังออก";
                default: return "ออกแล้ว";
            }
        }

        public TrainViewModel ViewModel(string id)
        {
            var s = _sim.Find(id); if (s == null) return null;
            var S = _sim.State;
            int late = (int)Clock.JsRound((s.mode == StopMode.Terminates ? (s.arrAt >= 0 ? s.arrAt : S.now) - s.schedArr : S.now - s.schedDep) / 60);
            string status;
            switch (s.phase)
            {
                case ServicePhase.Sched: status = "เข้าเขตสถานีเวลา " + Clock.HM(s.Eta - 300) + (s.inDelay > 0 ? " · ต้นทางช้า " + s.inDelay + " นาที" : ""); break;
                case ServicePhase.Approach: status = s.track != 0 ? "ได้รางที่ " + s.track + " แล้ว กำลังรอเปิดสัญญาณ" : "ยังไม่ได้เลือกชานชาลา"; break;
                case ServicePhase.Held: status = "หยุดรอที่สัญญาณเข้า " + (int)(s.hold / 60) + " นาที · เสียค่าปรับ"; break;
                case ServicePhase.Entering: status = "กำลังเข้าราง " + s.track; break;
                case ServicePhase.Dwell: status = PhaseText(s) + " · เสร็จราว " + Clock.HM(s.readyAt) + (s.lift ? " · ใช้ลิฟต์วีลแชร์" : "") + (s.fault != "" ? " · " + s.fault : ""); break;
                case ServicePhase.Ready: status = s.mode == StopMode.Terminates ? "ส่งขบวนเปล่าเข้าศูนย์ซ่อมเพื่อคืนชานชาลา" : "ผู้โดยสารขึ้นครบ รอปล่อยรถ"; break;
                case ServicePhase.Departing: status = "ออกจากสถานีผ่านคอขวด"; break;
                default: status = ""; break;
            }
            var vm = new TrainViewModel
            {
                id = s.id, alert = _sim.NeedsAttention(s),
                icon = Choosable(s.phase) ? TrainIcon.Arriving : s.phase == ServicePhase.Departing ? TrainIcon.Departing : TrainIcon.InPlatform,
                code = LastWord(s.name), cls = s.SizeClass, lift = s.lift, real = s.real,
                right = FirstWord(s.cls), sub = s.track != 0 ? "ราง " + s.track : Clock.HM(s.mode == StopMode.Originates ? s.schedDep : s.schedArr),
                name = s.name, label = s.label, typeName = s.locoHauled ? TypeName(s.veh[0]) : "ดีเซลราง",
                phase = PhaseText(s), platform = s.track != 0 ? "ราง " + s.track : "—",
                op = s.real ? "ตารางเดินรถจริง" + (s.estimated ? " (เวลาผ่านโดยประมาณ)" : "") : "ขบวนจำลองเสริมตาราง",
                consist = Head(s.veh, 3),
                schedLabel = s.mode == StopMode.Terminates ? "ถึงตามกำหนด " + Clock.HM(s.schedArr) : "ออกตามกำหนด " + Clock.HM(s.schedDep),
                schedValue = late > 0 ? "ช้า " + late + " นาที" : "อีก " + (-late) + " นาที",
                schedTone = late > 3 ? Tone.Bad : Tone.Good,
                schedProgress = s.phase == ServicePhase.Dwell ? (float)Math.Max(0, Math.Min(1, 1 - (s.readyAt - S.now) / (20 * 60))) : s.phase == ServicePhase.Ready ? 1f : 0.3f,
                status = status, inDelayMinutes = s.inDelay, fault = s.fault,
                sheetTitle = "เลือกชานชาลา", sheetSub = s.name + " · ขนาด " + "ABCD"[s.SizeClass] + " · " + s.veh.Length + " คัน", sheetOpen = Choosable(s.phase),
            };
            vm.actionLabel = PhaseText(s); vm.actionEnabled = false; vm.actionKind = CardActionKind.None;
            if (Choosable(s.phase)) { vm.actionLabel = s.track != 0 ? "เปลี่ยนชานชาลา (ราง " + s.track + ")" : "เลือกชานชาลา"; vm.actionEnabled = true; vm.actionKind = CardActionKind.OpenPlatformSheet; }
            else if (s.phase == ServicePhase.Ready) { vm.actionLabel = s.mode == StopMode.Terminates ? "ส่งเข้าศูนย์ซ่อม" : "ปล่อยรถ"; vm.actionEnabled = true; vm.actionKind = CardActionKind.Go; }
            return vm;
        }

        public IReadOnlyList<PlatformChoice> Platforms(string id)
        {
            _plats.Clear(); var s = _sim.Find(id); if (s == null) return _plats;
            foreach (var t in _sim.Def.tracks)
            {
                string why; bool ok = _sim.TrackInfo(s, t, out why);
                _plats.Add(new PlatformChoice { n = t.n, ok = ok, why = s.track == t.n ? "เลือกแล้ว" : why, maxClass = t.cls, planned = s.track == t.n });
            }
            return _plats;
        }

        public bool Choose(string id, int platform)
        {
            var s = _sim.Find(id); if (s == null || !Choosable(s.phase)) return false;
            _sim.Assign(s, platform);
            if (Message != null) Message(s.name + " เข้าราง " + platform);
            return true;
        }

        public void Act(string id, CardActionKind kind)
        {
            var s = _sim.Find(id); if (s == null || kind != CardActionKind.Go || s.phase != ServicePhase.Ready) return;
            string why; if (!_sim.Release(s, out why) && Message != null) Message(why);
        }

        public void Follow(string id) { if (FollowRequested != null) FollowRequested(id); }
        public void Select(string id) { if (SelectionChanged != null) SelectionChanged(id); }
        public void Preview(int? platform, string id) { }   // timetable stations have no route preview (the web build does nothing either)

        string TypeName(string modelId)
        {
            var m = _db.Model(modelId); if (m == null) return modelId;
            var parts = m.name.Split(' ');
            return parts.Length > 1 ? parts[0] + " " + parts[1] : parts[0];
        }
        static string FirstWord(string x) { int i = x.IndexOf(' '); return i < 0 ? x : x.Substring(0, i); }
        static string LastWord(string x) { int i = x.LastIndexOf(' '); return i < 0 ? x : x.Substring(i + 1); }
        static string[] Head(string[] a, int n) { var r = new string[Math.Min(n, a.Length)]; Array.Copy(a, r, r.Length); return r; }
    }
}
