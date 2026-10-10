using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    /// <summary>
    /// Simulation of one timetable-driven station (CMI, NKI, UBN, HDY, KRT). Pure C#, no UnityEngine:
    /// a MonoBehaviour calls <see cref="Advance"/> each frame and draws <see cref="State"/>.
    /// Port of stnGenDay / stnMakeSvc / stnTrackInfo / stnStep / stnRelease (railway/src/stations.js)
    /// and worldResolveDelay / worldCatchUp (railway/src/world.js). Keep the two in step.
    /// </summary>
    public sealed class TimetableStationSim
    {
        public readonly StationDef Def;
        public readonly StationGeometry Geo;
        public StationState State { get; private set; }
        /// <summary>The station on screen drives the world clock; background stations only catch up.</summary>
        public bool IsActive;
        public event Action<StationLogEntry> Logged;

        readonly RailTrackDatabase _db;
        readonly Difficulty _diff;
        readonly WorldClock _world;
        readonly DelayLedger _ledger;
        readonly IStationHost _host;
        readonly Random _rng;
        readonly List<TimetableEvent> _realEvents;
        readonly List<StationService> _dwellBuf = new List<StationService>();
        readonly Dictionary<string, ServiceClass> _classes = new Dictionary<string, ServiceClass>();

        const double Locked = 1e9;

        public TimetableStationSim(StationDef def, RailTrackDatabase db, RailGraph graph, Difficulty diff, WorldClock world, DelayLedger ledger, IStationHost host, Random rng, StationState saved = null)
        {
            Def = def; _db = db; _diff = diff; _world = world; _ledger = ledger; _host = host; _rng = rng;
            Geo = new StationGeometry(def);
            _realEvents = TimetableEvents.For(def.id, db, graph);
            foreach (var c in db.timetable.classes) _classes[c.cls] = c;
            State = saved != null && saved.v == 1 && saved.id == def.id ? saved : new StationState { id = def.id };
        }

        // ---------- helpers ----------
        int RInt(int a, int b) { return _rng.Next(a, b + 1); }
        T Pick<T>(T[] a) { return a[_rng.Next(a.Length)]; }
        double Lock(Side side) { return side == Side.East ? State.lockE : State.lockW; }
        void SetLock(Side side, double v) { if (side == Side.East) State.lockE = v; else State.lockW = v; }
        bool EastOf(string other) { if (Def.eastOf != null) foreach (var x in Def.eastOf) if (x == other) return true; return false; }
        TrackDef TrackOf(int n) { foreach (var t in Def.tracks) if (t.n == n) return t; return null; }

        public void Log(string text, LogTone tone = LogTone.Neutral)
        {
            var e = new StationLogEntry { time = Clock.HM(State.now), text = text, tone = tone };
            State.log.Insert(0, e); if (State.log.Count > 40) State.log.RemoveRange(40, State.log.Count - 40);
            if (Logged != null) Logged(e);
        }

        // ---------- timetable → services ----------
        StationService MakeService(TimetableEvent e, int day)
        {
            ServiceClass C; bool lh; int vMin, vMax, rev; string car;
            if (_classes.TryGetValue(e.cls, out C)) { lh = C.kind == "LH"; vMin = C.vehMin; vMax = C.vehMax; rev = C.rev; car = C.car; }
            else { lh = _rng.NextDouble() < 0.5; vMin = 4; vMax = 7; rev = 6000; car = "coach"; }
            int n = RInt(vMin, vMax);
            string loco = car == "cnr" ? "HID" : e.real ? Pick(new[] { "ALS", "HID" }) : Pick(new[] { "GEK", "ALS", "HID" });
            string dmu = e.cls == "ด่วนพิเศษ (ดีเซลราง)" ? "ASR" : e.cls == "Shuttle" ? "APD" : Pick(new[] { "THN", "NKF" });
            var veh = new List<string>();
            if (lh) { veh.Add(loco); for (int i = 0; i < n - 1; i++) veh.Add(car); }
            else { veh.Add(dmu); for (int i = 0; i < Math.Max(1, n - 2); i++) veh.Add(dmu + "_car"); veh.Add(dmu); }
            double b = (double)day * Clock.Day + e.timeOfDay;
            bool east = e.hasDirection ? e.eastbound : EastOf(e.other);
            Side sideIn = Def.IsTerminus ? Side.East
                : e.mode == StopMode.Terminates ? (east ? Side.East : Side.West)
                : (east ? Side.West : Side.East);   // through and originating trains leave toward `other`
            var s = new StationService
            {
                id = "V" + (State.nextId++), name = e.name, cls = e.cls, real = e.real, estimated = e.estimated, mode = e.mode, other = e.other,
                locoHauled = lh, veh = veh.ToArray(), rev = rev, side = sideIn, phase = ServicePhase.Sched, lift = _rng.NextDouble() < 0.25,
            };
            if (!string.IsNullOrEmpty(e.trainNo)) { s.no = e.trainNo; s.runDay = DelayLedger.RunDay(e.timeOfDay, e.depOfRun, day); }
            switch (e.mode)
            {
                case StopMode.Originates: s.schedArr = b - 45 * 60; s.schedDep = b; s.label = "ไป " + _db.PlaceName(e.other); break;
                case StopMode.Terminates: s.schedArr = b; s.schedDep = b + 25 * 60; s.label = "จาก " + _db.PlaceName(e.other); break;
                default: s.schedArr = b - 6 * 60; s.schedDep = b + 6 * 60; s.label = e.other.Contains("→") ? e.other : _db.PlaceName(e.other); break;
            }
            return s;
        }

        /// <summary>Real trains of the day plus simulated locals (denser in the rush hours).</summary>
        public void GenerateDay(int day)
        {
            var ev = new List<TimetableEvent>(_realEvents);
            var L = Def.locals;
            int t = 5 * 3600 + RInt(0, 30) * 60;
            while (t < 23.5 * 3600)
            {
                StopMode mode = Def.IsTerminus ? (_rng.NextDouble() < 0.5 ? StopMode.Terminates : StopMode.Originates)
                    : _rng.NextDouble() < 0.6 ? StopMode.Through : _rng.NextDouble() < 0.5 ? StopMode.Terminates : StopMode.Originates;
                string from = Pick(L.from); int no = Pick(L.no) + 2 * RInt(0, 3);
                ev.Add(new TimetableEvent { name = L.prefix + " " + no, cls = "ท้องถิ่น", mode = mode, timeOfDay = t, other = from, real = false,
                    hasDirection = true, eastbound = !Def.IsTerminus && _rng.NextDouble() < 0.5, trainNo = "" });
                t += (int)Clock.JsRound(RInt(L.gapMin, L.gapMax) * _diff.RushFactor(t)) * 60;
            }
            foreach (var e in ev) { var s = MakeService(e, day); if (s.schedArr >= State.now - 120) State.services.Add(s); }
            State.genDay = day;
        }

        // ---------- platform rules ----------
        public bool HasPlatform(TrackDef t)
        {
            if (t.siding) return false;
            foreach (var p in Def.platforms) if (Math.Abs(Math.Abs(t.z - p.z) - p.w / 2) <= 3) return true;
            return false;
        }
        /// <summary>Can service s use track t? why = reason shown in the platform sheet.</summary>
        public bool TrackInfo(StationService s, TrackDef t, out string why)
        {
            if (!HasPlatform(t)) { why = "ไม่มีชานชาลา"; return false; }
            if (s.SizeClass > t.cls) { why = "สั้นเกินไป"; return false; }
            foreach (var o in State.services)
                if (o != s && o.track == t.n && (o.phase == ServicePhase.Entering || o.phase == ServicePhase.Dwell || o.phase == ServicePhase.Ready || o.phase == ServicePhase.Departing)) { why = "มี " + o.name; return false; }
            foreach (var o in State.services)
                if (o != s && o.track == t.n && (o.phase == ServicePhase.Approach || o.phase == ServicePhase.Held)) { why = "จองให้ขบวนอื่นแล้ว"; return false; }
            if (!Def.IsTerminus && s.mode == StopMode.Through && !t.thru) { why = "รางปลายตัน"; return false; }
            why = "ว่าง"; return true;
        }
        public void Assign(StationService s, int track) { s.track = track; Log("จัด " + s.name + " เข้าราง " + track); }

        // ---------- delays ----------
        void ResolveDelay(StationService s)
        {
            s.delayResolved = true;
            if (s.mode == StopMode.Originates) return;   // starts here from the depot: no inbound delay
            int d; DelayLedger.Entry L;
            if (s.real && s.no != "" && _ledger.TryGet(s.no, s.runDay, out L) && L.at != Def.id) { d = DelayLedger.Recover(L.minutes); s.delaySrc = L.at; }
            else d = _diff.RollDelay(s.schedArr);
            if (d > 0)
            {
                s.inDelay = d;
                Log(s.name + " แจ้งล่าช้าจากต้นทาง " + d + " นาที" + (s.delaySrc != "" ? " (จาก" + _db.PlaceName(s.delaySrc) + ")" : ""), LogTone.Bad);
            }
        }

        // ---------- simulation ----------
        /// <summary>Advance by real seconds at the station's speed (splits into ≤0.5 s game steps like the web build).</summary>
        public void Advance(double realSeconds, float stationRate)
        {
            double rem = realSeconds * State.speed * stationRate;
            while (rem > 1e-6) { double dd = Math.Min(0.5, rem); Step(dd); rem -= dd; }
        }

        public void Step(double dt)
        {
            var S = State;
            S.now += dt; if (IsActive) _world.Follow(S.now);
            int day = (int)Math.Floor(S.now / Clock.Day);
            if (S.genDay < day) GenerateDay(day);
            if (S.genDay == day && S.now % Clock.Day > 20 * 3600) GenerateDay(day + 1);
            double gr = _host.ControllerOn("ground") ? 1.25 : 1;

            // crews: only the first `crew` dwelling trains (earliest ready) make progress
            _dwellBuf.Clear(); foreach (var x in S.services) if (x.phase == ServicePhase.Dwell) _dwellBuf.Add(x);
            _dwellBuf.Sort((a, b) => a.readyAt.CompareTo(b.readyAt));
            for (int i = 0; i < _dwellBuf.Count; i++) { if (i >= S.crew) _dwellBuf[i].readyAt += dt; else _dwellBuf[i].readyAt -= dt * (gr - 1); }

            bool rain = _diff.IsRain(S.now); double vMax = 16 * (rain ? _diff.Data.rain.approach : 1);
            bool app = _host.ControllerOn("app"), dep = _host.ControllerOn("dep");
            for (int si = 0; si < S.services.Count; si++)
            {
                var s = S.services[si];
                if (s.phase == ServicePhase.Sched && !s.delayResolved && S.now >= s.schedArr - 7200) ResolveDelay(s);
                if (s.phase == ServicePhase.Sched && S.now >= s.Eta - 300) { s.phase = ServicePhase.Approach; s.s = 0; s.v = vMax; s.arsAt = S.now + _diff.ArsReactSeconds(); }
                if (s.phase == ServicePhase.Approach || s.phase == ServicePhase.Held)
                {
                    if (s.track == 0 && app && S.now >= s.arsAt) ArsPick(s);
                    bool canGo = s.track != 0 && Lock(s.side) <= S.now;
                    if (canGo && s.s > StationGeometry.HomeS - 260)
                    {
                        SetLock(s.side, S.now + Locked); s.holdsLock = true; s.lockSide = s.side; s.phase = ServicePhase.Entering;
                        Log(s.name + " ได้รับอาณัติเข้าราง " + s.track);
                    }
                    else if (s.phase == ServicePhase.Approach)
                    {
                        s.v = Math.Min(vMax, Math.Sqrt(2 * 0.5 * Math.Max(0, StationGeometry.HomeS - s.s)));
                        s.s = Math.Min(StationGeometry.HomeS, s.s + s.v * dt);
                        if (s.s >= StationGeometry.HomeS - 0.5) { s.phase = ServicePhase.Held; Log(s.name + " หยุดรอที่สัญญาณเข้า", LogTone.Bad); }
                    }
                    if (s.phase == ServicePhase.Held) { s.hold += dt; S.stats.holdMin += dt / 60; _host.Pay(1.5 * dt, "penalty"); }
                }
                if (s.phase == ServicePhase.Entering)
                {
                    double stop = Geo.StopS(s.track, s.side), dist = stop - s.s;
                    s.v = Math.Max(1.2, Math.Min(Math.Min(s.v + 0.6 * dt, 12), Math.Sqrt(2 * 0.45 * Math.Max(0, dist))));
                    s.s = Math.Min(stop, s.s + s.v * dt);
                    if (s.s > StationGeometry.Far - 150 + s.Length && Lock(s.lockSide) > S.now + 1e8) SetLock(s.lockSide, S.now + 30);
                    if (stop - s.s < 0.3) Arrive(s, rain);
                }
                if (s.phase == ServicePhase.Dwell && S.now >= s.readyAt)
                {
                    s.phase = ServicePhase.Ready;
                    Log(s.name + " " + (s.mode == StopMode.Terminates ? "ส่งผู้โดยสารลงครบ พร้อมเข้าศูนย์ซ่อม" : "พร้อมออก") + " (ราง " + s.track + ")", LogTone.Good);
                }
                if (s.phase == ServicePhase.Ready && dep)
                {
                    if (s.depLag < 0) s.depLag = _diff.ArsDepartureLagSeconds();
                    if (S.now >= s.schedDep - 30 + s.depLag) Release(s);
                }
                if (s.phase == ServicePhase.Departing)
                {
                    s.v = Math.Min(16, s.v + 0.5 * dt); s.s += s.v * dt;
                    if (s.s > s.clearS && Lock(s.lockSide) > S.now + 1e8) SetLock(s.lockSide, S.now + 20);
                    if (s.s >= DeparturePath(s).Len - 5) { s.phase = ServicePhase.Gone; s.goneAt = S.now; }
                }
            }
            S.services.RemoveAll(x => x.phase == ServicePhase.Gone && S.now - x.goneAt >= 5);
        }

        void ArsPick(StationService s)
        {
            // usable tracks, smallest class first (stable, like Array.sort in the web build)
            var ok = new List<TrackDef>(); string why;
            foreach (var t in Def.tracks) if (TrackInfo(s, t, out why)) ok.Add(t);
            if (ok.Count == 0) { s.arsAt = State.now + 15; return; }
            var sorted = new List<TrackDef>(ok.Count);
            for (int c = 0; c <= 3; c++) foreach (var t in ok) if (t.cls == c) sorted.Add(t);
            var pick = sorted.Count > 1 && _diff.ArsPicksWorse() ? sorted[sorted.Count - 1] : sorted[0];
            s.track = pick.n;
        }

        void Arrive(StationService s, bool rain)
        {
            var S = State;
            s.phase = ServicePhase.Dwell; s.v = 0; s.arrAt = S.now; SetLock(s.lockSide, Math.Min(Lock(s.lockSide), S.now + 20));
            s.readyAt = s.mode == StopMode.Terminates ? S.now + 18 * 60
                : s.mode == StopMode.Originates ? Math.Max(S.now + 15 * 60, s.schedDep - 90)
                : Math.Max(S.now + 6 * 60, s.schedDep - 30);
            if (s.lift) s.readyAt += 3 * 60;
            if (rain) s.readyAt += _diff.Data.rain.dwellMin * 60;
            string kind; int min;
            if (_diff.RollFault(out kind, out min)) { s.fault = kind; s.readyAt += min * 60; Log(s.name + " " + kind + " ต้องใช้เวลาเพิ่ม " + min + " นาที", LogTone.Bad); }
        }

        public TrackPath DeparturePath(StationService s)
        {
            return s.departReversed ? Geo.ReversedPathFor(s.track, s.side) : Geo.PathFor(s.track, s.side);
        }
        /// <summary>Path the service is on right now (for drawing): departure path once departing, else its entry path.</summary>
        public TrackPath CurrentPath(StationService s) { return s.phase == ServicePhase.Departing ? DeparturePath(s) : Geo.PathFor(s.track, s.side); }

        /// <summary>Release a ready train (player button or departure ARS). False with a reason when the exit throat is busy.</summary>
        public bool Release(StationService s) { string why; return Release(s, out why); }
        public bool Release(StationService s, out string why)
        {
            var S = State;
            Side outSide = Def.IsTerminus ? Side.East : (s.side == Side.East ? Side.West : Side.East);
            if (Lock(outSide) > S.now) { why = "คอขวดด้านทางออกมีขบวนอื่นใช้อยู่ รอสักครู่"; return false; }
            var Pin = Geo.PathFor(s.track, s.side); int L = s.Length;
            if (Def.IsTerminus) { s.departReversed = true; s.s = Pin.Len - s.s + L; }
            s.clearS = DeparturePath(s).Len - StationGeometry.Far + 180 + L;
            SetLock(outSide, S.now + Locked); s.holdsLock = true; s.lockSide = outSide; s.phase = ServicePhase.Departing; s.v = 2;
            double late = s.mode == StopMode.Terminates ? Math.Max(0, ((s.arrAt >= 0 ? s.arrAt : S.now) - s.schedArr) / 60) : Math.Max(0, (S.now - s.schedDep) / 60);
            if (s.real && s.no != "" && s.mode != StopMode.Terminates) _ledger.Put(s.no, s.runDay, late, Def.id, _world.now);
            // the player is scored on delay added here; delay inherited from upstream is excused (but still travels on)
            double own = Math.Max(0, late - s.inDelay);
            int rev = (int)Clock.JsRound(s.rev * Math.Max(0.3, 1 - own * 0.02) * (s.real ? 1.2 : 1));
            _host.Earn(rev, "term"); S.stats.dep++; S.stats.rev += rev; if (own <= 3) S.stats.onTime++;
            _host.GainXP(own <= 3 ? 8 : 4);
            Log(s.name + " " + (s.mode == StopMode.Terminates ? "ออกไปศูนย์ซ่อม" : "ออกจากราง " + s.track) + " "
                + (late > 3 ? "ช้า " + Clock.JsRound(late) + " นาที" + (s.inDelay > 0 ? " (จากต้นทาง " + s.inDelay + ")" : "") : "ตรงเวลา") + " · ฿" + rev.ToString("N0"),
                own > 3 ? LogTone.Bad : LogTone.Good);
            why = null; return true;
        }

        /// <summary>On entering the station: trains still leaving are dropped, then the duty crew catches up to world time.</summary>
        public int Enter()
        {
            foreach (var s in State.services) if (s.phase == ServicePhase.Departing) { s.phase = ServicePhase.Gone; s.goneAt = State.now; }
            IsActive = true;
            return CatchUp();
        }

        /// <summary>Bring a station left behind up to the world clock: every train that would have finished is handled at half revenue.</summary>
        public int CatchUp()
        {
            var S = State; double T = _world.now;
            if (S.now >= T - 60) { _world.Follow(S.now); return 0; }
            if (T - S.now > 2 * Clock.Day) { S.now = T - Clock.Day; S.services.Clear(); S.genDay = -1; }   // long absence: replay the last day only
            int lastDay = (int)Math.Floor(T / Clock.Day) + (T % Clock.Day > 20 * 3600 ? 1 : 0);
            for (int day = (int)Math.Floor(S.now / Clock.Day); day <= lastDay; day++) if (S.genDay < day) GenerateDay(day);
            int n = 0, rev = 0;
            S.services.RemoveAll(s =>
            {
                if (s.schedDep + 600 >= T || s.phase == ServicePhase.Gone) return false;
                int late = _diff.RollDelay(s.schedDep); DelayLedger.Entry e;
                if (s.real && s.no != "" && s.mode != StopMode.Terminates && !_ledger.TryGet(s.no, s.runDay, out e)) _ledger.Put(s.no, s.runDay, late, Def.id, T);
                S.stats.dep++; if (late <= 3) S.stats.onTime++; rev += (int)Clock.JsRound(s.rev * 0.5); n++;
                return true;
            });
            S.now = T;
            foreach (var side in new[] { Side.East, Side.West })
            {
                bool held = false;
                foreach (var s in S.services) if (s.holdsLock && s.lockSide == side && (s.phase == ServicePhase.Entering || s.phase == ServicePhase.Departing)) held = true;
                if (!held) SetLock(side, 0);
            }
            if (n > 0)
            {
                S.stats.rev += rev; _host.Earn(rev, "term");
                Log("ระหว่างที่ไม่อยู่ ทีมเวรจัดการ " + n + " ขบวน (รายได้ครึ่งหนึ่ง ฿" + rev.ToString("N0") + ")");
                _host.Notify("ทีมเวรจัดการ " + n + " ขบวนระหว่างที่ไม่อยู่ · +฿" + rev.ToString("N0"));
            }
            return n;
        }

        /// <summary>A train needs the player: held at the signal, approaching without a platform, or ready at departure time.</summary>
        public bool NeedsAttention(StationService s)
        {
            return s.phase == ServicePhase.Held || (s.phase == ServicePhase.Approach && s.track == 0) || (s.phase == ServicePhase.Ready && State.now >= s.schedDep - 60);
        }
        public StationService Find(string id) { foreach (var s in State.services) if (s.id == id) return s; return null; }
    }
}
