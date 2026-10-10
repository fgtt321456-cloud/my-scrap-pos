using System;
using System.Collections.Generic;
using System.Linq;
using ThaiRail.Data;

namespace ThaiRail.Simulation.Hlp
{
    /// <summary>
    /// Hua Lamphong (Bangkok) terminus: 14 dead-end platform tracks behind a double-slip throat, worked by an NX
    /// relay interlocking with route locking and sectional release, ETCS-style braking-curve supervision, run-around
    /// shunting of locomotive-hauled trains, push-pull turnarounds and shared ground-service teams.
    /// Pure C# port of railway/src/hlp_engine.js (simulation part, lines 82–575). Keep the two in step.
    /// </summary>
    public sealed class HlpEngine
    {
        public readonly HlpGraph G;
        public HlpState S { get; private set; }
        readonly IStationHost _host;
        readonly Difficulty _diff;
        readonly Random _rng;
        readonly HuaLamphongDef _def;
        readonly Dictionary<string, string> _origin = new Dictionary<string, string>(), _region = new Dictionary<string, string>();
        readonly HlpPhysics K;

        public event Action<StationLogEntry> Logged;
        /// <summary>Money popup at a map position (x, z): text, bad.</summary>
        public event Action<double, double, string, bool> Popup;

        // runtime track-circuit occupancy: per edge, the stretches consists cover (rebuilt every step)
        public struct Occ { public string cid; public double d0, d1; }
        public readonly List<Occ>[] OCC;

        // speeds (m/s) from the graph data
        const double Unreached = double.PositiveInfinity;
        int _aFar, _dFar;

        public HlpEngine(HlpFile file, HuaLamphongDef def, Difficulty diff, IStationHost host, Random rng, HlpState saved = null)
        {
            G = new HlpGraph(file); _def = def; _diff = diff; _host = host; _rng = rng; K = file.physics;
            foreach (var o in file.origins) _origin[o.name] = o.code;
            foreach (var r in file.regions) _region[r.code] = r.region;
            OCC = new List<Occ>[G.edges.Length]; for (int i = 0; i < OCC.Length; i++) OCC[i] = new List<Occ>();
            _aFar = G.E("aFar"); _dFar = G.E("dFar");
            S = saved != null && saved.v == 1 && saved.elock != null && saved.elock.Length == G.edges.Length ? saved : Seeded();
        }

        // ---------- helpers ----------
        int RInt(int a, int b) { return _rng.Next(a, b + 1); }
        T Pick<T>(T[] a) { return a[_rng.Next(a.Length)]; }
        public static string Clock(double t) { int m = (int)Math.Floor(t / 60); return ((m / 60) % 24).ToString("00") + ":" + (m % 60).ToString("00"); }
        public void Log(string text, LogTone tone = LogTone.Neutral)
        {
            var e = new StationLogEntry { time = Clock(S.now), text = text, tone = tone };
            S.log.Insert(0, e); if (S.log.Count > 60) S.log.RemoveRange(60, S.log.Count - 60);
            if (Logged != null) Logged(e);
        }
        public HlpConsist Cons(string id) { if (string.IsNullOrEmpty(id)) return null; foreach (var c in S.consists) if (c.id == id) return c; return null; }
        public HlpService Svc(string id) { if (string.IsNullOrEmpty(id)) return null; foreach (var s in S.services) if (s.id == id) return s; return null; }
        HlpRoute Route(string id) { if (string.IsNullOrEmpty(id)) return null; foreach (var r in S.routes) if (r.id == id) return r; return null; }
        public static int PartnerOf(int i) { return i % 2 == 1 ? i + 1 : i - 1; }
        /// <summary>Consist length class 0..3 (A ≤4 vehicles, B ≤6, C ≤8, D 9–10) and the class each platform accepts.</summary>
        public static int TrainClass(HlpService s) { int n = s.lh ? 1 + s.coaches : s.cars + 2; return n <= 4 ? 0 : n <= 6 ? 1 : n <= 8 ? 2 : 3; }
        public static int PlatClass(int T) { return T <= 6 ? 3 : T <= 10 ? 2 : 1; }
        int E(string id) { return G.E(id); }
        int Res(string k) { var r = G.file.resources; for (int i = 0; i < r.Length; i++) if (r[i].k == k) return i; return -1; }

        // ---------- new state ----------
        HlpState NewState()
        {
            var st = new HlpState
            {
                res = G.file.resources.Select(r => r.start).ToArray(),
                nodePos = new int[G.nodes.Length], nodeMv = new double[G.nodes.Length],
                elock = Enumerable.Repeat("", G.edges.Length).ToArray(), nlock = Enumerable.Repeat("", G.nodes.Length).ToArray(),
            };
            return st;
        }

        public HlpService MakeService(double arrT, bool? lhKind = null)
        {
            bool lh = lhKind ?? _rng.NextDouble() < 0.5;
            var s = new HlpService { id = "S" + (S.nextId++), lh = lh, schedArr = arrT, phase = HlpPhase.Sched, lateIn = _diff.RollDelay(arrT), pax = RInt(160, 420), paxOut = RInt(160, 420) };
            if (lh)
            {
                var o = Pick(_def.longHaul);
                s.name = "ธรรมดา " + (o.no + 1); s.outName = "ธรรมดา " + o.no; s.from = o.from; s.coaches = RInt(6, 9); s.pax = RInt(300, 560); s.paxOut = RInt(280, 560); s.schedDep = arrT + 45 * 60;
            }
            else
            {
                var o = Pick(_def.pushPull);
                s.name = "ชานเมือง " + (o.no + 1); s.outName = "ชานเมือง " + o.no; s.from = o.from; s.cars = RInt(2, 4); s.schedDep = arrT + 28 * 60;
            }
            return s;
        }
        /// <summary>Locomotive / DMU model for a service (chosen once, like svcType()).</summary>
        public string SvcType(HlpService s) { if (s.ty == "") s.ty = Pick(s.lh ? G.file.locoTypes : G.file.dmuTypes); return s.ty; }
        List<HlpVeh> VehOf(HlpService s)
        {
            string ty = SvcType(s); var v = new List<HlpVeh> { new HlpVeh(ty, 1) };
            if (s.lh) for (int i = 0; i < s.coaches; i++) v.Add(new HlpVeh("coach", 1));
            else { for (int i = 0; i < s.cars; i++) v.Add(new HlpVeh(ty + "_car", 1)); v.Add(new HlpVeh(ty, -1)); }
            return v;
        }
        HlpConsist NewConsist(List<HlpVeh> veh, List<HlpStep> steps, double s, string sid)
        {
            var c = new HlpConsist { id = "C" + (S.nextId++), sid = sid, veh = veh, len = veh.Count * K.carLen, steps = steps, s = s, mode = ConsistMode.SB };
            S.consists.Add(c); return c;
        }

