// Data + simulation checks against the exported JSON. Run via tools/check/check.sh
using System; using System.IO; using System.Linq; using ThaiRail.Data; using ThaiRail.Simulation;
static class T {
  static int fail;
  static void Check(string n, bool ok, string info = "") { Console.WriteLine((ok ? "PASS  " : "FAIL  ") + n + "  " + info); if (!ok) fail++; }
  static int Main(string[] a) {
    Console.OutputEncoding = new System.Text.UTF8Encoding(false);
    string dir = a[0]; Func<string, string> R = f => File.ReadAllText(Path.Combine(dir, f));
    var db = RailTrackDataLoader.Parse(R("stations.json"), R("timetable.json"), R("rolling_stock.json"), R("progression.json"), R("difficulty.json"), R("network.json"), R("hualamphong.json"));
    Check("5 timetable stations + HLP", db.stations.stations.Length == 5 && db.stations.hualamphong.platformClass.Length == 14, db.stations.stations.Length.ToString());
    var cmi = db.Station("CMI"); Check("CMI: 7 tracks, 4 with platforms, terminus", cmi.tracks.Length == 7 && cmi.tracks.Count(x => x.platform) == 4 && cmi.IsTerminus);
    Check("timetable trains + classes", db.timetable.trains.Length >= 20 && db.timetable.classes.Length > 3, db.timetable.trains.Length + "");
    Check("model alias GEA -> GEK", db.Model("GEA") != null && db.Model("GEA").id == "GEK");
    Check("livery colours", db.Model("HID").livery.body == "#E2602A");
    Check("progression", db.progression.xpNeed[0] == 60 && db.progression.rewards.Length > 10 && db.progression.tiers.Length == 4);
    var g = new RailGraph(db); float km = g.Km("KRT", "CMI");
    Check("rail km KRT→CMI close to 751", km > 650 && km < 850, km.ToString("0"));
    var ev = TimetableEvents.For("HDY", db, g);
    Check("HDY: 31 terminates, 37 passes", ev.Any(e => e.trainNo == "31" && e.mode == StopMode.Terminates) && ev.Any(e => e.trainNo == "37" && e.mode == StopMode.Through), ev.Count + " events");
    var d = new Difficulty(db.difficulty, new Random(1));
    Check("rush 07:30 and 12:00", d.RushFactor(7.5 * 3600) < 1 && d.RushFactor(12 * 3600) == 1);
    var rain = string.Join(",", Enumerable.Range(0, 10).Select(i => d.IsRain(i * 86400 + 3600) ? "1" : "0"));
    Check("weather matches the web build", rain == "1,0,0,0,0,0,0,0,0,0", rain);
    int n = 0; for (int i = 0; i < 2000; i++) if (d.RollDelay(86400 + 12 * 3600) > 0) n++;
    Check("delay chance ≈ 22% on a dry day", n > 330 && n < 560, n.ToString());
    var L = new DelayLedger(); L.Put("31", 0, 25, "KRT", 61000); DelayLedger.Entry e2;
    Check("ledger round trip + recovery", L.TryGet("31", 0, out e2) && e2.minutes == 25 && DelayLedger.Recover(25) == 19);
    Check("run day of 31 at HDY (06:40 next morning)", DelayLedger.RunDay(Clock.ToSec("06:40"), Clock.ToSec("16:45"), 1) == 0);
    StationSimCheck.Run(db, a.Length > 1 ? a[1] : ".", Check);
    SceneryCheck.Run(db, Check, a.Length > 2 ? a[2] : null);
    HlpCheck.Run(db, a[0], a.Length > 1 ? a[1] : ".", Check);
    HlpCheck.RunPanels(db, a[0], Check);
    MetaCheck.Run(db, a[0], Check);
    TrainCheck.Run(db, Path.GetFullPath(Path.Combine(a[1], "../..")), Check, a.Length > 2 ? a[2] : null);
    return fail;
  }
}
