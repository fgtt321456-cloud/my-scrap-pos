using System;
using System.Collections.Generic;

namespace ThaiRail.Simulation
{
    public enum ServicePhase : byte { Sched, Approach, Held, Entering, Dwell, Ready, Departing, Gone }

    /// <summary>
    /// One train at one timetable station on one day (port of the service objects made by stnMakeSvc).
    /// [Serializable] with plain fields so a save game can store it through JsonUtility.
    /// Times are world seconds; distances metres along the train's current path.
    /// </summary>
    [Serializable]
    public sealed class StationService
    {
        public string id, name, cls, other, label;
        /// <summary>Real timetable train number ("" for simulated locals) and the day its run started.</summary>
        public string no = "";
        public int runDay;
        public bool real, estimated, lift;
        public StopMode mode;
        /// <summary>Locomotive-hauled (true) or push-pull/DMU (false).</summary>
        public bool locoHauled;
        /// <summary>Model ids, head first (see rolling_stock.json; "dmu_car" style ids resolve through aliases).</summary>
        public string[] veh;
        public int rev;
        /// <summary>End of the station the train enters from.</summary>
        public Side side;
        public ServicePhase phase;
        public int track;
        public double s, v, hold;
        public double schedArr, schedDep;

        // delay / difficulty
        public bool delayResolved;
        public int inDelay;
        public string delaySrc = "";
        public string fault = "";
        public double arsAt;
        public double depLag = -1;

        // runtime bookkeeping
        public bool holdsLock;
        public Side lockSide;
        public double arrAt = -1, readyAt, goneAt, clearS;
        /// <summary>Departing along the reversed track path (terminus: the train backs out the way it came).</summary>
        public bool departReversed;

        public double Eta { get { return schedArr + inDelay * 60; } }
        public int Length { get { return veh.Length * 20; } }
        /// <summary>Consist length class 0..3 (A ≤4 vehicles, B ≤6, C ≤9, D 10+).</summary>
        public int SizeClass { get { int n = veh.Length; return n <= 4 ? 0 : n <= 6 ? 1 : n <= 9 ? 2 : 3; } }
        public bool InPlatform { get { return phase == ServicePhase.Entering || phase == ServicePhase.Dwell || phase == ServicePhase.Ready || phase == ServicePhase.Departing; } }
    }

    [Serializable] public sealed class StationStats { public int dep, onTime, rev; public double holdMin; }
    public enum LogTone : byte { Neutral, Good, Bad }
    [Serializable] public struct StationLogEntry { public string time, text; public LogTone tone; }

    /// <summary>Saved state of one timetable station (port of stnNew()).</summary>
    [Serializable]
    public sealed class StationState
    {
        public int v = 1;
        public string id;
        public double now = 6 * 3600;
        public float speed = 1;
        public int nextId = 1, crew = 3, genDay = -1;
        public List<StationService> services = new List<StationService>();
        public double lockE, lockW;
        public StationStats stats = new StationStats();
        public List<StationLogEntry> log = new List<StationLogEntry>();
        public bool hinted;
    }

    /// <summary>What the station sim needs from the rest of the game (money, XP, purchased controllers).</summary>
    public interface IStationHost
    {
        /// <summary>"app" approach ARS, "dep" departure ARS, "ground" faster ground crews.</summary>
        bool ControllerOn(string key);
        void Earn(int amount, string account);
        void Pay(double amount, string account);
        void GainXP(int xp);
        /// <summary>Player-facing short message (toast).</summary>
        void Notify(string text);
    }
}
