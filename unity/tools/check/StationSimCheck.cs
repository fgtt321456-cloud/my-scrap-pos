// Station simulation checks: geometry against the web build's numbers, 24 h behaviour against the web build's
// averages, the KRT → HDY delay hand-off, catch-up and the UI adapter. Called from DataCheck.Main.
using System; using System.Collections.Generic; using System.IO; using System.Linq;
using ThaiRail.Data; using ThaiRail.Simulation; using ThaiRail.Stations;

sealed class TestHost : IStationHost
{
    public bool app, dep; public long earned; public double paid; public int xp;
    public bool ControllerOn(string k) { return k == "app" ? app : k == "dep" ? dep : false; }
    public void Earn(int a, string acc) { earned += a; }
    public void Pay(double a, string acc) { paid += a; }
    public void GainXP(int n) { xp += n; }
    public void Notify(string t) { }
}

[Serializable] sealed class GoldenPaths { public GoldenPath[] paths; }
[Serializable] sealed class GoldenPath { public string station; public int track; public double len, stopE, stopW; public GoldenPt mid; }
[Serializable] sealed class GoldenPt { public double x, y, z, dx, dz; }
[Serializable] sealed class GoldenSim { public GoldenSimRow[] stations; }
[Serializable] sealed class GoldenSimRow { public string station; public double dep, onTime, holdMin; }

