using System;
using System.Collections.Generic;
using System.IO;
using ThaiRail.Data;
using ThaiRail.Simulation;
using ThaiRail.Simulation.Hlp;
using ThaiRail.Meta;
using UnityEngine;

namespace ThaiRail.Game
{
    /// <summary>
    /// Owns everything shared between the timetable stations: world clock, delay ledger, difficulty, rail graph,
    /// one TimetableStationSim per station, and the save file. Lives in the bootstrap scene (DontDestroyOnLoad).
    /// Money/XP/controllers are kept in a minimal wallet here until the meta layer (levels, shop) is ported.
    /// </summary>
    public sealed class RailTrackWorld : MonoBehaviour, IStationHost
    {
        public static RailTrackWorld Instance { get; private set; }

                [Tooltip("Debug: force controllers on regardless of the control room (app = approach ARS, dep = departure ARS, ground, shunt)")] public bool ctrlApp, ctrlDep, ctrlGround, ctrlShunt;
        public long money = 90000;
        public int xp;

        public WorldClock Clock { get; private set; }
        public DelayLedger Ledger { get; private set; }
        public Difficulty Difficulty { get; private set; }
        public RailGraph Graph { get; private set; }
        public RailTrackDatabase Db { get; private set; }
        /// <summary>Level, coins, rewards, daily gift and control-room controllers.</summary>
        public MetaService Meta { get; private set; }
        public event Action<string> Notified;

        readonly Dictionary<string, TimetableStationSim> _sims = new Dictionary<string, TimetableStationSim>();
        readonly System.Random _rng = new System.Random();
        TimetableStationSim _active;

        [Serializable]
        sealed class SaveFile
        {
            public int v = 1;
            public WorldClock clock;
            public DelayLedger ledger;
            public List<StationState> stations = new List<StationState>();
            public long money; public int xp;
            public bool hasHlp; public HlpState hlp;
            public MetaProfile meta;
        }
        static string SavePath { get { return Path.Combine(Application.persistentDataPath, "railtrack-stations-v1.json"); } }

        void Awake()
        {
            if (Instance != null && Instance != this) { gameObject.SetActive(false); return; }
            Instance = this;
            if (RailTrackDataLoader.Ready) Init(RailTrackDataLoader.Db); else RailTrackDataLoader.Loaded += Init;
        }

        void Init(RailTrackDatabase db)
        {
            RailTrackDataLoader.Loaded -= Init;
            Db = db; Graph = new RailGraph(db);
            Difficulty = new Difficulty(db.difficulty, _rng);
            Clock = new WorldClock(); Ledger = new DelayLedger();
            Load();
            Meta = new MetaService(db.progression, _savedMeta); Meta.Message += Notify;
        }

        public bool Ready { get { return Db != null; } }

        /// <summary>The station's simulation (created on first use, restored from the save if present).</summary>
        public TimetableStationSim Station(string id)
        {
            TimetableStationSim sim;
            if (_sims.TryGetValue(id, out sim)) return sim;
            var def = Db.Station(id); if (def == null) return null;
            StationState saved; _pending.TryGetValue(id, out saved);
            sim = new TimetableStationSim(def, Db, Graph, Difficulty, Clock, Ledger, this, _rng, saved);
            _sims[id] = sim; return sim;
        }

        /// <summary>Make a station the active one: it drives the world clock and catches up first.</summary>
        public TimetableStationSim Enter(string id)
        {
            if (_active != null) _active.IsActive = false;
            _active = Station(id); if (_active == null) return null;
            _active.Enter(); return _active;
        }
        /// <summary>Leave a station. Pass the sim so a late OnDestroy of the previous station cannot close the one just opened.</summary>
        public void Leave(TimetableStationSim sim = null)
        {
            if (sim != null && sim != _active) { sim.IsActive = false; Save(); return; }
            if (_active != null) _active.IsActive = false; _active = null; Save();
        }

        void Update()
        {
            if (!Ready) return;
            Difficulty.PlayerLevel = Meta.P.lv;
            // on the network map (no active station) the world clock runs on its own
            if (_active == null && mapOpen) Clock.Advance(Time.deltaTime, Db.difficulty.worldNetRate, mapSpeed);
        }
        [NonSerialized] public bool mapOpen;
        [NonSerialized] public float mapSpeed = 1;

        void OnApplicationPause(bool paused) { if (paused) Save(); }
        void OnApplicationQuit() { Save(); }

        // ---------- save / load ----------
        readonly Dictionary<string, StationState> _pending = new Dictionary<string, StationState>();
        HlpState _pendingHlp;
        MetaProfile _savedMeta;
        HlpEngine _hlp;

        /// <summary>Hua Lamphong's interlocking engine (its own clock: ordinary and commuter trains), restored from the save.</summary>
        public HlpEngine HuaLamphong()
        {
            if (_hlp == null && Db.hualamphongGraph != null)
                _hlp = new HlpEngine(Db.hualamphongGraph, Db.stations.hualamphong, Difficulty, this, _rng, _pendingHlp);
            return _hlp;
        }
        public void Save()
        {
            if (!Ready) return;
            var f = new SaveFile { clock = Clock, ledger = Ledger, money = money, xp = xp, meta = Meta != null ? Meta.P : _savedMeta };
            var h = _hlp != null ? _hlp.S : _pendingHlp; if (h != null) { f.hasHlp = true; f.hlp = h; }
            foreach (var kv in _sims) f.stations.Add(kv.Value.State);
            foreach (var kv in _pending) if (!_sims.ContainsKey(kv.Key)) f.stations.Add(kv.Value);
            try { File.WriteAllText(SavePath, JsonUtility.ToJson(f)); } catch (Exception e) { Debug.LogWarning("RailTrack save failed: " + e.Message); }
        }
        void Load()
        {
            try
            {
                if (!File.Exists(SavePath)) return;
                var f = JsonUtility.FromJson<SaveFile>(File.ReadAllText(SavePath));
                if (f == null || f.v != 1) return;
                if (f.clock != null) Clock = f.clock;
                if (f.ledger != null) Ledger = f.ledger;
                money = f.money; xp = f.xp;
                if (f.hasHlp) _pendingHlp = f.hlp;
                _savedMeta = f.meta;
                foreach (var s in f.stations) if (s != null && s.id != null) _pending[s.id] = s;
            }
            catch (Exception e) { Debug.LogWarning("RailTrack save unreadable, starting fresh: " + e.Message); }
        }

        // ---------- IStationHost ----------
        public bool ControllerOn(string key)
        {
            bool forced = key == "app" ? ctrlApp : key == "dep" ? ctrlDep : key == "ground" ? ctrlGround : key == "shunt" && ctrlShunt;
            return forced || (Meta != null && Meta.ControllerOn(key));
        }
        /// <summary>Pay from the station funds; false (nothing spent) when there is not enough.</summary>
        public bool Spend(int amount) { if (money < amount) return false; money -= amount; return true; }
        public void Earn(int amount, string account) { money += amount; }
        public void Pay(double amount, string account) { money -= (long)Math.Round(amount); }
        public void GainXP(int n) { xp += n; if (Meta != null) Meta.GainXP(n); }
        public void Notify(string text) { if (Notified != null) Notified(text); }
    }
}