        /// <summary>Opening scene (port of newTStateSeeded): three trains already in, one arriving.</summary>
        HlpState Seeded()
        {
            S = NewState();
            Func<HlpService, int, double, HlpConsist> place = (svc, T, ago) =>
            {
                svc.track = T; svc.phase = HlpPhase.Dwell; svc.state = HlpSvcState.Work; svc.arrAt = S.now - ago; svc.tasks = NewTasks(svc);
                var c = NewConsist(VehOf(svc), new List<HlpStep> { new HlpStep(E("pw" + T), -1) }, 244, svc.id); svc.cid = c.id;
                if (svc.lh) svc.ra = new HlpRunAround { st = RaState.Detach, t = 25 };
                S.services.Add(svc); return c;
            };
            Action<HlpTask> done = t => { t.st = TaskState.Done; t.p = 1; };
            var a = MakeService(S.now - 300, true); a.coaches = Math.Min(a.coaches, 7); place(a, 9, 300); a.Task("alight").p = 0.7;
            var b = MakeService(S.now - 1100, false); var cb = place(b, 4, 1100);
            done(b.Task("alight")); done(b.Task("turn")); ReverseConsist(cb);
            b.Task("clean").st = TaskState.Run; b.Task("clean").p = 0.5; b.Task("fuel").st = TaskState.Run; b.Task("fuel").p = 0.6;
            var d = MakeService(S.now - 1500, false); var cd = place(d, 13, 1500);
            foreach (var n in new[] { "alight", "turn", "clean", "fuel", "board" }) done(d.Task(n));
            ReverseConsist(cd); d.state = HlpSvcState.Ready; d.schedDep = S.now + 120;
            var e = MakeService(S.now + 30, true); e.lateIn = 0; S.services.Add(e);
            S.stats.arr = 3;
            return S;
        }

        // ---------- graph search ----------
        public struct SN { public int e, dir, r, node, pi; public double c; public bool rev; }
        List<SN> NextSteps(int eid, int dir)
        {
            var e = G.edges[eid]; int nid = dir > 0 ? e.v : e.u; var N = G.nodes[nid]; var outL = new List<SN>(2);
            for (int pi = 0; pi < N.pairs.Length; pi++)
            {
                var p = N.pairs[pi]; int f = p[0] == eid ? p[1] : p[1] == eid ? p[0] : -1;
                if (f >= 0) outL.Add(new SN { e = f, dir = G.edges[f].u == nid ? 1 : -1, node = nid, pi = pi });
            }
            return outL;
        }
        /// <summary>
        /// Dijkstra over directed edges (no reversing on a switch); with allowRev one reversal is allowed on an edge
        /// that permits it (cost +80 m). Returns the path from the start step, or null. Port of findPath().
        /// </summary>
        public List<SN> FindPath(HlpStep start, Func<SN, bool> isGoal, bool allowRev, Func<int, int, bool> blocked = null)
        {
            Func<int, int, int, int> Key = (e, d, r) => (e * 2 + (d > 0 ? 1 : 0)) * 2 + r;
            var best = new Dictionary<int, double>(); var prev = new Dictionary<int, KeyValuePair<int, SN>>();
            var open = new List<SN> { new SN { e = start.e, dir = start.dir, node = -1 } }; best[Key(start.e, start.dir, 0)] = 0;
            SN? goal = null;
            while (open.Count > 0)
            {
                int bi = 0; for (int i = 1; i < open.Count; i++) if (open[i].c < open[bi].c) bi = i;
                var cur = open[bi]; open.RemoveAt(bi); int ck = Key(cur.e, cur.dir, cur.r);
                if (cur.c > best[ck]) continue;
                if (cur.c > 0 && isGoal(cur)) { goal = cur; break; }
                var moves = new List<SN>();
                foreach (var n in NextSteps(cur.e, cur.dir)) moves.Add(new SN { e = n.e, dir = n.dir, r = cur.r, c = cur.c + G.edges[n.e].len, node = n.node, pi = n.pi });
                if (allowRev && cur.r == 0 && cur.c > 0 && G.edges[cur.e].rev) moves.Add(new SN { e = cur.e, dir = -cur.dir, r = 1, c = cur.c + 80, node = -1, rev = true });
                foreach (var m in moves)
                {
                    if (blocked != null && !m.rev && blocked(m.e, m.dir)) continue;
                    int k = Key(m.e, m.dir, m.r); double b;
                    if (!best.TryGetValue(k, out b) || m.c < b) { best[k] = m.c; prev[k] = new KeyValuePair<int, SN>(ck, m); open.Add(m); }
                }
            }
            if (goal == null) return null;
            var outL = new List<SN>(); int key = Key(goal.Value.e, goal.Value.dir, goal.Value.r); KeyValuePair<int, SN> pv;
            while (prev.TryGetValue(key, out pv)) { outL.Add(pv.Value); key = pv.Key; }
            outL.Add(new SN { e = start.e, dir = start.dir, node = -1 });
            outL.Reverse(); return outL;
        }
        static List<HlpStep> ToSteps(IEnumerable<SN> p) { return p.Select(s => new HlpStep(s.e, s.dir, s.node, s.pi)).ToList(); }

