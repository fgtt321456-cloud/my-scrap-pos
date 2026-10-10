using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    /// <summary>Plain 3D point so the simulation stays free of UnityEngine (convert to Vector3 in the view layer).</summary>
    [Serializable] public struct P3 { public double x, y, z; public P3(double x, double y, double z) { this.x = x; this.y = y; this.z = z; } }

    /// <summary>
    /// Polyline with cumulative distance. Port of mkPath / pAtS / sOfX / revPath in railway/src/stations.js.
    /// Distances are metres; s = 0 is the far end of the approach the train enters from.
    /// </summary>
    public sealed class TrackPath
    {
        public readonly P3[] pts;
        public readonly double[] cum;
        public double Len { get { return cum[cum.Length - 1]; } }

        public TrackPath(P3[] points)
        {
            pts = points; cum = new double[points.Length];
            for (int i = 1; i < points.Length; i++)
            {
                double dx = points[i].x - points[i - 1].x, dy = points[i].y - points[i - 1].y, dz = points[i].z - points[i - 1].z;
                cum[i] = cum[i - 1] + Math.Sqrt(dx * dx + dy * dy + dz * dz);
            }
        }
        public TrackPath Reversed() { var r = (P3[])pts.Clone(); Array.Reverse(r); return new TrackPath(r); }

        /// <summary>Position and unit direction (dirX, dirZ) at distance s along the path (clamped).</summary>
        public P3 At(double s, out double dirX, out double dirZ)
        {
            s = Math.Max(0, Math.Min(Len, s));
            int lo = 0, hi = cum.Length - 2;
            while (lo < hi) { int mid = (lo + hi + 1) >> 1; if (cum[mid] <= s) lo = mid; else hi = mid - 1; }
            P3 a = pts[lo], b = pts[lo + 1]; double seg = cum[lo + 1] - cum[lo]; if (seg == 0) seg = 1e-6;
            double t = (s - cum[lo]) / seg;
            dirX = (b.x - a.x) / seg; dirZ = (b.z - a.z) / seg;
            return new P3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
        }

        /// <summary>Distance along the path where it crosses x on the straight at depth z, or -1 if it never does.</summary>
        public double SOfX(double x, double z)
        {
            for (int i = 0; i < pts.Length - 1; i++)
            {
                P3 a = pts[i], b = pts[i + 1];
                if (Math.Abs(a.z - z) < 0.01 && Math.Abs(b.z - z) < 0.01 && (x - a.x) * (x - b.x) <= 0) return cum[i] + Math.Abs(x - a.x);
            }
            return -1;
        }
    }

    /// <summary>
    /// Every track of one station as a full path from the east approach (+x) through the platform to the buffer
    /// (terminus) or on to the west approach (through station), plus where trains stop. Port of stnTrackPath/stnStopS.
    /// </summary>
    public sealed class StationGeometry
    {
        /// <summary>Approach length beyond the platform ends and where the throat curves start.</summary>
        public const double Far = 900, Throat = 170;
        /// <summary>Distance from the far end of the approach to the home signal.</summary>
        public const double HomeS = Far - 210;

        readonly StationDef _d;
        readonly Dictionary<int, TrackPath> _east = new Dictionary<int, TrackPath>(), _west = new Dictionary<int, TrackPath>();

        public StationGeometry(StationDef d)
        {
            _d = d;
            foreach (var t in d.tracks) { var P = Build(d, t); _east[t.n] = P; _west[t.n] = P.Reversed(); }
        }
        public StationDef Def { get { return _d; } }

        static double MainZ(StationDef d)
        {
            double sum = 0; int n = 0; foreach (var t in d.tracks) if (!t.siding) { sum += t.z; n++; }
            return n > 0 ? sum / n : 0;
        }
        static TrackPath Build(StationDef d, TrackDef t)
        {
            double y = d.deck, zm = MainZ(d);
            var pts = new List<P3>();
            Action<double, double, double, double> curve = (x0, x1, z0, z1) =>
            {
                for (int i = 1; i < 16; i++) { double u = i / 16.0, k = u * u * (3 - 2 * u); pts.Add(new P3(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * k)); }
            };
            pts.Add(new P3(d.P1 + Far, y, zm)); pts.Add(new P3(d.P1 + Throat, y, zm));
            curve(d.P1 + Throat, d.P1 + 25, zm, t.z); pts.Add(new P3(d.P1 + 25, y, t.z));
            if (d.IsTerminus) pts.Add(new P3(d.P0 + 1, y, t.z));
            else
            {
                pts.Add(new P3(d.P0 - 25, y, t.z)); curve(d.P0 - 25, d.P0 - Throat, t.z, zm);
                pts.Add(new P3(d.P0 - Throat, y, zm)); pts.Add(new P3(d.P0 - Far, y, zm));
            }
            return new TrackPath(pts.ToArray());
        }

        TrackDef Track(int n) { foreach (var t in _d.tracks) if (t.n == n) return t; return _d.tracks[0]; }
        int TrackN(int n) { return Track(n).n; }

        /// <summary>Path a train entering from <paramref name="side"/> follows on track n (unknown n → first track).</summary>
        public TrackPath PathFor(int track, Side side) { int n = TrackN(track); return side == Side.East ? _east[n] : _west[n]; }
        public TrackPath ReversedPathFor(int track, Side side) { int n = TrackN(track); return side == Side.East ? _west[n] : _east[n]; }

        /// <summary>Where the head stops: near the buffer at a terminus, else at the far platform end for the direction.</summary>
        public double StopS(int track, Side side)
        {
            var t = Track(track); var P = PathFor(track, side);
            double x = _d.IsTerminus ? _d.P0 + 3 : side == Side.East ? _d.P0 + 8 : _d.P1 - 8;
            double s = P.SOfX(x, t.z);
            return s > 0 ? s : P.Len * 0.5;   // JS: sOfX(...) || len/2 (0 also falls back)
        }
    }

    public enum Side : byte { East, West }
}
