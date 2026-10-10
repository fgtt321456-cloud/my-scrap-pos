using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    public enum StopMode { Originates, Terminates, Through }

    /// <summary>One real train calling at (or passing) a station on a given second of day.</summary>
    public struct TimetableEvent
    {
        public string name, trainNo, cls, other;
        public StopMode mode;
        public int timeOfDay, depOfRun;
        /// <summary>True when the time is estimated from rail distance (the PDF lists only the end points).</summary>
        public bool estimated;
        /// <summary>When hasDirection: running toward the station's east end. Otherwise derive it from StationDef.eastOf.</summary>
        public bool eastbound, hasDirection;
        /// <summary>False for the simulated local trains that fill gaps in the real timetable.</summary>
        public bool real;
    }

    /// <summary>
    /// Port of stnEvents() in railway/src/stations.js: which real timetable trains start, end or pass at a station.
    /// Passing times are interpolated by rail distance along the real network.
    /// </summary>
    public static class TimetableEvents
    {
        public static List<TimetableEvent> For(string stationId, RailTrackDatabase db, RailGraph graph)
        {
            var outList = new List<TimetableEvent>();
            foreach (var t in db.timetable.trains)
            {
                if (t.no == "45") continue;   // runs attached to train 37 out of Krung Thep Aphiwat
                int dep = t.DepSec, arr0 = Clock.ToSec(t.arr), arr = t.ArrSec;
                var e = new TimetableEvent { name = t.cls + " " + t.no + (t.no == "37" ? "/45" : ""), trainNo = t.no, cls = t.cls, depOfRun = dep, real = true };
                if (t.from == stationId) { e.mode = StopMode.Originates; e.timeOfDay = dep; e.other = t.to; outList.Add(e); }
                else if (t.to == stationId) { e.mode = StopMode.Terminates; e.timeOfDay = arr0; e.other = t.from; outList.Add(e); }
                else if (stationId == "NKI" && (t.to == "VTE" || t.from == "VTE"))
                {   // Nong Khai – Khamsavath shuttle crosses the bridge about 35 minutes from Nong Khai
                    bool toLaos = t.to == "VTE";
                    e.mode = StopMode.Through; e.estimated = true; e.eastbound = toLaos; e.hasDirection = true;
                    e.timeOfDay = ((toLaos ? arr - 2100 : dep + 2100) % Clock.Day + Clock.Day) % Clock.Day;
                    e.other = toLaos ? t.from : t.to; outList.Add(e);
                }
                else
                {
                    float a = graph.Km(t.from, stationId), b = graph.Km(stationId, t.to), c = graph.Km(t.from, t.to);
                    if (a > 0 && b > 0 && c > 0 && Math.Abs(a + b - c) < c * 0.03f)
                    {
                        e.mode = StopMode.Through; e.estimated = true; e.eastbound = true; e.hasDirection = true;
                        e.timeOfDay = (int)Clock.JsRound(dep + (arr - dep) * a / c) % Clock.Day;
                        e.other = db.PlaceName(t.from) + " → " + db.PlaceName(t.to); outList.Add(e);
                    }
                }
            }
            return outList;
        }
    }
}
