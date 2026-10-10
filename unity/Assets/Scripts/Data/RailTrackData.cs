using System;
using System.Collections.Generic;

// Data model for unity/Assets/StreamingAssets/RailTrack/*.json, exported from the web prototype by
// railway/tools/export_unity.js (source: railway/src/export.js). Field names match the JSON exactly so
// UnityEngine.JsonUtility can fill them; every root is an object holding arrays (JsonUtility has no dictionaries).
namespace ThaiRail.Data
{
    // ---------- stations.json ----------
    [Serializable] public sealed class StationsFile { public StationDef[] stations; public HuaLamphongDef hualamphong; }

    /// <summary>A timetable-driven station. Units: 1 = 1 m. x runs along the platforms, z across the yard.</summary>
    [Serializable]
    public sealed class StationDef
    {
        public string id, name, en;
        /// <summary>"T" terminus (buffers at -x), "X" through station.</summary>
        public string kind;
        public float km;
        public string line, style, eastLabel;
        /// <summary>Track level above ground (Krung Thep Aphiwat runs long-distance trains on the 2nd floor, 10 m).</summary>
        public float deck;
        public float P0, P1, bz, bw, bd;
        public string[] extras, real, eastOf;
        public TrackDef[] tracks;
        public PlatformDef[] platforms;
        public LocalTrains locals;
        public string endWest, endEast;
        public bool IsTerminus { get { return kind == "T"; } }
    }
    /// <summary>cls = longest consist class the track takes: 0 A (≤4 cars), 1 B (≤6), 2 C (≤9), 3 D (10+).</summary>
    [Serializable] public sealed class TrackDef { public int n; public float z; public int cls; public bool siding, thru, platform; }
    [Serializable] public sealed class PlatformDef { public float z, w; }
    [Serializable] public sealed class LocalTrains { public string[] from; public string prefix; public int[] no; public int gapMin, gapMax; }

    [Serializable]
    public sealed class HuaLamphongDef
    {
        public string id, name, en, line;
        public int tracks;
        public string[] real;
        public HlpService[] longHaul, pushPull;
        /// <summary>Consist class each platform 1..14 accepts (index 0 = platform 1).</summary>
        public int[] platformClass;
    }
    [Serializable] public sealed class HlpService { public int no; public string from; }

    // ---------- timetable.json ----------
    [Serializable] public sealed class TimetableFile { public Place[] places; public TimetableTrain[] trains; public ServiceClass[] classes; }
    [Serializable] public sealed class Place { public string code, name; }
    /// <summary>One real SRT long-distance train. dep/arr are "HH:MM"; arr earlier than dep means next day.</summary>
    [Serializable]
    public sealed class TimetableTrain
    {
        public string no, cls, line, from, to, dep, arr, note;
        public int DepSec { get { return Clock.ToSec(dep); } }
        public int ArrSec { get { int a = Clock.ToSec(arr), d = DepSec; return a < d ? a + 86400 : a; } }
    }
    [Serializable] public sealed class ServiceClass { public string cls, kind, car; public int rev, vehMin, vehMax; }

    // ---------- rolling_stock.json ----------
    [Serializable] public sealed class RollingStockFile { public TrainModel[] models; public ModelAlias[] aliases; public TrainInfo[] info; }
    [Serializable] public sealed class TrainModel { public string id, name, kind, maker; public float len; public bool ac; public Livery livery; }
    /// <summary>Hex colours (#RRGGBB) of the livery bands.</summary>
    [Serializable] public sealed class Livery { public string body, low, line, roof; }
    [Serializable] public sealed class ModelAlias { public string key, model; }
    [Serializable] public sealed class TrainInfo { public string id, tier, role, note; public string[] consist; }

    // ---------- progression.json ----------
    [Serializable]
    public sealed class ProgressionFile
    {
        /// <summary>XP needed to leave level i+1.</summary>
        public int[] xpNeed;
        public Reward[] rewards;
        public ControllerDef[] controllers;
        public HubDef[] hubs;
        public FleetTierDef[] tiers;
    }
    /// <summary>kind: money | coins | cap | crew | liv (value = livery id).</summary>
    [Serializable] public sealed class Reward { public int lv; public string kind, value; }
    [Serializable] public sealed class ControllerDef { public string k, name, en, where, desc; }
    [Serializable] public sealed class HubDef { public string id, mode, code, name, sub; }
    [Serializable] public sealed class FleetTierDef { public string id, name, full, desc; public int tier, unlock, price; }

