using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    /// <summary>
    /// The real Thai rail network (Natural Earth 1:10m) from network.json, with shortest paths between stations.
    /// Port of railPath/railKm in railway/src/geo.js and stations.js. Paths are cached per station pair.
    /// </summary>
    public sealed class RailGraph
    {
        readonly RailTrackDatabase _db;
        readonly List<KeyValuePair<int, float>>[] _adj;
        readonly Dictionary<string, MapPoint[]> _cache = new Dictionary<string, MapPoint[]>();

        public RailGraph(RailTrackDatabase db)
        {
            _db = db;
            var N = db.network.railNodes;
            _adj = new List<KeyValuePair<int, float>>[N.Length];
            for (int i = 0; i < N.Length; i++) _adj[i] = new List<KeyValuePair<int, float>>(3);
            foreach (var e in db.network.railEdges)
            {
                float d = (float)Math.Sqrt(Sq(N[e.a].x - N[e.b].x) + Sq(N[e.a].z - N[e.b].z));
                _adj[e.a].Add(new KeyValuePair<int, float>(e.b, d)); _adj[e.b].Add(new KeyValuePair<int, float>(e.a, d));
            }
        }
        static float Sq(float v) { return v * v; }

        /// <summary>Polyline in map units between two station codes, or null if either is off the network.</summary>
        public MapPoint[] Path(string from, string to)
        {
            string k = from + "|" + to; MapPoint[] p;
            if (_cache.TryGetValue(k, out p)) return p;
            int s = _db.RailNode(from), t = _db.RailNode(to);
            p = s < 0 || t < 0 ? null : Dijkstra(s, t);
            _cache[k] = p; return p;
        }
        public float Km(string from, string to)
        {
            var p = Path(from, to); if (p == null) return -1;
            double L = 0; for (int i = 1; i < p.Length; i++) L += Math.Sqrt(Sq(p[i].x - p[i - 1].x) + Sq(p[i].z - p[i - 1].z));
            return (float)(L * _db.network.unitKm);
        }

        MapPoint[] Dijkstra(int s, int t)
        {
            int n = _adj.Length; var D = new float[n]; var prev = new int[n]; var done = new bool[n];
            for (int i = 0; i < n; i++) { D[i] = float.PositiveInfinity; prev[i] = -1; }
            D[s] = 0;
            for (;;)   // the graph has a few hundred nodes, so a linear scan beats a heap here
            {
                int u = -1; float best = float.PositiveInfinity;
                for (int i = 0; i < n; i++) if (!done[i] && D[i] < best) { best = D[i]; u = i; }
                if (u < 0 || u == t) break; done[u] = true;
                foreach (var kv in _adj[u]) if (D[u] + kv.Value < D[kv.Key]) { D[kv.Key] = D[u] + kv.Value; prev[kv.Key] = u; }
            }
            if (float.IsInfinity(D[t])) return null;
            var path = new List<MapPoint>(); for (int v = t; v >= 0; v = prev[v]) path.Add(_db.network.railNodes[v]);
            path.Reverse(); return path.ToArray();
        }
    }
}