        // ---------- consist path geometry ----------
        public double[] Cum(HlpConsist c)
        {
            if (c.cum == null || c.cum.Length != c.steps.Count + 1)
            {
                var a = new double[c.steps.Count + 1]; for (int i = 0; i < c.steps.Count; i++) a[i + 1] = a[i] + G.edges[c.steps[i].e].len; c.cum = a;
            }
            return c.cum;
        }
        public int Locate(HlpConsist c, double s) { var cum = Cum(c); int i = 0; while (i < c.steps.Count - 1 && cum[i + 1] <= s) i++; return i; }
        /// <summary>Map position (x, z) and travel direction at distance s along a consist's path (for drawing).</summary>
        public void At(HlpConsist c, double s, out double x, out double z, out double tx, out double tz)
        {
            var cum = Cum(c); int i = Locate(c, s); var st = c.steps[i]; var e = G.edges[st.e];
            double local = Math.Max(0, Math.Min(e.len, s - cum[i])), d = st.dir > 0 ? local : e.len - local, t = Math.Max(0, Math.Min(1, d / e.len));
            x = e.ax + (e.bx - e.ax) * t; z = e.az + (e.bz - e.az) * t; tx = (e.bx - e.ax) / e.len * st.dir; tz = (e.bz - e.az) / e.len * st.dir;
        }
        List<int> OccIdx(HlpConsist c)
        {
            var cum = Cum(c); double a = c.s - c.len, b = c.s; var o = new List<int>();
            for (int i = 0; i < c.steps.Count; i++) if (cum[i + 1] > a + 0.01 && cum[i] < b - 0.01) o.Add(i);
            return o;
        }
        void SlicePath(HlpConsist c)
        {
            var idx = OccIdx(c); if (idx.Count == 0) return; var cum = Cum(c);
            c.s -= cum[idx[0]]; c.steps = c.steps.GetRange(idx[0], idx[idx.Count - 1] - idx[0] + 1); c.cum = null;
        }
        public void ReverseConsist(HlpConsist c)
        {
            SlicePath(c);
            double total = Cum(c)[c.steps.Count], tail = c.s - c.len;
            c.steps = Enumerable.Reverse(c.steps).Select(st => new HlpStep(st.e, -st.dir)).ToList(); c.cum = null;
            c.s = total - tail;
            c.veh.Reverse(); for (int i = 0; i < c.veh.Count; i++) { var v = c.veh[i]; v.f = -v.f; c.veh[i] = v; }
            for (int i = 0; i < c.veh.Count; i++) if (c.veh[i].t == "loco") c.veh[i] = new HlpVeh("loco", i == 0 ? 1 : -1);
        }
        void ExtendPath(HlpConsist c, List<HlpStep> steps)
        {
            SlicePath(c); c.@base = c.steps.Count; foreach (var s in steps) c.steps.Add(new HlpStep(s.e, s.dir)); c.cum = null;
        }
        HlpStep HeadStep(HlpConsist c) { var st = c.steps[Locate(c, c.s - 0.01)]; return new HlpStep(st.e, st.dir); }

        public void ComputeOcc()
        {
            foreach (var l in OCC) l.Clear();
            foreach (var c in S.consists)
            {
                var cum = Cum(c); double a = c.s - c.len, b = c.s;
                for (int i = 0; i < c.steps.Count; i++)
                {
                    double s0 = cum[i], s1 = cum[i + 1]; if (s1 <= a + 0.01 || s0 >= b - 0.01) continue;
                    var st = c.steps[i]; var e = G.edges[st.e]; double lo = Math.Max(a, s0) - s0, hi = Math.Min(b, s1) - s0;
                    OCC[st.e].Add(new Occ { cid = c.id, d0 = st.dir > 0 ? lo : e.len - hi, d1 = st.dir > 0 ? hi : e.len - lo });
                }
            }
        }
        bool Occupied(int e) { return OCC[e].Count > 0; }
        bool ObstacleAhead(HlpConsist c, out double s, out string cid)
        {
            var cum = Cum(c); s = 0; cid = null; bool found = false;
            for (int i = Locate(c, c.s - 0.01); i < c.steps.Count; i++)
            {
                if (cum[i] - c.s > 1500) break;
                var st = c.steps[i]; var e = G.edges[st.e];
                foreach (var o in OCC[st.e])
                {
                    if (o.cid == c.id) continue;
                    double p0 = cum[i] + (st.dir > 0 ? o.d0 : e.len - o.d1);
                    if (p0 >= c.s - 0.5 && (!found || p0 < s)) { s = p0; cid = o.cid; found = true; }
                }
            }
            return found;
        }

        // ---------- ETCS-style supervision: braking curves to the end of authority ----------
        struct Target { public double s, v; public string k, cid; }
        void Drive(HlpConsist c, double dt)
        {
            if (!c.moving) { c.v = 0; c.P = 0; c.tgKind = ""; return; }
            var cum = Cum(c);
            double vlim = Unreached; foreach (int i in OccIdx(c)) vlim = Math.Min(vlim, G.edges[c.steps[i].e].speed);
            if (c.mode == ConsistMode.SH) vlim = Math.Min(vlim, K.shunt);
            var targets = new List<Target> { new Target { s = c.stopS, v = 0, k = "eoa" } };
            for (int i = Locate(c, c.s - 0.01) + 1; i < c.steps.Count && cum[i] - c.s < 2500; i++)
            {
                double sp = G.edges[c.steps[i].e].speed; if (c.mode == ConsistMode.SH) sp = Math.Min(sp, K.shunt);
                targets.Add(new Target { s = cum[i], v = sp, k = "lim" });
            }
            double obS; string obC;
            if (ObstacleAhead(c, out obS, out obC)) targets.Add(new Target { s = obS - (c.couple == obC ? 0 : 12), v = 0, k = "obs", cid = obC });
            double P = vlim; Target? tg = null, stopT = null;
            foreach (var t in targets)
            {
                double p = Math.Sqrt(t.v * t.v + 2 * K.bCurve * Math.Max(0, t.s - c.s));
                if (p < P) { P = p; tg = t; }
                if (t.v == 0 && (stopT == null || t.s < stopT.Value.s)) stopT = t;
            }
            double dStop = stopT.Value.s - c.s;
            double want = Math.Min(P * 0.95, P - 0.25);
            if (dStop > 0.15) want = Math.Max(want, Math.Min(0.7, dStop * 0.4)); else want = 0;   // release speed for the last metres
            if (c.v < want) c.v = Math.Min(want, c.v + K.acc * dt); else c.v = Math.Max(want, c.v - K.bMax * dt);
            double step = Math.Min(c.v * dt, Math.Max(0, dStop));
            c.s += step;
            c.P = P; c.vlim = vlim;
            if (tg != null) { c.tgKind = tg.Value.k; c.tgD = Math.Max(0, tg.Value.s - c.s); c.tgV = tg.Value.v; } else c.tgKind = "";
            if (dStop - step <= 0.15 && c.v < 0.3) { c.v = 0; OnStop(c, stopT.Value); }
        }
        void OnStop(HlpConsist c, Target t)
        {
            var svc = Svc(c.sid);
            if (c.job == ConsistJob.Approach) { if (svc != null && svc.phase == HlpPhase.Approach) { svc.phase = HlpPhase.Held; Log(svc.name + " หยุดรอที่สัญญาณเข้า H", LogTone.Bad); } return; }
            if (t.k == "obs") { if (c.job == ConsistJob.Leg3 && t.cid == c.couple) FinishLeg(c); return; }
            if (c.job == ConsistJob.Arr)
            {
                ReleaseRoute(c.routeId); c.routeId = ""; c.moving = false; c.job = ConsistJob.None; c.mode = ConsistMode.SB;
                if (svc != null)
                {
                    svc.phase = HlpPhase.Dwell; svc.state = HlpSvcState.Work; svc.arrAt = S.now; svc.tasks = NewTasks(svc);
                    if (svc.lh) svc.ra = new HlpRunAround { st = RaState.Detach, t = 60 };
                    S.stats.arr++;
                    double late = (S.now - svc.schedArr) / 60;
                    Log(svc.name + " เข้าชานชาลา " + svc.track + (late > 3 ? " ช้า " + Math.Round(late) + " นาที" : " ตรงเวลา"));
                }
            }
            else if (c.job == ConsistJob.Leg1 || c.job == ConsistJob.Leg2) FinishLeg(c);
        }

