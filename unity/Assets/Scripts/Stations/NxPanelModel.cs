using System;
using System.Collections.Generic;
using ThaiRail.Simulation.Hlp;

namespace ThaiRail.Stations
{
    public enum NxEdgeState : byte { Free, Occupied, Route, Shunt }
    public enum NxButtonKind : byte { Platform, ExitMain, Signal, Switch }
    /// <summary>A pressable element of the panel in panel units (1000 × 285, y down), like the web build's SVG.</summary>
    public struct NxButton { public string id; public NxButtonKind kind; public float x, y; public string label, tooltip; }

    /// <summary>
    /// The NX (entrance–exit) relay panel of Hua Lamphong, without any drawing: layout in panel units and the
    /// press logic (entrance H or S1–S14, then exit: platform number or "ออก"; entrance again = cancel; a switch
    /// circle throws the switch). Port of nxBuild / nxClick / nxUpdate in railway/src/hlp_engine.js.
    /// </summary>
    public sealed class NxPanelModel
    {
        public const float Width = 1000, Height = 285;
        readonly HlpEngine _e;
        public string Selected { get; private set; }
        public readonly List<NxButton> Buttons = new List<NxButton>();
        /// <summary>Message for a toast after a press (null = nothing to say).</summary>
        public event Action<string> Message;

        public NxPanelModel(HlpEngine engine)
        {
            _e = engine;
            var G = engine.G;
            for (int i = 1; i <= 14; i++)
            {
                float y = Y(G.file.trackZ[i - 1]);
                Buttons.Add(new NxButton { id = "P" + i, kind = NxButtonKind.Platform, x = 17, y = y, label = i.ToString(), tooltip = "ทางออก: ชานชาลา " + i });
                Buttons.Add(new NxButton { id = "ST" + i, kind = NxButtonKind.Signal, x = X(280), y = y - 6.5f, label = "S" + i, tooltip = "ทางเข้า: สัญญาณออก S" + i });
            }
            Buttons.Add(new NxButton { id = "HA", kind = NxButtonKind.Signal, x = X(640), y = Y(40.5) - 8, label = "H", tooltip = "ทางเข้า: สัญญาณเข้า H" });
            Buttons.Add(new NxButton { id = "EX", kind = NxButtonKind.ExitMain, x = 979, y = Y(45) + 8.5f, label = "ออก", tooltip = "ทางออก: ทางประธานขาออก" });
            foreach (var n in G.nodes) if (G.IsSwitch(n.i)) Buttons.Add(new NxButton { id = "N:" + n.id, kind = NxButtonKind.Switch, x = X(n.x), y = Y(n.z), label = "", tooltip = n.label });
        }

        // panel mapping (NXX / NXZ)
        public static float X(double x) { return (float)(40 + (Math.Min(x, 700) + 35) * 1.27); }
        public static float Y(double z) { return (float)(30 + z * 2.6); }
        public HlpGraph Graph { get { return _e.G; } }

        public void Press(string id)
        {
            string msg = null;
            if (id.StartsWith("N:")) { _e.ThrowSwitch(_e.G.N(id.Substring(2)), out msg); Say(msg); return; }
            if (id == "HA" || id.StartsWith("ST"))
            {
                var ex = _e.S.routes.Find(r => r.from == id);
                if (ex != null) { _e.CancelRoute(ex, out msg); Say(msg); Selected = null; return; }
                Selected = Selected == id ? null : id; return;
            }
            if (Selected == null) { Say("กดปุ่มทางเข้าก่อน: H (ขาเข้า) หรือสามเหลี่ยม S1–S14 (ขาออก)"); return; }
            if (Selected == "HA" && id.StartsWith("P")) _e.RequestArrival(int.Parse(id.Substring(1)), false, out msg);
            else if (Selected.StartsWith("ST") && id == "EX") _e.RequestDeparture(int.Parse(Selected.Substring(2)), false, out msg);
            else msg = Selected == "HA" ? "ทางออกของสัญญาณ H คือปุ่มเลขชานชาลาด้านซ้าย" : "ทางออกของสัญญาณ S คือปุ่ม \"ออก\" ด้านขวา";
            Say(msg); Selected = null;
        }
        void Say(string m) { if (m != null && Message != null) Message(m); }