    // ---------- difficulty.json ----------
    [Serializable]
    public sealed class DifficultyFile
    {
        public RushWindow[] rush;
        public ChanceTable delay;
        public FaultTable fault;
        public RainTable rain;
        public ArsTable ars;
        /// <summary>Game seconds per real second at 1× (timetable stations, Hua Lamphong, network map).</summary>
        public float stationRate, hlpRate, worldNetRate;
    }
    [Serializable] public sealed class RushWindow { public float from, to, factor; }
    /// <summary>Chance p + pLv per level above 1, capped at pMax; size ~ exponential(mean) minutes, capped at max.</summary>
    [Serializable] public sealed class ChanceTable { public float p, pLv, pMax, mean, max; }
    [Serializable] public sealed class FaultTable { public float p, pLv, pMax; public int min, max; public string[] kinds; }
    [Serializable] public sealed class RainTable { public float p, approach, dwellMin, delayP; }
    [Serializable] public sealed class ArsTable { public int reactArrMin, reactArrMax, lagDepMin, lagDepMax; public float pickWrong; }

    // ---------- network.json ----------
    [Serializable]
    public sealed class NetworkFile
    {
        /// <summary>Map units: 1 unit = unitKm km, origin at lon0/lat0 (Hua Lamphong), +z south.</summary>
        public float unitKm, lon0, lat0;
        public NetStation[] stations;
        public MapPoint[] railNodes;
        public RailEdge[] railEdges;
        public RailSnap[] snaps;
        public Ring[] thailand;
        public Neighbour[] neighbours;
    }
    [Serializable] public sealed class NetStation { public string id, name, type; public float pax, cargo, x, z; public int cost, plat, railNode; }
    [Serializable] public struct MapPoint { public float x, z; }
    [Serializable] public struct RailEdge { public int a, b; }
    [Serializable] public sealed class RailSnap { public string code; public int node; }
    [Serializable] public sealed class Ring { public MapPoint[] pts; }
    [Serializable] public sealed class Neighbour { public string name; public Ring[] rings; }

    /// <summary>Everything loaded, with lookups built once.</summary>
    public sealed class RailTrackDatabase
    {
        public StationsFile stations;
        public TimetableFile timetable;
        public RollingStockFile rollingStock;
        public ProgressionFile progression;
        public DifficultyFile difficulty;
        public NetworkFile network;

        readonly Dictionary<string, StationDef> _stations = new Dictionary<string, StationDef>();
        readonly Dictionary<string, TrainModel> _models = new Dictionary<string, TrainModel>();
        readonly Dictionary<string, int> _snap = new Dictionary<string, int>();
        readonly Dictionary<string, string> _place = new Dictionary<string, string>();

        public void Index()
        {
            _stations.Clear(); _models.Clear(); _snap.Clear(); _place.Clear();
            foreach (var s in stations.stations) _stations[s.id] = s;
            foreach (var m in rollingStock.models) _models[m.id] = m;
            foreach (var a in rollingStock.aliases) if (!_models.ContainsKey(a.key) && _models.ContainsKey(a.model)) _models[a.key] = _models[a.model];
            foreach (var s in network.snaps) _snap[s.code] = s.node;
            foreach (var p in timetable.places) _place[p.code] = p.name;
        }
        public StationDef Station(string id) { StationDef s; return _stations.TryGetValue(id, out s) ? s : null; }
        public TrainModel Model(string idOrAlias) { TrainModel m; return _models.TryGetValue(idOrAlias, out m) ? m : null; }
        public int RailNode(string code) { int n; return _snap.TryGetValue(code, out n) ? n : -1; }
        public string PlaceName(string code) { string n; return _place.TryGetValue(code, out n) ? n : code; }
    }

    public static class Clock
    {
        public const int Day = 86400;
        public static int ToSec(string hhmm)
        {
            if (string.IsNullOrEmpty(hhmm)) return 0;
            int c = hhmm.IndexOf(':');
            return int.Parse(hhmm.Substring(0, c)) * 3600 + int.Parse(hhmm.Substring(c + 1)) * 60;
        }
        /// <summary>JavaScript Math.round (halves round up), so results match the web build; Math.Round is banker's rounding.</summary>
        public static double JsRound(double x) { return Math.Floor(x + 0.5); }
        public static string HM(double sec)
        {
            int m = (int)Math.Floor((((sec % Day) + Day) % Day) / 60);
            return (m / 60).ToString("00") + ":" + (m % 60).ToString("00");
        }
    }
}