        // ---------- interlocking: route locking, sectional release ----------
        /// <summary>Why a route cannot be set over these steps (null = it can). Port of routeCheck().</summary>
        public string RouteCheck(List<HlpStep> steps, HashSet<int> ignore)
        {
            foreach (var st in steps)
            {
                var e = G.edges[st.e];
                if (S.elock[st.e] != "") return e.label + " ถูกจองในเส้นทางอื่น";
                if (Occupied(st.e) && !ignore.Contains(st.e)) return "วงจรราง " + e.label + " แจ้งว่ามีรถ";
                if (st.node >= 0)
                {
                    if (S.nlock[st.node] != "") return G.nodes[st.node].label + " ถูกล็อกในเส้นทางอื่น";
                    if (S.nodeMv[st.node] > 0) return G.nodes[st.node].label + " กำลังเคลื่อนที่";
                }
            }
            return null;
        }
        HlpRoute MakeRoute(RouteKind kind, string from, List<HlpStep> steps, int track)
        {
            var r = new HlpRoute { id = "R" + (S.nextId++), kind = kind, from = from, steps = steps.Select(s => s).ToList(), track = track };
            foreach (var st in r.steps)
            {
                S.elock[st.e] = r.id;
                if (st.node < 0) continue;
                S.nlock[st.node] = r.id;
                if (G.IsSwitch(st.node) && S.nodePos[st.node] != st.pi) { S.nodePos[st.node] = st.pi; S.nodeMv[st.node] = K.throwT; }
            }
            S.routes.Add(r); return r;
        }
        void ReleaseRoute(string id)
        {
            var r = Route(id); if (r == null) return;
            foreach (var st in r.steps)
            {
                if (S.elock[st.e] == id) S.elock[st.e] = "";
                if (st.node >= 0 && S.nlock[st.node] == id) S.nlock[st.node] = "";
            }
            S.routes.Remove(r);
        }
        void AssignRoute(HlpRoute r, HlpConsist c) { ExtendPath(c, r.steps); r.@base = c.@base; r.used = true; r.cid = c.id; c.routeId = r.id; c.moving = true; }
        HlpConsist LeadingApproach() { HlpConsist best = null; foreach (var x in S.consists) if (x.job == ConsistJob.Approach && (best == null || x.s > best.s)) best = x; return best; }

        void TryAssign(HlpRoute r)
        {
            if (r.kind == RouteKind.Arr)
            {
                var c = LeadingApproach(); if (c == null) return;
                AssignRoute(r, c); c.job = ConsistJob.Arr; c.mode = ConsistMode.FS; c.stopS = Cum(c)[c.steps.Count] - 6;
                var svc = Svc(c.sid);
                if (svc != null) { if (svc.plan == r.track) _host.GainXP(2); svc.track = r.track; svc.phase = HlpPhase.Entering; Log(svc.name + " ได้รับอาณัติเข้าราง " + r.track); }
            }
            else if (r.kind == RouteKind.Dep)
            {
                var svc = S.services.FirstOrDefault(s => s.phase == HlpPhase.Dwell && s.track == r.track && s.state == HlpSvcState.Ready && S.now >= s.schedDep - 30);
                if (svc == null) return;
                var c = Cons(svc.cid); AssignRoute(r, c); c.job = ConsistJob.Dep; c.mode = ConsistMode.FS; c.stopS = Cum(c)[c.steps.Count] + 60;
                svc.phase = HlpPhase.Departing;
                double late = Math.Max(0, (S.now - svc.schedDep) / 60);
                int rev = (int)(Math.Max(1000, Clock0(svc.lh ? 12000 - late * 400 : 7000 - late * 400)) * (svc.special ? 2 : 1));
                if (svc.special) _host.GainXP(10);
                _host.Earn(rev, "term"); S.stats.dep++; _host.GainXP(late <= 3 ? 8 : 4); RouteContractTick(svc, late);
                S.stats.rev += rev; S.stats.delayMin += late; if (late <= 3) S.stats.onTime++;
                double x, z, tx, tz; At(c, c.s, out x, out z, out tx, out tz); if (Popup != null) Popup(x, z, "+฿" + rev.ToString("N0"), late > 3);
                Log(svc.outName + " ออกจากราง " + svc.track + " ไป" + svc.from + " " + (late > 3 ? "ช้า " + Math.Round(late) + " นาที" : "ตรงเวลา") + " · ฿" + rev.ToString("N0"), late > 3 ? LogTone.Bad : LogTone.Good);
            }
            else
            {
                var c = Cons(r.cid); if (c == null) { ReleaseRoute(r.id); return; }
                AssignRoute(r, c); c.mode = ConsistMode.SH;
                var cum = Cum(c); int n = c.steps.Count;
                c.stopS = c.job == ConsistJob.Leg1 ? cum[n] - 3 : c.job == ConsistJob.Leg2 ? cum[n - 1] + c.len + 5 : cum[n] - 2;
            }
        }
        static double Clock0(double v) { return Math.Floor(v + 0.5); }   // JS Math.round

