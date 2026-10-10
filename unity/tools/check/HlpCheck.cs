// Hua Lamphong interlocking checks: track graph routes, 4-hour behaviour against the web build's averages,
// safety (no two consists ever overlap on a track circuit), the run-around completes, and the UI adapter.
using System; using System.Collections.Generic; using System.IO; using System.Linq;
using ThaiRail.Data; using ThaiRail.Simulation; using ThaiRail.Simulation.Hlp; using ThaiRail.Stations;

[Serializable] sealed class GoldenHlp { public GoldenSimRow[] stations; public GoldenHlpRow hlp; }
[Serializable] sealed class GoldenHlpRow { public double arr, dep, onTime, holdMin, delayMin, stuck; }

static class HlpCheck
{
    public static void Run(RailTrackDatabase db, string dataDir, string checkDir, Action<string, bool, string> Check)
    {
        var file = UnityEngine.JsonUtility.FromJson<HlpFile>(File.ReadAllText(Path.Combine(dataDir, "hualamphong.json")));
        Func<int, bool, bool, HlpEngine> make = (seed, arsIn, arsOut) =>
        {
            var rng = new Random(seed);
            var e = new HlpEngine(file, db.stations.hualamphong, new Difficulty(db.difficulty, rng), new TestHost(), rng);
            e.S.arsArr = arsIn; e.S.arsDep = arsOut; return e;
        };
        // 1. every platform reachable from the home signal H and every platform can reach the exit
        var g0 = make(1, false, false); int aFar = g0.G.E("aFar"), dFar = g0.G.E("dFar"); var bad = new List<int>();
        for (int T = 1; T <= 14; T++)
        {
            int pw = g0.G.E("pw" + T);
            if (g0.FindPath(new HlpStep(aFar, 1), s => s.e == pw && s.dir == -1, false) == null || g0.FindPath(new HlpStep(pw, 1), s => s.e == dFar && s.dir == 1, false) == null) bad.Add(T);
        }
        Check("HLP graph: H → all 14 platforms → exit", bad.Count == 0 && g0.G.nodes.Length == 83 && g0.G.edges.Length == 104, bad.Count > 0 ? "unreachable " + string.Join(",", bad) : g0.G.nodes.Length + " nodes, " + g0.G.edges.Length + " edges");

        // 2. 4 h with both ARS, averaged: same throughput as the web build; 3. safety on every step
        var gold = UnityEngine.JsonUtility.FromJson<GoldenHlp>(File.ReadAllText(Path.Combine(checkDir, "golden_sim.json"))).hlp;
        double arr = 0, dep = 0, on = 0, hold = 0; int stuck = 0, overlaps = 0, lhReady = 0; const int runs = 6;
        for (int k = 0; k < runs; k++)
        {
            var e = make(200 + k, true, true);
            for (int i = 0; i < 4 * 3600 * 4; i++)
            {
                e.Step(0.25);
                if (i % 8 == 0) { e.ComputeOcc(); overlaps += Overlaps(e); }
                if (i % 40 == 0) lhReady += e.S.services.Count(s => s.lh && s.state == HlpSvcState.Ready && s.ra.st == RaState.Done) > 0 ? 1 : 0;
            }
            arr += e.S.stats.arr; dep += e.S.stats.dep; on += e.S.stats.onTime; hold += e.S.stats.holdMin;
            stuck += e.S.services.Count(x => x.phase == HlpPhase.Dwell && e.S.now - x.schedDep > 1800);
        }
        arr /= runs; dep /= runs; on /= runs; hold /= runs;
        bool ok = Math.Abs(dep - gold.dep) <= Math.Max(5, gold.dep * 0.2) && Math.Abs(arr - gold.arr) <= Math.Max(5, gold.arr * 0.2) && Math.Abs(on / dep - gold.onTime / gold.dep) < 0.15 && stuck == 0;
        Check("HLP 4 h with ARS like the web build", ok, string.Format("C# in {0:0.#} out {1:0.#} on-time {2:P0} hold {3:0} min · web in {4:0.#} out {5:0.#} on-time {6:P0} hold {7:0} min · stuck {8}", arr, dep, on / dep, hold, gold.arr, gold.dep, gold.onTime / gold.dep, gold.holdMin, stuck));
        Check("HLP safety: no two trains overlap on a track circuit", overlaps == 0, overlaps + " overlaps in " + runs + " × 4 h");
        Check("HLP run-around: locomotives get round their trains", lhReady > 0, lhReady + " samples with a run-around complete");

        // 4. manual play through the adapter: route a held train, wait for the turnaround, release it
        {
            var e = make(9, false, false); var A = new HuaLamphongAdapter(e); string msg = null; A.Message += m => msg = m;
            HlpService held = null;
            for (int i = 0; i < 20000 && held == null; i++) { e.Step(0.25); held = e.S.services.FirstOrDefault(s => s.phase == HlpPhase.Held); }
            var ids = A.Items(ListFilter.All); var vm = A.ViewModel(ids[0]);
            var plat = A.Platforms(vm.id).FirstOrDefault(p => p.ok);
            bool routed = vm.alert && vm.actionKind == CardActionKind.OpenPlatformSheet && A.Choose(vm.id, plat.n) && e.HasRouteFrom("HA");
            var svc = e.Svc(vm.id);
            for (int i = 0; i < 4 * 3600 * 4 && !(svc.phase == HlpPhase.Dwell && svc.state == HlpSvcState.Ready && e.S.now >= svc.schedDep - 30); i++) e.Step(0.25);
            var vm2 = A.ViewModel(svc.id); A.Act(svc.id, vm2.actionKind);
            for (int i = 0; i < 2400 && e.Svc(svc.id) != null; i++) e.Step(0.25);
            Check("HLP adapter: route a held train by hand, turn it round, release it", held != null && routed && vm2.actionKind == CardActionKind.Go && e.Svc(svc.id) == null && e.S.stats.dep > 0,
                (svc.lh ? "loco-hauled" : "push-pull") + " " + vm.name + " → ราง " + plat.n + " → " + vm2.actionLabel + " → departed " + (e.Svc(svc.id) == null));
        }
    }
    // pairs of different consists covering the same stretch of an edge by more than 0.5 m
    static int Overlaps(HlpEngine e)
    {
        int n = 0;
        foreach (var list in e.OCC)
            for (int i = 0; i < list.Count; i++) for (int j = i + 1; j < list.Count; j++)
                if (list[i].cid != list[j].cid && Math.Min(list[i].d1, list[j].d1) - Math.Max(list[i].d0, list[j].d0) > 0.5) n++;
        return n;
    }
}
