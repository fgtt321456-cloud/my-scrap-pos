using System;
using System.Collections.Generic;
using System.Linq;
using ThaiRail.Data;
using ThaiRail.Scenery;
using ThaiRail.Simulation;
using ThaiRail.Simulation.Hlp;

namespace ThaiRail.Meta
{
    /// <summary>A playable place on the station picker (port of HUBS in meta.js).</summary>
    public sealed class HubCard
    {
        public string id, stationId, code, name, sub;
        public int lockLevel, stars;
        public bool locked, isMap;
        public float mapX, mapZ;
    }

    /// <summary>
    /// Main-menu data without drawing: the hub cards (locked by player level, stars from each station's record — port of
    /// stnStars / termStars) and the Thailand map geometry (triangulated land, rails, stations) for the map view.
    /// </summary>
    public sealed class MenuModel
    {
        readonly RailTrackDatabase _db;
        public readonly List<float[]> ThailandTris = new List<float[]>(), NeighbourTris = new List<float[]>();
        public readonly List<float[]> RailSegments = new List<float[]>();
        public float MinX, MaxX, MinZ, MaxZ;

        public MenuModel(RailTrackDatabase db)
        {
            _db = db; var N = db.network;
            foreach (var r in N.thailand) ThailandTris.Add(Tris(r.pts));
            foreach (var nb in N.neighbours) foreach (var r in nb.rings) NeighbourTris.Add(Tris(r.pts));
            foreach (var e in N.railEdges) { var a = N.railNodes[e.a]; var b = N.railNodes[e.b]; RailSegments.Add(new[] { a.x, a.z, b.x, b.z }); }
            MinX = MinZ = float.MaxValue; MaxX = MaxZ = float.MinValue;
            foreach (var r in N.thailand) foreach (var p in r.pts) { MinX = Math.Min(MinX, p.x); MaxX = Math.Max(MaxX, p.x); MinZ = Math.Min(MinZ, p.z); MaxZ = Math.Max(MaxZ, p.z); }
        }
        /// <summary>Flat triangle list x0,z0,x1,z1,x2,z2,… for one ring.</summary>
        static float[] Tris(MapPoint[] pts)
        {
            var idx = Polygon.Triangulate(pts); var f = new float[idx.Count * 2];
            for (int i = 0; i < idx.Count; i++) { f[i * 2] = pts[idx[i]].x; f[i * 2 + 1] = pts[idx[i]].z; }
            return f;
        }

        /// <summary>Hub cards for the picker. Stars use the saved station records (pass null for a fresh profile).</summary>
        public List<HubCard> Hubs(int playerLevel, Func<string, StationState> stationState, HlpState hlp)
        {
            var list = new List<HubCard>();
            foreach (var h in _db.progression.hubs)
            {
                string st = h.mode == "term" ? "HLP" : h.mode.StartsWith("stn:") ? h.mode.Substring(4) : null;
                var card = new HubCard { id = h.id, stationId = st, code = h.code, name = h.name, sub = h.sub, lockLevel = h.@lock, locked = playerLevel < h.@lock, isMap = h.mode == "net" };
                var sp = _db.network.stationPoints == null ? null : _db.network.stationPoints.FirstOrDefault(p => p.code == (st == "HLP" ? "BKK" : st));
                if (sp != null) { card.mapX = sp.x; card.mapZ = sp.z; }
                card.stars = st == "HLP" ? HlpStars(hlp) : st != null ? StationStars(stationState != null ? stationState(st) : null) : 0;
                list.Add(card);
            }
            return list;
        }
        /// <summary>stnStars(): 1 + 5 departures + 80 % on time + 30 departures + under 2 held minutes per departure.</summary>
        public static int StationStars(StationState S)
        {
            if (S == null) return 1; var s = S.stats;
            return 1 + (s.dep >= 5 ? 1 : 0) + (s.dep >= 5 && (double)s.onTime / s.dep >= 0.8 ? 1 : 0) + (s.dep >= 30 ? 1 : 0) + (s.dep >= 10 && s.holdMin / s.dep < 2 ? 1 : 0);
        }
        /// <summary>termStars(): 1 + 10 departures + 80 % on time + 60 departures + under 1.5 held minutes per departure.</summary>
        public static int HlpStars(HlpState T)
        {
            if (T == null) return 1; var s = T.stats;
            return 1 + (s.dep >= 10 ? 1 : 0) + (s.dep >= 10 && (double)s.onTime / s.dep >= 0.8 ? 1 : 0) + (s.dep >= 60 ? 1 : 0) + (s.dep >= 20 && s.holdMin / s.dep < 1.5 ? 1 : 0);
        }
    }
}