        void RouteTick()
        {
            foreach (var r in S.routes.ToArray())
            {
                if (!r.set && r.steps.All(st => st.node < 0 || S.nodeMv[st.node] <= 0)) r.set = true;
                if (!r.set) continue;
                if (!r.used) { TryAssign(r); continue; }
                var c = Cons(r.cid); if (c == null) { ReleaseRoute(r.id); continue; }
                var cum = Cum(c); double tail = c.s - c.len;
                for (int k = 0; k < r.steps.Count; k++)
                {
                    var st = r.steps[k]; int idx = r.@base + k; if (idx >= c.steps.Count) continue;
                    if (st.node >= 0 && tail > cum[idx] + 0.5 && S.nlock[st.node] == r.id) S.nlock[st.node] = "";
                    if (tail > cum[idx + 1] && S.elock[st.e] == r.id) S.elock[st.e] = "";
                }
                if (r.steps.All(st => S.elock[st.e] != r.id && (st.node < 0 || S.nlock[st.node] != r.id))) S.routes.Remove(r);
            }
        }
        /// <summary>Signal aspect: "red", "yellow" (H, the home signal) or "green". Port of sigAspect().</summary>
        public string SigAspect(string id)
        {
            var r = S.routes.FirstOrDefault(x => x.from == id && x.kind != RouteKind.Shunt);
            if (r == null || !r.set) return "red";
            if (r.used) { var c = Cons(r.cid); if (c != null && c.s > Cum(c)[Math.Min(r.@base, c.steps.Count)] + 1) return "red"; }
            return id == "HA" ? "yellow" : "green";
        }

        // ---------- requests (NX panel / ARS) ----------
        public HlpService TrackSvc(int T) { return S.services.FirstOrDefault(s => (s.phase == HlpPhase.Dwell || s.phase == HlpPhase.Entering) && s.track == T); }
        static bool LhPending(HlpService s) { return s != null && s.lh && (s.phase == HlpPhase.Entering || s.ra.st != RaState.Done); }
        /// <summary>Station rules for receiving a train on track T (null = allowed). Port of arrivalRule().</summary>
        public string ArrivalRule(int T, HlpService svc)
        {
            const string CLS = "ABCD";
            if (svc != null && TrainClass(svc) > PlatClass(T)) return "ราง " + T + " สั้นเกินไป: รับได้ถึงขนาด " + CLS[PlatClass(T)] + " แต่ขบวนนี้ขนาด " + CLS[TrainClass(svc)];
            if (svc == null || !svc.lh) return null;
            int Q = PartnerOf(T); var o = TrackSvc(Q);
            if (LhPending(o)) return "ราง " + Q + " (รางคู่) มีขบวนหัวรถจักรที่ยังสับหลีกไม่เสร็จ ถ้ารับเข้าจะติดตายกันทั้งคู่";
            if (Occupied(E("stub" + Q))) return "ปลายราง " + Q + " มีหัวรถจักรจอดอยู่";
            return null;
        }
        public HlpService NextArrivalSvc()
        {
            var c = LeadingApproach(); if (c != null) return Svc(c.sid);
            HlpService best = null; foreach (var s in S.services) if (s.phase == HlpPhase.Sched && (best == null || s.schedArr < best.schedArr)) best = s;
            return best;
        }
        public bool HasRouteFrom(string from) { foreach (var r in S.routes) if (r.from == from) return true; return false; }

