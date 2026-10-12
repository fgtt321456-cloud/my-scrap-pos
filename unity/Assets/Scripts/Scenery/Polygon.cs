using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Scenery
{
    /// <summary>Ear-clipping triangulation for simple polygons (country outlines on the map). Works for either winding.</summary>
    public static class Polygon
    {
        public static double SignedArea(IList<MapPoint> p)
        {
            double a = 0; for (int i = 0, j = p.Count - 1; i < p.Count; j = i++) a += (double)p[j].x * p[i].z - (double)p[i].x * p[j].z;
            return a / 2;
        }

        /// <summary>Triangle indices into <paramref name="p"/> (last point may repeat the first; it is ignored).</summary>
        public static List<int> Triangulate(IList<MapPoint> p)
        {
            var tris = new List<int>();
            int n = p.Count; if (n > 3 && p[0].x == p[n - 1].x && p[0].z == p[n - 1].z) n--;
            if (n < 3) return tris;
            var V = new List<int>(n); for (int i = 0; i < n; i++) V.Add(i);
            bool ccw = SignedArea(p) > 0;
            int guard = 0;
            while (V.Count > 3 && guard++ < n * n)
            {
                bool clipped = false;
                for (int k = 0; k < V.Count; k++)
                {
                    int a = V[(k + V.Count - 1) % V.Count], b = V[k], c = V[(k + 1) % V.Count];
                    double cross = Cross(p[a], p[b], p[c]);
                    if (Math.Abs(cross) < 1e-12) { V.RemoveAt(k); clipped = true; break; }   // collinear: drop the middle point
                    if ((cross > 0) != ccw) continue;                                         // reflex corner
                    bool inside = false;
                    for (int m = 0; m < V.Count && !inside; m++)
                    {
                        int q = V[m]; if (q == a || q == b || q == c) continue;
                        inside = InTri(p[q], p[a], p[b], p[c]);
                    }
                    if (inside) continue;
                    tris.Add(a); tris.Add(b); tris.Add(c); V.RemoveAt(k); clipped = true; break;
                }
                if (!clipped) break;   // self-touching outline: fan the rest rather than loop forever
            }
            for (int k = 1; k + 1 < V.Count; k++) { tris.Add(V[0]); tris.Add(V[k]); tris.Add(V[k + 1]); }
            return tris;
        }
        static double Cross(MapPoint a, MapPoint b, MapPoint c) { return ((double)b.x - a.x) * ((double)c.z - a.z) - ((double)b.z - a.z) * ((double)c.x - a.x); }
        static bool InTri(MapPoint p, MapPoint a, MapPoint b, MapPoint c)
        {
            double d1 = Cross(a, b, p), d2 = Cross(b, c, p), d3 = Cross(c, a, p);
            bool neg = d1 < 0 || d2 < 0 || d3 < 0, pos = d1 > 0 || d2 > 0 || d3 > 0;
            return !(neg && pos);
        }
    }
}