static class StationSimCheck
{
    public static int Run(RailTrackDatabase db, string checkDir, Action<string, bool, string> Check)
    {
        int before = 0;
        var graph = new RailGraph(db);
        // 1. geometry: every track path, stop point and a mid point match the web build
        var gp = UnityEngine.JsonUtility.FromJson<GoldenPaths>(File.ReadAllText(Path.Combine(checkDir, "golden_paths.json")));
        double worst = 0; string where = "";
        foreach (var g in gp.paths)
        {
            var geo = new StationGeometry(db.Station(g.station));
            var P = geo.PathFor(g.track, Side.East); double dx, dz; var m = P.At(P.Len * 0.37, out dx, out dz);
            var errs = new List<double> { Math.Abs(P.Len - g.len), Math.Abs(geo.StopS(g.track, Side.East) - g.stopE), Math.Abs(m.x - g.mid.x), Math.Abs(m.y - g.mid.y), Math.Abs(m.z - g.mid.z), Math.Abs(dx - g.mid.dx), Math.Abs(dz - g.mid.dz) };
            if (g.stopW >= 0) errs.Add(Math.Abs(geo.StopS(g.track, Side.West) - g.stopW));
            double e = errs.Max(); if (e > worst) { worst = e; where = g.station + " track " + g.track; }
        }
        Check("track geometry matches the web build (" + gp.paths.Length + " tracks)", worst < 1e-6, "worst " + worst.ToString("g3") + " " + where);

        // 2. 24 h per station with both ARS controllers: same throughput as the web build (averaged)
        var gs = UnityEngine.JsonUtility.FromJson<GoldenSim>(File.ReadAllText(Path.Combine(checkDir, "golden_sim.json")));
        foreach (var row in gs.stations)
        {
            double dep = 0, onTime = 0, hold = 0; int stuck = 0; const int runs = 6;
            for (int k = 0; k < runs; k++)
            {
                var rng = new Random(100 + k); var world = new WorldClock(); var host = new TestHost { app = true, dep = true };
                var sim = new TimetableStationSim(db.Station(row.station), db, graph, new Difficulty(db.difficulty, rng), world, new DelayLedger(), host, rng);
                sim.Enter();
                for (int i = 0; i < 24 * 7200; i++) sim.Step(0.5);
                dep += sim.State.stats.dep; onTime += sim.State.stats.onTime; hold += sim.State.stats.holdMin;
                stuck += sim.State.services.Count(s => (s.phase == ServicePhase.Ready && sim.State.now - s.schedDep > 3600) || (s.phase == ServicePhase.Held && s.hold > 3600));
            }
            dep /= runs; onTime /= runs; hold /= runs;
            bool ok = Math.Abs(dep - row.dep) <= Math.Max(4, row.dep * 0.2) && Math.Abs(onTime / dep - row.onTime / row.dep) < 0.15 && stuck == 0;
            Check("station " + row.station + " 24 h like the web build", ok, string.Format("C# dep {0:0.#} on-time {1:P0} hold {2:0} min · web dep {3:0.#} on-time {4:P0} hold {5:0} min · stuck {6}", dep, onTime / dep, hold, row.dep, row.onTime / row.dep, row.holdMin, stuck));
        }

        // 3. KRT releases 31 about 25 min late → HDY gets it next morning minus the recovery
        {
            var rng = new Random(7); var world = new WorldClock(); var ledger = new DelayLedger(); var diff = new Difficulty(db.difficulty, rng);
            var hostK = new TestHost { app = true, dep = true };   // departure ARS clears the platforms; 31 alone is held back
            var krt = new TimetableStationSim(db.Station("KRT"), db, graph, diff, world, ledger, hostK, rng); krt.Enter();
            StationService t31 = null;
            for (int i = 0; i < 60000; i++) { krt.Step(1); t31 = krt.State.services.FirstOrDefault(s => s.no == "31" && s.mode == StopMode.Originates); if (t31 != null) t31.depLag = 1e6; if (t31 != null && t31.phase == ServicePhase.Ready && krt.State.now >= t31.schedDep + 25 * 60) break; }
            bool released = t31 != null && t31.phase == ServicePhase.Ready && krt.Release(t31);
            for (int i = 0; i < 600 && !released && t31 != null; i++) { krt.Step(1); released = t31.phase == ServicePhase.Ready && krt.Release(t31); }
            DelayLedger.Entry e; bool inLedger = t31 != null && ledger.TryGet("31", t31.runDay, out e) && e.at == "KRT" && e.minutes >= 25;
            Check("KRT: 31 released late is written to the ledger", released && inLedger, t31 == null ? "no 31" : "late " + (ledger.TryGet("31", t31.runDay, out e) ? e.minutes : -1));
            krt.IsActive = false;
            var hdy = new TimetableStationSim(db.Station("HDY"), db, graph, diff, world, ledger, new TestHost { app = true, dep = true }, rng);
            hdy.Enter();
            bool caught = Math.Abs(hdy.State.now - world.now) < 1;
            StationService h31 = null;
            for (int i = 0; i < 20000; i++) { hdy.Step(5); h31 = hdy.State.services.FirstOrDefault(s => s.no == "31" && s.mode == StopMode.Terminates); if (h31 != null && h31.delayResolved) break; }
            ledger.TryGet("31", 0, out e);
            Check("HDY: catches up and inherits 31's delay (recovered)", caught && h31 != null && h31.inDelay == DelayLedger.Recover(e.minutes) && h31.delaySrc == "KRT" && h31.Eta == h31.schedArr + h31.inDelay * 60,
                h31 == null ? "no 31" : "inDelay " + h31.inDelay + " expected " + DelayLedger.Recover(e.minutes));
            // back to KRT: everything that should have left is handled by the duty crew
            hdy.IsActive = false; long before0 = hostK.earned; int handled = krt.Enter();
            bool krtOk = Math.Abs(krt.State.now - world.now) < 1 && handled > 0 && hostK.earned > before0 && !krt.State.services.Any(s => s.phase != ServicePhase.Gone && s.schedDep + 600 < krt.State.now);
            Check("KRT: catch-up on re-entry", krtOk, "handled " + handled);
        }

        // 4. adapter: list, view model, choosing a platform through the sheet, releasing through the card
        {
            var rng = new Random(3); var world = new WorldClock(); var host = new TestHost();
            var sim = new TimetableStationSim(db.Station("CMI"), db, graph, new Difficulty(db.difficulty, rng), world, new DelayLedger(), host, rng);
            var A = new TimetableStationAdapter(sim, db); sim.Enter();
            for (int i = 0; i < 20000 && !sim.State.services.Any(s => s.phase == ServicePhase.Approach || s.phase == ServicePhase.Held); i++) sim.Step(0.5);
            var ids = A.Items(ListFilter.All); var vm = A.ViewModel(ids[0]);
            var plat = A.Platforms(vm.id).FirstOrDefault(p => p.ok);
            bool chose = vm.alert && vm.actionKind == CardActionKind.OpenPlatformSheet && A.Choose(vm.id, plat.n);
            var svc = sim.Find(vm.id);
            for (int i = 0; i < 20000 && svc.phase != ServicePhase.Ready; i++) sim.Step(0.5);
            var vm2 = A.ViewModel(svc.id); A.Act(svc.id, vm2.actionKind);
            Check("adapter: urgent train first, platform via sheet, release via card", chose && vm2.actionKind == CardActionKind.Go && svc.phase == ServicePhase.Departing && host.earned > 0,
                vm.name + " · " + vm.status + " → " + vm2.actionLabel + " → " + svc.phase);
        }
        return before;
    }
}