        /// <summary>Set the arrival route H → platform T. False with the reason when refused.</summary>
        public bool RequestArrival(int T, bool quiet, out string msg)
        {
            msg = null;
            if (HasRouteFrom("HA")) { msg = "สัญญาณ H มีเส้นทางตั้งอยู่แล้ว"; return false; }
            var svc = NextArrivalSvc();
            var rule = ArrivalRule(T, svc); if (rule != null) { msg = "ระเบียบสถานี: " + rule; return false; }
            int goal = E("pw" + T);
            var path = FindPath(new HlpStep(_aFar, 1), s => s.e == goal && s.dir == -1, false);
            if (path == null) { msg = "ไม่มีทางเดินรถไปราง " + T; return false; }
            var steps = ToSteps(path.Skip(1)); var err = RouteCheck(steps, new HashSet<int>());
            if (err != null) { msg = "ตั้งเส้นทางไม่ได้: " + err; return false; }
            MakeRoute(RouteKind.Arr, "HA", steps, T);
            if (!quiet) { var o = TrackSvc(PartnerOf(T)); msg = LhPending(o) ? "ตั้งเส้นทาง H → ราง " + T + " แล้ว ระวัง: ขบวนนี้จะขวางการสับหลีกของราง " + PartnerOf(T) : "ตั้งเส้นทาง H → ราง " + T + " · กำลังกลับประแจ"; }
            Log("ตั้งเส้นทาง H → ราง " + T + (quiet ? " (ARS)" : ""));
            return true;
        }
        /// <summary>Set the departure route S{T} → exit.</summary>
        public bool RequestDeparture(int T, bool quiet, out string msg)
        {
            msg = null;
            if (HasRouteFrom("ST" + T)) { msg = "สัญญาณ S" + T + " มีเส้นทางตั้งอยู่แล้ว"; return false; }
            var svc = TrackSvc(T);
            if (svc == null || svc.phase != HlpPhase.Dwell) { msg = "ราง " + T + " ไม่มีขบวนที่จอดอยู่"; return false; }
            if (svc.lh && svc.ra.st != RaState.Done) { msg = "หัวรถจักรยังไม่ได้ต่อท้ายขบวน (สับหลีกยังไม่เสร็จ)"; return false; }
            if (!svc.lh && svc.Task("turn").st != TaskState.Done) { msg = "พนักงานขับยังย้ายไปห้องขับอีกด้านไม่เสร็จ"; return false; }
            var path = FindPath(new HlpStep(E("pw" + T), 1), s => s.e == _dFar && s.dir == 1, false);
            if (path == null) { msg = "ไม่มีทางเดินรถออกจากราง " + T; return false; }
            var steps = ToSteps(path.Skip(1)); var err = RouteCheck(steps, new HashSet<int>());
            if (err != null) { msg = "ตั้งเส้นทางไม่ได้: " + err; return false; }
            MakeRoute(RouteKind.Dep, "ST" + T, steps, T);
            if (!quiet) msg = svc.state == HlpSvcState.Ready ? "ตั้งเส้นทาง S" + T + " → ทางออก" : "ตั้งเส้นทาง S" + T + " แล้ว ขบวนจะออกเมื่อกลับขบวนเสร็จและถึงเวลา";
            Log("ตั้งเส้นทาง S" + T + " → ทางออก" + (quiet ? " (ARS)" : ""));
            return true;
        }
        public bool CancelRoute(HlpRoute r, out string msg)
        {
            if (r.used) { msg = "ยกเลิกไม่ได้: ขบวนรถได้รับอาณัติ (MA) แล้ว เส้นทางถูกล็อกจนกว่าจะผ่าน"; return false; }
            ReleaseRoute(r.id); msg = "ยกเลิกเส้นทางแล้ว"; Log("ยกเลิกเส้นทางจาก " + (r.from == "HA" ? "H" : r.from.Replace("ST", "S"))); return true;
        }
        public bool ThrowSwitch(int node, out string msg)
        {
            var N = G.nodes[node]; msg = null;
            if (!G.IsSwitch(node)) return false;
            if (S.nlock[node] != "") { msg = N.label + " ถูกล็อกในเส้นทาง (route locking)"; return false; }
            if (S.nodeMv[node] > 0) { msg = N.label + " กำลังเคลื่อนที่"; return false; }
            if (N.adj.Any(Occupied)) { msg = N.label + " มีรถอยู่บนตอนราง (track locking)"; return false; }
            S.nodePos[node] = (S.nodePos[node] + 1) % N.pairs.Length; S.nodeMv[node] = K.throwT;
            msg = N.label + " → " + S.nodePos[node]; return true;
        }
        public bool TrackFree(int T)
        {
            int pw = E("pw" + T), pe = E("pe" + T);
            return !Occupied(pw) && !Occupied(pe) && S.elock[pw] == "" && S.elock[pe] == "" && TrackSvc(T) == null;
        }
        void ArsTick()
        {
            bool waiting = S.arsArr && !HasRouteFrom("HA") && S.consists.Any(c => c.job == ConsistJob.Approach);
            if (!waiting) S.arsAt = -1; else if (S.arsAt < 0) S.arsAt = S.now + _diff.ArsReactSeconds();   // ARS reacts with a short delay
            if (waiting && S.now >= S.arsAt)
            {
                var svc = NextArrivalSvc(); var cand = new List<KeyValuePair<int, double>>();
                for (int T = 1; T <= 14; T++)
                {
                    if (!TrackFree(T) || ArrivalRule(T, svc) != null) continue;
                    var o = TrackSvc(PartnerOf(T)); double sc = _rng.NextDouble() * 0.5;
                    if (svc != null && svc.plan == T) sc -= 100;
                    if (svc.lh) sc += o != null ? 3 : 0; else sc += LhPending(o) ? 8 : o != null ? 0 : 1;
                    cand.Add(new KeyValuePair<int, double>(T, sc));
                }
                string m;
                foreach (var c in cand.OrderBy(x => x.Value)) if (RequestArrival(c.Key, true, out m)) break;
            }
            if (S.arsDep) foreach (var s in S.services.ToArray())
            {
                if (s.phase != HlpPhase.Dwell || s.state != HlpSvcState.Ready) continue;
                if (s.lag < 0) s.lag = _diff.ArsDepartureLagSeconds();
                string m; if (S.now >= s.schedDep - 30 + s.lag && !HasRouteFrom("ST" + s.track)) RequestDeparture(s.track, true, out m);
            }
        }