        // ---------- live state for drawing ----------
        public NxEdgeState EdgeState(int e, out bool setting)
        {
            setting = false;
            if (_e.OCC[e].Count > 0) return NxEdgeState.Occupied;
            string lk = _e.S.elock[e]; if (lk == "") return NxEdgeState.Free;
            var r = _e.S.routes.Find(x => x.id == lk); if (r == null) return NxEdgeState.Free;
            setting = !r.set;
            return r.kind == RouteKind.Shunt ? NxEdgeState.Shunt : NxEdgeState.Route;
        }
        /// <summary>Switch shown reversed (not position 0), still moving, or locked in a route.</summary>
        public void NodeState(int n, out bool reversed, out bool moving, out bool locked)
        {
            reversed = _e.S.nodePos[n] > 0; moving = _e.S.nodeMv[n] > 0; locked = _e.S.nlock[n] != "";
        }
        public string Aspect(string signalId) { return _e.SigAspect(signalId); }
        /// <summary>Train on platform track T for the tag beside it ("" = empty).</summary>
        public string TrackTag(int T)
        {
            var s = _e.TrackSvc(T); if (s == null) return "";
            return s.name + (s.state == HlpSvcState.Ready ? " · พร้อม" : s.phase == HlpPhase.Entering ? " · กำลังเข้า" : "");
        }
        public string Hint
        {
            get
            {
                if (Selected == null) return "กดทางเข้า (H หรือ S) แล้วกดทางออก · กดทางเข้าซ้ำเพื่อยกเลิก · กดวงกลมเพื่อกลับประแจ";
                return Selected == "HA" ? "เลือกชานชาลาปลายทาง (ปุ่มเลขด้านซ้าย)" : "เลือกทางออกของ S" + Selected.Substring(2) + " (ปุ่ม \"ออก\" ด้านขวา)";
            }
        }
        public bool ArsArr { get { return _e.S.arsArr; } }
        public bool ArsDep { get { return _e.S.arsDep; } }
    }

    /// <summary>
    /// ETCS driver-machine interface for the selected train: speed dial 0–160 km/h with the permitted-speed arc
    /// (CSG), target-speed monitoring arc (TSM), overspeed arc and needle colour, target distance and the movement
    /// authority message. Port of dmiUpdate (hlp_engine.js); numbers only, drawn by DmiView.
    /// </summary>
    public struct DmiState
    {
        public bool has;
        public string name, mode, target, message;
        public float speed, permitted, limit, targetSpeed, targetBar;   // km/h; bar 0..1 (log distance)
        public bool tsm, over;
        /// <summary>Needle: 0 white (ok), 1 yellow (above target in TSM), 2 orange (overspeed warning), 3 red (intervention).</summary>
        public int needle;

        public static DmiState For(HlpEngine e, string serviceId)
        {
            var d = new DmiState();
            var svc = e.Svc(serviceId); if (svc == null) return d;
            // during a run-around the locomotive is the moving consist
            var c = svc.lh && svc.ra.lid != "" && svc.ra.st != RaState.Done && svc.ra.st != RaState.Detach ? e.Cons(svc.ra.lid) ?? e.Cons(svc.cid) : e.Cons(svc.cid);
            if (c == null) return d;
            d.has = true;
            float v = (float)(c.v * 3.6), P = c.moving ? (float)(c.P * 3.6) : 0, vl = (float)((c.vlim > 0 && !double.IsInfinity(c.vlim) ? c.vlim : 0) * 3.6);
            d.speed = v; d.permitted = P; d.limit = vl;
            d.tsm = c.moving && c.tgKind != "" && P < vl - 1; d.targetSpeed = (float)(c.tgV * 3.6);
            d.over = v > P + 2;
            d.needle = v > P + 5 ? 3 : v > P + 2 ? 2 : d.tsm && v > d.targetSpeed + 1 ? 1 : 0;
            d.name = svc.name + (c.veh.Count == 1 && svc.lh && c.id != svc.cid ? " · หัวรถจักร" : "");
            d.mode = c.moving ? c.mode.ToString() : "SB";
            if (c.moving && c.tgKind != "")
            {
                d.target = "เป้าหมาย " + Math.Round(c.tgV * 3.6) + " กม./ชม. อีก " + Math.Round(c.tgD).ToString("N0") + " ม.";
                d.targetBar = (float)Math.Min(1, Math.Log10(1 + c.tgD) / 3);
            }
            else d.target = c.moving ? "ความเร็วจำกัด " + Math.Round(vl) + " กม./ชม." : "จอดนิ่ง";
            int T = svc.track, Q = HlpEngine.PartnerOf(T > 0 ? T : 1);
            switch (c.job)
            {
                case ConsistJob.Approach: d.message = "MA สิ้นสุดที่สัญญาณ H · รอตั้งเส้นทาง"; break;
                case ConsistJob.Arr: d.message = "MA ถึงชานชาลา " + T + " · โค้งเบรกเข้าชานชาลา"; break;
                case ConsistJob.Dep: d.message = "MA ถึงทางประธานขาออก"; break;
                case ConsistJob.Leg1: d.message = "SH: หัวรถจักรไปปลายราง " + Q; break;
                case ConsistJob.Leg2: d.message = "SH: วิ่งราง " + Q + " ออกไปกลับรถที่คอขวด"; break;
                case ConsistJob.Leg3: d.message = "SH: กลับเข้าราง " + T + " ต่อท้ายขบวน"; break;
                default: d.message = svc.phase == HlpPhase.Dwell ? "จอดชานชาลา " + T + " · กลับขบวน" : ""; break;
            }
            return d;
        }
        /// <summary>Dial angle in degrees for a speed (−144° at 0 to +144° at 160 km/h, clockwise from up).</summary>
        public static float Angle(float kmh) { return -144 + Math.Max(0, Math.Min(160, kmh)) / 160f * 288; }
    }
}
