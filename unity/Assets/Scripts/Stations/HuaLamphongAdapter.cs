using System;
using System.Collections.Generic;
using System.Linq;
using ThaiRail.Simulation.Hlp;

namespace ThaiRail.Stations
{
    /// <summary>
    /// IStationAdapter for Hua Lamphong. Port of HLP_ADAPTER (railway/src/station_view.js) and its helpers in
    /// hlp_ui.js (phaseText, schedText, cardAction, platInfo, planClash, svcAlert, previewTrack).
    /// "Choose" sets the NX arrival route for an approaching train, or records a platform plan for a scheduled one
    /// that the approach ARS then follows. "Go" sets the departure route.
    /// </summary>
    public sealed class HuaLamphongAdapter : IStationAdapter
    {
        readonly HlpEngine _e;
        readonly List<string> _items = new List<string>(16);
        readonly List<PlatformChoice> _plats = new List<PlatformChoice>(14);
        const string CLS = "ABCD";

        public event Action<string> FollowRequested, SelectionChanged, Message;
        /// <summary>Edges of the route a platform choice would take (null = clear the preview).</summary>
        public event Action<HashSet<int>> PreviewChanged;

        public HuaLamphongAdapter(HlpEngine engine) { _e = engine; }
        HlpState S { get { return _e.S; } }

        static int Rank(HlpPhase p)
        {
            switch (p) { case HlpPhase.Held: return 0; case HlpPhase.Approach: return 1; case HlpPhase.Entering: return 2; case HlpPhase.Dwell: return 3; case HlpPhase.Departing: return 4; default: return 5; }
        }
        bool IsNextArrival(HlpService s) { var n = _e.NextArrivalSvc(); return n != null && n.id == s.id; }
        /// <summary>The train needs the player (port of svcAlert).</summary>
        public bool Alert(HlpService s)
        {
            if (s.phase == HlpPhase.Held) return true;
            if (s.phase == HlpPhase.Approach && IsNextArrival(s) && !_e.HasRouteFrom("HA")) return true;
            if (s.phase == HlpPhase.Dwell && s.state == HlpSvcState.Ready && S.now >= s.schedDep - 30 && !_e.HasRouteFrom("ST" + s.track)) return true;
            return false;
        }

        public IReadOnlyList<string> Items(ListFilter filter)
        {
            var list = S.services.Where(s => filter == ListFilter.All
                || (filter == ListFilter.Arrivals && (s.phase == HlpPhase.Sched || s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held || s.phase == HlpPhase.Entering))
                || (filter == ListFilter.InPlatform && (s.phase == HlpPhase.Dwell || s.phase == HlpPhase.Departing)));
            _items.Clear();
            _items.AddRange(list.OrderByDescending(s => Alert(s) ? 1 : 0).ThenBy(s => s.phase == HlpPhase.Sched ? 1 : 0).ThenBy(s => s.schedArr).Take(14).Select(s => s.id));
            return _items;
        }