        // ---------- turnaround: run-around shunting / push-pull / tasks ----------
        static double RaProgress(RaState st)
        {
            switch (st) { case RaState.Detach: return 0.08; case RaState.Leg1: return 0.25; case RaState.Leg2: return 0.5; case RaState.Leg3: return 0.75; case RaState.Couple: return 0.92; case RaState.Done: return 1; }
            return 0;
        }
        List<HlpTask> NewTasks(HlpService svc)
        {
            bool lh = svc.lh; double q = S.now;
            var k = new List<HlpTask>
            {
                new HlpTask { name = "alight", st = TaskState.Queue, dur = svc.pax / 150.0 * 60, res = "staff", q = q },
                new HlpTask { name = "turn", st = TaskState.Run, dur = lh ? 1 : 180 },
                new HlpTask { name = "clean", st = TaskState.Wait, dur = lh ? 600 : 360, res = "crew" },
                new HlpTask { name = "fuel", st = lh ? TaskState.Wait : TaskState.Queue, dur = lh ? 420 : 300, res = "truck", q = q },
                new HlpTask { name = "water", st = TaskState.Wait, dur = lh ? 300 : 180, res = "water" },
                new HlpTask { name = "board", st = TaskState.Wait, dur = svc.paxOut / 150.0 * 60, res = "staff" },
            };
            // long-haul extras: toilets, dining-car stores and parcels; random wheelchair lift / defects on any service
            if (lh) k.Add(new HlpTask { name = "lav", st = TaskState.Wait, dur = 360, res = "lav" });
            if (lh && svc.name.Contains("ด่วน")) k.Add(new HlpTask { name = "cater", st = TaskState.Queue, dur = 420, res = "cater", q = q });
            if (lh && _rng.NextDouble() < 0.6) k.Add(new HlpTask { name = "parcel", st = TaskState.Queue, dur = 300, res = "parcel", q = q });
            if (_rng.NextDouble() < 0.25) k.Add(new HlpTask { name = "lift", st = TaskState.Wait, dur = 180, res = "lift" });
            if (_rng.NextDouble() < 0.12) k.Add(new HlpTask { name = "repair", st = TaskState.Queue, dur = 600, res = "repair", q = q });
            return k;
        }
        void FinishLeg(HlpConsist L)
        {
            var svc = Svc(L.sid);
            ReleaseRoute(L.routeId); L.routeId = ""; L.moving = false; L.v = 0; L.mode = ConsistMode.SB;
            var job = L.job; L.job = ConsistJob.None;
            if (svc == null || !svc.lh) return;
            var ra = svc.ra; ra.rid = ""; ra.tryT = 0;
            if (job == ConsistJob.Leg1) { ReverseConsist(L); ra.st = RaState.Leg2; }
            else if (job == ConsistJob.Leg2) { ReverseConsist(L); ra.st = RaState.Leg3; }
            else if (job == ConsistJob.Leg3) { ra.st = RaState.Couple; ra.t = 60; L.couple = ""; }
        }
        void MergeConsists(HlpConsist R, HlpConsist L)
        {
            ReverseConsist(L); ReverseConsist(R);
            var cumR = Cum(R); var lastR = R.steps[R.steps.Count - 1]; var firstL = L.steps[0];
            bool dup = lastR.e == firstL.e && lastR.dir == firstL.dir;
            double off = dup ? cumR[R.steps.Count - 1] : cumR[R.steps.Count];
            R.steps.AddRange(dup ? L.steps.Skip(1) : L.steps); R.cum = null;
            R.s = off + L.s; var veh = new List<HlpVeh>(L.veh); veh.AddRange(R.veh); R.veh = veh; R.len = R.veh.Count * K.carLen;
            for (int i = 0; i < R.veh.Count; i++) if (R.veh[i].t == "loco") R.veh[i] = new HlpVeh("loco", i == 0 ? 1 : -1);
            S.consists.Remove(L);
        }
        void RaTick(HlpService svc, double dt)
        {
            var ra = svc.ra; int T = svc.track, Q = PartnerOf(T);
            if (ra.st == RaState.Done) return;
            var rake = Cons(svc.cid); if (rake == null) return;
            if (ra.st == RaState.Detach)
            {
                ra.t -= dt; if (ra.t > 0) return;
                var L = NewConsist(new List<HlpVeh> { rake.veh[0] }, new List<HlpStep>(rake.steps), rake.s, svc.id);
                rake.veh.RemoveAt(0); rake.len -= K.carLen; rake.s -= K.carLen; rake.cum = null;
                L.job = ConsistJob.Leg1; ra.lid = L.id; ra.st = RaState.Leg1; ra.rid = ""; ra.tryT = 0;
                Log(svc.name + ": ปลดหัวรถจักร เริ่มสับหลีกผ่านราง " + Q);
                return;
            }
            var Lc = Cons(ra.lid); if (Lc == null) { ra.st = RaState.Done; return; }
            if (ra.st == RaState.Couple)
            {
                ra.t -= dt; if (ra.t > 0) return;
                MergeConsists(rake, Lc); ra.st = RaState.Done;
                Log(svc.name + ": ต่อหัวรถจักรด้านท้ายแล้ว พร้อมเป็น " + svc.outName, LogTone.Good);
                return;
            }
            if (ra.rid != "") { if (Route(ra.rid) == null) ra.rid = ""; return; }
            if (Lc.moving) return;
            ra.tryT -= dt; if (ra.tryT > 0) return; ra.tryT = 4;
            Func<HlpStep?, Func<int, int, bool>> blocked = goal => (e, d) => OCC[e].Any(o => o.cid != Lc.id) && !(goal != null && e == goal.Value.e && d == goal.Value.dir);
            List<HlpStep> steps;
            if (ra.st == RaState.Leg1)
            {
                int stub = E("stub" + Q);
                var p = FindPath(HeadStep(Lc), s => s.e == stub && s.dir == -1, false, blocked(null));
                if (p == null) { ra.why = "ปลายราง " + Q + " ไม่ว่าง"; return; }
                steps = ToSteps(p.Skip(1));
            }
            else if (ra.st == RaState.Leg2)
            {
                var goal = new HlpStep(E("pw" + T), -1);
                var p = FindPath(HeadStep(Lc), s => s.e == goal.e && s.dir == goal.dir && s.r == 1, true, blocked(goal));
                if (p == null) { ra.why = "รอราง " + Q + " ว่างเพื่อวิ่งหลีก"; return; }
                int k = p.FindIndex(s => s.rev);
                ra.leg3 = ToSteps(p.Skip(k + 1));
                steps = ToSteps(p.Skip(1).Take(k - 1));
            }
            else steps = ra.leg3;
            var ignore = new HashSet<int>(OccIdx(Lc).Select(i => Lc.steps[i].e)); if (ra.st == RaState.Leg3) ignore.Add(E("pw" + T));
            var err = RouteCheck(steps, ignore); if (err != null) { ra.why = err; return; }
            var r = MakeRoute(RouteKind.Shunt, "SH", steps, T); r.cid = Lc.id;
            Lc.job = ra.st == RaState.Leg1 ? ConsistJob.Leg1 : ra.st == RaState.Leg2 ? ConsistJob.Leg2 : ConsistJob.Leg3;
            if (ra.st == RaState.Leg3) Lc.couple = rake.id;
            ra.rid = r.id; ra.why = "";
        }
        void SvcTick(HlpService svc, double dt)
        {
            if (svc.phase == HlpPhase.Held) { svc.hold += dt; _host.Pay(2.5 * dt, "penalty"); S.stats.holdMin += dt / 60; return; }
            if (svc.phase != HlpPhase.Dwell) return;
            bool lh = svc.lh;
            double gr = _host.ControllerOn("ground") ? 1.25 : 1, sr = _host.ControllerOn("shunt") ? 1.3 : 1;
            Func<HlpTask, double, bool> run = (t, m) => { t.p = Math.Min(1, t.p + dt * m / t.dur); if (t.p >= 1) t.st = TaskState.Done; return t.st == TaskState.Done; };
            Action<string> qd = n => { var t = svc.Task(n); if (t != null && t.st == TaskState.Wait) { t.st = TaskState.Queue; t.q = S.now; } };
            HlpTask alight = svc.Task("alight"), turn = svc.Task("turn"), clean = svc.Task("clean"), board = svc.Task("board"), lift = svc.Task("lift");
            if (alight.st == TaskState.Run) run(alight, gr);
            if (lh) { RaTick(svc, dt); turn.p = RaProgress(svc.ra.st); if (svc.ra.st == RaState.Done) turn.st = TaskState.Done; }
            else if (turn.st == TaskState.Run && run(turn, sr)) { var c = Cons(svc.cid); if (c != null) ReverseConsist(c); Log(svc.name + ": พนักงานขับย้ายไปห้องขับอีกด้าน (push-pull)"); }
            if (alight.st == TaskState.Done) { qd("clean"); qd("water"); qd("lav"); }
            if (!lh || svc.ra.st == RaState.Done) qd("fuel");
            if (clean.st == TaskState.Done) qd("lift");
            foreach (var t in svc.tasks) if (t.name != "alight" && t.name != "turn" && t.name != "board" && t.st == TaskState.Run) run(t, gr);
            if (board.st == TaskState.Wait && clean.st == TaskState.Done && turn.st == TaskState.Done && (lift == null || lift.st == TaskState.Done)) { board.st = board.res != "" ? TaskState.Queue : TaskState.Run; board.q = S.now; }
            if (board.st == TaskState.Run) run(board, gr);
            if (svc.state != HlpSvcState.Ready && svc.tasks.All(t => t.st == TaskState.Done)) { svc.state = HlpSvcState.Ready; Log(svc.outName + " พร้อมออกจากราง " + svc.track + " (กำหนด " + Clock(svc.schedDep) + ")", LogTone.Good); }
        }
        /// <summary>Teams busy per resource after the last allocation (for the HUD).</summary>
        public int[] Busy { get; private set; }
        void AllocRes()
        {
            var keys = G.file.resources; var busy = new int[keys.Length]; var q = new List<KeyValuePair<HlpService, HlpTask>>();
            foreach (var s in S.services)
            {
                if (s.phase != HlpPhase.Dwell) continue;
                foreach (var t in s.tasks) { if (t.res == "") continue; int ri = Res(t.res); if (t.st == TaskState.Run) busy[ri]++; else if (t.st == TaskState.Queue) q.Add(new KeyValuePair<HlpService, HlpTask>(s, t)); }
            }
            foreach (var kv in q.OrderByDescending(x => x.Key.prio).ThenBy(x => x.Value.q)) { int ri = Res(kv.Value.res); if (busy[ri] < S.res[ri]) { busy[ri]++; kv.Value.st = TaskState.Run; } }
            Busy = busy;
        }
        void SpawnTick()
        {
            double last = S.now; foreach (var s in S.services) last = Math.Max(last, s.schedArr);
            double ramp = Math.Max(0.55, 1 - (S.now - S.t0) / (6 * 3600));
            while (S.services.Count(s => s.phase == HlpPhase.Sched) < 6)
            {
                last += (5 + _rng.NextDouble() * 4) * 60 * ramp * (S.now - S.t0 > 3600 ? _diff.RushFactor(last) : 1);   // no peak in the first game hour
                S.services.Add(MakeService(last));
            }
            HlpService svc = null; double due = 0;
            foreach (var s in S.services) { if (s.phase != HlpPhase.Sched) continue; double d = s.schedArr + s.lateIn * 60; if (S.now >= d - 40 && (svc == null || d < due)) { svc = s; due = d; } }
            if (svc == null || OCC[_aFar].Any(o => o.d0 < 260)) return;
            var veh = VehOf(svc); double len = veh.Count * K.carLen;
            var c = NewConsist(veh, new List<HlpStep> { new HlpStep(_aFar, 1) }, len + 2, svc.id);
            c.v = 20; c.moving = true; c.job = ConsistJob.Approach; c.mode = ConsistMode.FS; c.stopS = G.edges[_aFar].len - 12;
            svc.phase = HlpPhase.Approach; svc.cid = c.id;
            Log(svc.name + " จาก" + svc.from + " เข้าเขตสถานี");
        }
        void Despawn(HlpConsist c)
        {
            var svc = Svc(c.sid);
            ReleaseRoute(c.routeId);
            S.consists.Remove(c);
            if (svc != null) S.services.Remove(svc);
            if (Despawned != null) Despawned(c.id, c.sid);
        }
        public event Action<string, string> Despawned;

