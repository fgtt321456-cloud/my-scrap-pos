using System.Collections.Generic;
using ThaiRail.Game;
using ThaiRail.Scenery;
using ThaiRail.Simulation;
using ThaiRail.Trains;
using UnityEngine;

namespace ThaiRail.Stations
{
    /// <summary>
    /// Scene component for one timetable station: advances its simulation every frame and places the cars along
    /// the track paths (port of stnFrame / stnSync in railway/src/stations.js). The UI talks to <see cref="Adapter"/>.
    /// Cars come from the RollingStockCatalog + PoolManager when a catalog is set, otherwise from generated
    /// placeholder meshes, so a station runs before any train art exists.
    /// </summary>
    public sealed class TimetableStationRunner : MonoBehaviour, IStationView
    {
        [Tooltip("CMI, NKI, UBN, HDY or KRT")] public string stationId = "CMI";
        [Tooltip("Optional: real prefabs per model. Empty = generated placeholder cars")] public RollingStockCatalog catalog;
        [Tooltip("Material for generated cars (RailTrack/VertexColorLit). Empty = created from the bundled shader")] public Material placeholderMaterial;
        [Tooltip("Parent for spawned cars")] public Transform trainRoot;
        [Tooltip("Game seconds per real second at 1× (difficulty.json stationRate is the reference value 30)")] public float stationRate = 30;
        [Tooltip("Vehicle spacing along the track, metres (the web build uses 20 m cars)")] public float carPitch = 20;

        public TimetableStationSim Sim { get; private set; }
        public TimetableStationAdapter Adapter { get; private set; }
        IStationAdapter IStationView.Adapter { get { return Adapter; } }
        public bool Running { get { return Sim != null; } }
        public float Speed { get { return Sim != null ? Sim.State.speed : 0; } set { if (Sim != null) Sim.State.speed = value; } }
        public StationStatus Status()
        {
            var S = Sim.State; var st = new StationStatus { now = S.now, dep = S.stats.dep, onTime = S.stats.onTime, revenue = S.stats.rev };
            foreach (var s in S.services) { if (s.phase == ServicePhase.Entering || s.phase == ServicePhase.Dwell || s.phase == ServicePhase.Ready) st.inPlatform++; if (s.phase == ServicePhase.Held) st.held++; }
            foreach (var t in Sim.Def.tracks) if (Sim.HasPlatform(t)) st.platforms++;
            return st;
        }

        sealed class Live { public List<Transform> cars = new List<Transform>(); }
        readonly Dictionary<string, Live> _live = new Dictionary<string, Live>();
        readonly HashSet<string> _alive = new HashSet<string>();
        readonly List<string> _dead = new List<string>();
        ICarSource _cars;

        /// <summary>Start the station (called by StationSceneBootstrap, or from Start when placed by hand).</summary>
        public void Begin()
        {
            if (Sim != null) return;
            var W = RailTrackWorld.Instance;
            if (W == null || !W.Ready) { Debug.LogError("TimetableStationRunner needs a ready RailTrackWorld"); enabled = false; return; }
            Sim = W.Enter(stationId);
            Adapter = new TimetableStationAdapter(Sim, W.Db);
            if (trainRoot == null) trainRoot = transform;
            if (catalog != null && ThaiRail.Pooling.PoolManager.Instance != null) _cars = new PooledCarSource(catalog);
            else _cars = new ProceduralCarSource(W.Db, placeholderMaterial != null ? placeholderMaterial : new Material(Shader.Find("RailTrack/VertexColorLit") ?? Shader.Find("Standard")));
        }

        void Start() { if (RailTrackWorld.Instance != null && RailTrackWorld.Instance.Ready) Begin(); }

        void OnDestroy()
        {
            foreach (var kv in _live) ReleaseAll(kv.Value);
            _live.Clear();
            if (RailTrackWorld.Instance != null && Sim != null) RailTrackWorld.Instance.Leave(Sim);
        }

        void Update()
        {
            if (Sim == null) return;
            Sim.Advance(Mathf.Min(0.1f, Time.deltaTime), stationRate);
            SyncCars();
        }

        void SyncCars()
        {
            _alive.Clear();
            foreach (var s in Sim.State.services)
            {
                if (s.phase == ServicePhase.Sched || s.phase == ServicePhase.Gone) continue;
                _alive.Add(s.id);
                Live L;
                if (!_live.TryGetValue(s.id, out L))
                {
                    L = new Live(); _live[s.id] = L;
                    for (int i = 0; i < s.veh.Length; i++) L.cars.Add(_cars.Spawn(s.veh[i], s.id.GetHashCode() + i, trainRoot));
                }
                // trains still on the approach have no platform yet: drawn on the first track, as in the web build
                var P = Sim.CurrentPath(s);
                for (int i = 0; i < L.cars.Count; i++)
                {
                    var t = L.cars[i]; if (t == null) continue;
                    double fdx, fdz, bdx, bdz;
                    P3 f = P.At(s.s - i * carPitch - 1, out fdx, out fdz), b = P.At(s.s - i * carPitch - (carPitch - 1), out bdx, out bdz);
                    Vector3 uf = StationSceneBuilder.ToUnity(f), ub = StationSceneBuilder.ToUnity(b);
                    t.position = (uf + ub) * 0.5f;
                    float yaw = Mathf.Atan2(uf.x - ub.x, uf.z - ub.z) * Mathf.Rad2Deg;
                    bool flip = i > 0 && i == L.cars.Count - 1 && (catalog != null ? catalog.FlipWhenLast(s.veh[i]) : IsCab(s.veh[i]));
                    t.rotation = Quaternion.Euler(0, flip ? yaw + 180 : yaw, 0);
                }
            }
            _dead.Clear();
            foreach (var kv in _live) if (!_alive.Contains(kv.Key)) _dead.Add(kv.Key);
            foreach (var id in _dead) { ReleaseAll(_live[id]); _live.Remove(id); }
        }
        static bool IsCab(string m) { return m == "THN" || m == "NKF" || m == "APD" || m == "ASR" || m == "red"; }

        void ReleaseAll(Live L) { if (_cars != null) foreach (var c in L.cars) _cars.Release(c); L.cars.Clear(); }

        /// <summary>Centre of a service's consist in world space (camera follow), false when it is not on screen.</summary>
        public bool TryGetPosition(string serviceId, out Vector3 pos)
        {
            Live L; pos = Vector3.zero;
            if (serviceId == null || !_live.TryGetValue(serviceId, out L) || L.cars.Count == 0) return false;
            var t = L.cars[L.cars.Count / 2]; if (t == null) return false;
            pos = t.position; return true;
        }

        /// <summary>The train under a screen point (nearest car within <paramref name="radiusPx"/>), or null.</summary>
        public string Pick(Camera cam, Vector2 screen, float radiusPx = 40)
        {
            string best = null; float bd = radiusPx * radiusPx;
            foreach (var kv in _live) foreach (var t in kv.Value.cars)
            {
                if (t == null) continue;
                var sp = cam.WorldToScreenPoint(t.position + Vector3.up * 2.5f); if (sp.z < 0) continue;
                float dx = sp.x - screen.x, dy = sp.y - screen.y, d2 = dx * dx + dy * dy;
                if (d2 < bd) { bd = d2; best = kv.Key; }
            }
            return best;
        }
    }
}