        static string MmSs(double s) { s = Math.Max(0, s); return ((int)(s / 60)) + ":" + ((int)(s % 60)).ToString("00"); }
        string[] PhaseText(HlpService s)
        {
            var c = _e.Cons(s.cid);
            switch (s.phase)
            {
                case HlpPhase.Sched: return new[] { s.lateIn > 0 ? "ล่าช้า " + s.lateIn + " นาที" : "ตามกำหนด", "กำหนดเข้า " + HlpEngine.Clock(s.schedArr) + (s.lateIn > 0 ? " · คาดว่าถึง " + HlpEngine.Clock(s.schedArr + s.lateIn * 60) : "") + (s.plan > 0 ? " · วางแผนราง " + s.plan : "") };
                case HlpPhase.Approach: return new[] { "กำลังเข้าเขต", c != null ? "ห่างสัญญาณ H " + Math.Max(0, Math.Round(c.stopS - c.s)) + " ม. · " + Math.Round(c.v * 3.6) + " กม./ชม." : "กำลังเข้าเขตสถานี" };
                case HlpPhase.Held: return new[] { "รอสัญญาณ H", "หยุดรอที่สัญญาณ H มา " + MmSs(s.hold) + " นาที" };
                case HlpPhase.Entering: return new[] { "เข้าชานชาลา", "กำลังเข้าราง " + s.track + (c != null ? " · " + Math.Round(c.v * 3.6) + " กม./ชม." : "") };
                case HlpPhase.Dwell:
                    {
                        int d = s.tasks.Count(t => t.st == TaskState.Done);
                        return s.state == HlpSvcState.Ready ? new[] { "พร้อมออก", "พร้อมออกจากราง " + s.track }
                            : new[] { "กลับขบวน", "งานกลับขบวน " + d + "/" + s.tasks.Count + (s.tasks.Any(t => t.st == TaskState.Queue) ? " · มีงานรอทีม" : "") + (s.lh && s.ra.why != "" ? " · " + s.ra.why : "") };
                    }
                case HlpPhase.Departing: return new[] { "กำลังออก", "ออกจากสถานีผ่านคอขวด" };
            }
            return new[] { "—", "" };
        }
        void CardAction(HlpService s, out string label, out bool enabled, out CardActionKind kind, out bool routeMode)
        {
            routeMode = false;
            if (s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held)
            {
                routeMode = true;
                if (_e.HasRouteFrom("HA")) { label = "ตั้งเส้นทางเข้าแล้ว"; enabled = false; kind = CardActionKind.None; return; }
                bool next = IsNextArrival(s); label = next ? "เลือกชานชาลา" : "รอคิวขบวนก่อนหน้า"; enabled = next; kind = next ? CardActionKind.OpenPlatformSheet : CardActionKind.None; return;
            }
            if (s.phase == HlpPhase.Sched) { label = s.plan > 0 ? "เปลี่ยนแผน (ราง " + s.plan + ")" : "วางแผนชานชาลา"; enabled = true; kind = CardActionKind.OpenPlatformSheet; return; }
            if (s.phase == HlpPhase.Dwell)
            {
                if (_e.HasRouteFrom("ST" + s.track)) { label = "ตั้งเส้นทางออกแล้ว"; enabled = false; kind = CardActionKind.None; return; }
                if (s.state == HlpSvcState.Ready) { label = "ปล่อยรถ"; enabled = true; kind = CardActionKind.Go; return; }
                label = PhaseText(s)[1].Replace(" · มีงานรอทีม", ""); enabled = false; kind = CardActionKind.None; return;
            }
            label = s.phase == HlpPhase.Entering ? "กำลังเข้าชานชาลา" : "กำลังออก"; enabled = false; kind = CardActionKind.None;
        }

        public TrainViewModel ViewModel(string id)
        {
            var s = _e.Svc(id); if (s == null) return null;
            var ph = PhaseText(s); string ty = _e.SvcType(s); string reg = _e.RegionOf(s); var R = _e.RegionStat(reg);
            string al; bool en; CardActionKind kind; bool routeMode; CardAction(s, out al, out en, out kind, out routeMode);
            var vm = new TrainViewModel
            {
                id = s.id, alert = Alert(s), icon = s.phase == HlpPhase.Sched || s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held ? TrainIcon.Arriving : s.phase == HlpPhase.Departing ? TrainIcon.Departing : TrainIcon.InPlatform,
                code = ty, cls = HlpEngine.TrainClass(s), lift = s.Task("lift") != null, real = false, special = s.special,
                right = reg, sub = s.track > 0 ? "ราง " + s.track : HlpEngine.Clock(s.phase == HlpPhase.Dwell || s.phase == HlpPhase.Departing ? s.schedDep : s.schedArr),
                name = s.name, label = s.from, typeName = ty, phase = ph[0], platform = s.track > 0 ? "ราง " + s.track : s.plan > 0 ? "แผน " + s.plan : "—",
                op = "การรถไฟแห่งประเทศไทย", consist = s.lh ? new[] { ty, "coach", "coach" } : new[] { ty, ty + "_car", ty },
                status = ph[1], hasContract = true, contractTitle = "สัญญาเดินรถ" + reg, contractN = R.n, contractUp = R.up, contractDown = R.down,
                actionLabel = al, actionEnabled = en, actionKind = kind, inDelayMinutes = s.lateIn, fault = s.Task("repair") != null ? "ต้องซ่อมด่วน" : "",
                sheetTitle = routeMode ? "เลือกชานชาลา" : "วางแผนชานชาลา", sheetSub = s.name + " · ขนาด " + CLS[HlpEngine.TrainClass(s)] + " · " + (s.lh ? "หัวรถจักร (ต้องสับหลีก)" : "push-pull"),
                sheetOpen = s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held || s.phase == HlpPhase.Sched,
            };
            Sched(s, vm);
            return vm;
        }
        void Sched(HlpService s, TrainViewModel vm)   // port of schedText()
        {
            if (s.phase == HlpPhase.Dwell || s.phase == HlpPhase.Departing)
            {
                int late = (int)Math.Round((S.now - s.schedDep) / 60);
                if (late > 0) { vm.schedLabel = "ล่าช้า"; vm.schedValue = late + " นาที"; vm.schedTone = Tone.Bad; vm.schedProgress = 1; return; }
                double left = Math.Max(0, s.schedDep - S.now);
                vm.schedLabel = "ออกตามกำหนด"; vm.schedValue = HlpEngine.Clock(s.schedDep) + " · อีก " + MmSs(left); vm.schedTone = Tone.Good;
                vm.schedProgress = (float)(1 - left / ((s.schedDep - s.schedArr) == 0 ? 1 : s.schedDep - s.schedArr)); return;
            }
            if (s.phase == HlpPhase.Held) { vm.schedLabel = "ค่าปรับรอสัญญาณ"; vm.schedValue = "฿" + Math.Round(s.hold * 2.5).ToString("N0"); vm.schedTone = Tone.Bad; vm.schedProgress = 1; return; }
            double l = s.schedArr - S.now;
            vm.schedLabel = "ถึงสัญญาณ H"; vm.schedValue = l > 0 ? "อีก " + MmSs(l) : "กำลังถึง"; vm.schedTone = Tone.Neutral; vm.schedProgress = 0.5f;
        }

