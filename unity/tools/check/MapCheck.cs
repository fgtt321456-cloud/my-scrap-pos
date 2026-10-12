// Main menu and Thailand map checks: real trains on the map at the same places as the web build, land polygons
// triangulated without losing area, hubs locked by level, stars from station records.
using System; using System.Collections.Generic; using System.IO; using System.Linq;
using ThaiRail.Data; using ThaiRail.Meta; using ThaiRail.Scenery; using ThaiRail.Simulation; using ThaiRail.Simulation.Hlp;

[Serializable] sealed class GoldenMap { public GoldenRun[] running; }
[Serializable] sealed class GoldenRun { public double now; public GoldenTrain[] trains; }
[Serializable] sealed class GoldenTrain { public string no; public int dday; public double f, x, z; }

static class MapCheck
{
    public static void Run(RailTrackDatabase db, string checkDir, Action<string, bool, string> Check)
    {
        var graph = new RailGraph(db);
        var gold = UnityEngine.JsonUtility.FromJson<GoldenMap>(File.ReadAllText(Path.Combine(checkDir, "golden_map.json")));
        double worst = 0; int count = 0, mism = 0;
        foreach (var g in gold.running)
        {
            var run = TimetableTrains.Running(g.now, db, graph, new DelayLedger());
            if (run.Count != g.trains.Length) mism++;
            foreach (var t in g.trains)
            {
                var c = run.FirstOrDefault(r => r.t.no == t.no && r.runDay == t.dday);
                if (c.t == null) { mism++; continue; }
                worst = Math.Max(worst, Math.Max(Math.Abs(c.x - t.x), Math.Abs(c.z - t.z))); count++;
            }
        }
        Check("map: real trains at the same places as the web build", mism == 0 && worst < 1e-3, count + " train positions over " + gold.running.Length + " times, worst " + worst.ToString("g3") + " map units");

        var menu = new MenuModel(db);
        double lost = 0; int rings = 0;
        foreach (var r in db.network.thailand.Concat(db.network.neighbours.SelectMany(n => n.rings)))
        {
            double area = Math.Abs(Polygon.SignedArea(r.pts)); if (area < 1e-6) continue;
            var idx = Polygon.Triangulate(r.pts); double sum = 0;
            for (int i = 0; i + 2 < idx.Count; i += 3)
            {
                MapPoint a = r.pts[idx[i]], b = r.pts[idx[i + 1]], c = r.pts[idx[i + 2]];
                sum += Math.Abs(((double)b.x - a.x) * ((double)c.z - a.z) - ((double)b.z - a.z) * ((double)c.x - a.x)) / 2;
            }
            lost = Math.Max(lost, Math.Abs(sum - area) / area); rings++;
        }
        Check("map: land triangulated without gaps or overlaps", lost < 1e-6 && menu.ThailandTris.Count == db.network.thailand.Length, rings + " rings, worst area error " + lost.ToString("P4"));

        var hubs1 = menu.Hubs(1, id => null, null); var hubs6 = menu.Hubs(6, id => null, null);
        bool locks = hubs1.Count(h => h.locked) == 5 && !hubs1.First(h => h.stationId == "HLP").locked && hubs6.All(h => !h.locked)
            && hubs1.Where(h => h.stationId != null).All(h => Math.Abs(h.mapX) + Math.Abs(h.mapZ) > 0 || h.stationId == "HLP");
        var S = new StationState { id = "CMI" }; S.stats.dep = 40; S.stats.onTime = 36; S.stats.holdMin = 20;
        var T = new HlpState(); T.stats.dep = 12; T.stats.onTime = 6;
        Check("menu: hubs open by level, stars from the station record", locks && MenuModel.StationStars(S) == 5 && MenuModel.HlpStars(T) == 2 && MenuModel.StationStars(null) == 1,
            string.Join(" ", hubs1.Select(h => h.code + (h.locked ? "🔒" + h.lockLevel : "✓"))));
    }
}