        void RouteContractTick(HlpService svc, double late)
        {
            string code; if (!_origin.TryGetValue(svc.from, out code) && !_origin.TryGetValue(svc.from.Split(' ')[0], out code)) code = "SPC";
            string reg; if (!_region.TryGetValue(code, out reg)) reg = "ขบวนพิเศษ";
            var R = RegionStat(reg);
            R.n++; if (late <= 3) R.up++; else R.down++;
            if (R.n >= 5)
            {
                if (R.up >= 4) { _host.Earn(20000, "term"); _host.GainXP(15); _host.Notify("ต่อสัญญาเดินรถ" + reg + "สำเร็จ +฿20,000"); Log("ต่อสัญญาเดินรถ" + reg + " (" + R.up + "/5 ตรงเวลา)", LogTone.Good); }
                else { _host.Notify("สัญญาเดินรถ" + reg + "ไม่ผ่าน: ตรงเวลาแค่ " + R.up + "/5"); Log("สัญญาเดินรถ" + reg + "ไม่ผ่านเกณฑ์", LogTone.Bad); }
                R.done++; R.n = 0; R.up = 0; R.down = 0;
            }
        }
        public string RegionOf(HlpService svc)
        {
            string code; if (!_origin.TryGetValue(svc.from, out code) && !_origin.TryGetValue(svc.from.Split(' ')[0], out code)) code = "SPC";
            string reg; return _region.TryGetValue(code, out reg) ? reg : "ขบวนพิเศษ";
        }
        public HlpRegionStat RegionStat(string reg)
        {
            var r = S.rstat.FirstOrDefault(x => x.region == reg);
            if (r == null) { r = new HlpRegionStat { region = reg }; S.rstat.Add(r); }
            return r;
        }

        // ---------- main step ----------
        /// <summary>Advance by real seconds at the station speed (≤0.25 s game steps, TRATE game s per real s at 1×).</summary>
        public void Advance(double realSeconds)
        {
            double rem = realSeconds * S.speed * K.rate;
            while (rem > 1e-6) { double d = Math.Min(0.25, rem); Step(d); rem -= d; }
        }
        public void Step(double dt)
        {
            S.now += dt;
            for (int i = 0; i < S.nodeMv.Length; i++) if (S.nodeMv[i] > 0) S.nodeMv[i] = Math.Max(0, S.nodeMv[i] - dt);
            ComputeOcc();
            SpawnTick();
            RouteTick();
            AllocRes();
            foreach (var s in S.services.ToArray()) SvcTick(s, dt);
            ComputeOcc();
            foreach (var c in S.consists.ToArray()) Drive(c, dt);
            foreach (var c in S.consists.ToArray()) if (c.job == ConsistJob.Dep && c.s >= Cum(c)[c.steps.Count] - 220) Despawn(c);
            S.arsAcc += dt; if (S.arsAcc > 2) { S.arsAcc = 0; ArsTick(); }
        }
    }
}