        HlpService PlanClash(HlpService s, int T)
        {
            double a = s.schedArr, b = s.schedDep + 300;
            return S.services.FirstOrDefault(o => o != s && ((o.track == T && (o.phase == HlpPhase.Entering || o.phase == HlpPhase.Dwell || o.phase == HlpPhase.Departing) && o.schedDep + 300 > a)
                || (o.plan == T && o.phase == HlpPhase.Sched && o.schedArr < b && a < o.schedDep + 300)));
        }
        bool PlatInfo(HlpService s, int T, bool routeMode, out string why)
        {
            if (HlpEngine.TrainClass(s) > HlpEngine.PlatClass(T)) { why = "สั้นเกินไป"; return false; }
            if (routeMode)
            {
                if (!_e.TrackFree(T)) { var occ = _e.TrackSvc(T); why = occ != null ? "มี " + occ.name : "ทางถูกล็อก"; return false; }
                var rule = _e.ArrivalRule(T, s);
                if (rule != null) { why = rule.Contains("รางคู่") ? "รางคู่กำลังสับหลีก" : rule.Contains("ปลายราง") ? "มีหัวรถจักรที่ปลายราง" : "ขัดระเบียบ"; return false; }
                why = s.plan == T ? "ตามแผน ✓" : "ว่าง"; return true;
            }
            var c = PlanClash(s, T); if (c != null) { why = "ชนกับ " + c.name; return false; }
            why = s.plan == T ? "แผนปัจจุบัน" : "ว่างช่วงเวลานี้"; return true;
        }
        public IReadOnlyList<PlatformChoice> Platforms(string id)
        {
            _plats.Clear(); var s = _e.Svc(id); if (s == null) return _plats;
            bool routeMode = s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held;
            for (int T = 1; T <= 14; T++) { string why; bool ok = PlatInfo(s, T, routeMode, out why); _plats.Add(new PlatformChoice { n = T, ok = ok, why = why, maxClass = HlpEngine.PlatClass(T), planned = s.plan == T }); }
            return _plats;
        }
        public bool Choose(string id, int T)
        {
            var s = _e.Svc(id); if (s == null) return false;
            if (s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held)
            {
                string msg; bool ok = _e.RequestArrival(T, false, out msg);
                if (msg != null && Message != null) Message(msg);
                return ok;
            }
            s.plan = T;
            if (Message != null) Message("วางแผน " + s.name + " เข้าราง " + T + (S.arsArr ? "" : " · เปิด ARS ขาเข้าให้ทำตามแผน หรือเลือกเองเมื่อขบวนมาถึง"));
            return true;
        }
        public void Act(string id, CardActionKind kind)
        {
            var s = _e.Svc(id); if (s == null || kind != CardActionKind.Go) return;
            string msg; _e.RequestDeparture(s.track, false, out msg);
            if (msg != null && Message != null) Message(msg);
        }
        public void Follow(string id) { if (FollowRequested != null) FollowRequested(id); }
        public void Select(string id) { if (SelectionChanged != null) SelectionChanged(id); }
        public void Preview(int? platform, string id)
        {
            if (PreviewChanged == null) return;
            var s = id != null ? _e.Svc(id) : null;
            if (platform == null || s == null || !(s.phase == HlpPhase.Approach || s.phase == HlpPhase.Held)) { PreviewChanged(null); return; }
            int goal = _e.G.E("pw" + platform.Value);
            var p = _e.FindPath(new HlpStep(_e.G.E("aFar"), 1), n => n.e == goal && n.dir == -1, false);
            PreviewChanged(p == null ? null : new HashSet<int>(p.Select(n => n.e)));
        }
    }
}
