using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    /// <summary>One real timetable train on the Thailand map at a world time.</summary>
    public struct RunningTrain
    {
        public TimetableTrain t;
        public int runDay, delay;
        /// <summary>Share of the run done (0..1), map position and travel direction (map units).</summary>
        public double f, x, z, tx, tz;
    }

    /// <summary>
    /// Which real SRT trains are on the line at a world time and where, along the real rail network, with the delay
    /// carried by the ledger. Port of ttRunning / ttAt in railway/src/world.js.
    /// </summary>
    public static class TimetableTrains
    {
        public static List<RunningTrain> Running(double now, RailTrackDatabase db, RailGraph graph, DelayLedger ledger)
        {
            var outList = new List<RunningTrain>();
            int day = (int)Math.Floor(now / Clock.Day);
            foreach (var t in db.timetable.trains)
            {
                if (t.no == "45") continue;   // runs attached to train 37
                var P = graph.Path(t.from, t.to); if (P == null || P.Length < 2) continue;
                int dep = t.DepSec, arr = t.ArrSec;
                for (int dday = day - 1; dday <= day; dday++)
                {
                    DelayLedger.Entry L; int delay = ledger != null && ledger.TryGet(t.no, dday, out L) ? DelayLedger.Recover(L.minutes) : 0;
                    double start = (double)dday * Clock.Day + dep + delay * 60, end = (double)dday * Clock.Day + arr + delay * 60;
                    if (now < start || now > end) continue;
                    double f = (now - start) / (end - start), x, z, tx, tz;
                    At(P, f, out x, out z, out tx, out tz);
                    outList.Add(new RunningTrain { t = t, runDay = dday, delay = delay, f = f, x = x, z = z, tx = tx, tz = tz });
                }
            }
            return outList;
        }

        /// <summary>Point at share f of a polyline (same stepping as ttAt).</summary>
        public static void At(MapPoint[] P, double f, out double x, out double z, out double tx, out double tz)
        {
            var cum = new double[P.Length];
            for (int k = 1; k < P.Length; k++) cum[k] = cum[k - 1] + Math.Sqrt((P[k].x - P[k - 1].x) * (double)(P[k].x - P[k - 1].x) + (P[k].z - P[k - 1].z) * (double)(P[k].z - P[k - 1].z));
            double s = Math.Max(0, Math.Min(1, f)) * cum[cum.Length - 1]; int i = 0;
            while (i < cum.Length - 2 && cum[i + 1] < s) i++;
            MapPoint a = P[i], b = P[i + 1]; double seg = cum[i + 1] - cum[i], u = (s - cum[i]) / (seg == 0 ? 1 : seg);
            x = a.x + (b.x - a.x) * u; z = a.z + (b.z - a.z) * u; tx = b.x - a.x; tz = b.z - a.z;
        }
    }
}
