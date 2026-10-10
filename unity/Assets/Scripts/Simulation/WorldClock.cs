using System;
using System.Collections.Generic;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    /// <summary>
    /// Port of railway/src/world.js. One world time (seconds since day 0, 00:00) shared by the timetable stations
    /// and the network map. The active station drives it forward; a station left behind is caught up on entry.
    /// Hua Lamphong keeps its own clock (ordinary/commuter trains outside the long-distance timetable).
    /// </summary>
    [Serializable]
    public sealed class WorldClock
    {
        public double now = 6 * 3600;
        public int Day { get { return (int)Math.Floor(now / 86400.0); } }
        /// <summary>Called by the station that is on screen after each simulation step.</summary>
        public void Follow(double stationNow) { if (stationNow > now) now = stationNow; }
        /// <summary>Network map: advance at worldNetRate × game speed.</summary>
        public void Advance(double realSeconds, float rate, float speed) { now += realSeconds * rate * speed; }
    }

    /// <summary>
    /// Delays carried between player stations, keyed by train number + the day the run started.
    /// A real train leaving a station late writes here; stations further down its run read it two hours
    /// before the train is due and apply <see cref="Recover"/> (timetable slack).
    /// </summary>
    [Serializable]
    public sealed class DelayLedger
    {
        [Serializable] public struct Entry { public string key; public int minutes; public string at; public double t; }

        // List for JsonUtility (save games); the dictionary is the runtime index
        public List<Entry> entries = new List<Entry>();
        [NonSerialized] Dictionary<string, int> _index;

        public static string Key(string trainNo, int runDay) { return trainNo + "#" + runDay; }
        /// <summary>Start day of a run for an event on <paramref name="day"/> at second-of-day eventSec.</summary>
        public static int RunDay(int eventSec, int depSec, int day) { return eventSec >= depSec ? day : day - 1; }
        /// <summary>About 15% of an upstream delay plus 2 minutes is recovered before the next player station.</summary>
        public static int Recover(int minutes) { return Math.Max(0, (int)Clock.JsRound(minutes * 0.85 - 2)); }

        void Reindex() { _index = new Dictionary<string, int>(); for (int i = 0; i < entries.Count; i++) _index[entries[i].key] = i; }

        public void Put(string trainNo, int runDay, double lateMinutes, string stationId, double worldNow)
        {
            if (_index == null) Reindex();
            var e = new Entry { key = Key(trainNo, runDay), minutes = Math.Max(0, (int)Clock.JsRound(lateMinutes)), at = stationId, t = worldNow };
            int i; if (_index.TryGetValue(e.key, out i)) entries[i] = e; else { _index[e.key] = entries.Count; entries.Add(e); }
            // forget runs older than three days
            int before = entries.Count; entries.RemoveAll(x => x.t < worldNow - 3 * 86400); if (entries.Count != before) Reindex();
        }
        public bool TryGet(string trainNo, int runDay, out Entry e)
        {
            if (_index == null) Reindex();
            int i; if (_index.TryGetValue(Key(trainNo, runDay), out i)) { e = entries[i]; return true; }
            e = default(Entry); return false;
        }
    }
}
