using System.Collections.Generic;
using ThaiRail.Game;
using ThaiRail.Pooling;
using ThaiRail.Simulation;
using ThaiRail.Trains;
using UnityEngine;

namespace ThaiRail.Stations
{
    /// <summary>
    /// Scene component for one timetable station: advances its simulation every frame and places the pooled cars
    /// along the track paths (port of stnFrame / stnSync in railway/src/stations.js). The station's static scene
    /// (tracks, platforms, building) is built separately from the same StationDef; 1 Unity unit = 1 m.
    /// The UI talks to <see cref="Adapter"/> only.
    /// </summary>
    public sealed class TimetableStationRunner : MonoBehaviour
    {
        [Tooltip("CMI, NKI, UBN, HDY or KRT")] public string stationId = "CMI";
        public RollingStockCatalog catalog;
        [Tooltip("Parent for spawned cars (the station root)")] public Transform trainRoot;
        [Tooltip("Game seconds per real second at 1× (difficulty.json stationRate is the reference value 30)")] public float stationRate = 30;
        [Tooltip("Vehicle spacing along the track, metres (the web build uses 20 m cars)")] public float carPitch = 20;

        public TimetableStationSim Sim { get; private set; }
        public TimetableStationAdapter Adapter { get; private set; }

        readonly Dictionary<string, List<PooledObject>> _cars = new Dictionary<string, List<PooledObject>>();
        readonly HashSet<string> _alive = new HashSet<string>();
        readonly List<string> _dead = new List<string>();

        void Start()
        {
            var W = RailTrackWorld.Instance;
            if (W == null || !W.Ready) { Debug.LogError("TimetableStationRunner needs a ready RailTrackWorld in the bootstrap scene"); enabled = false; return; }
            Sim = W.Enter(stationId);
            Adapter = new TimetableStationAdapter(Sim, W.Db);
            if (trainRoot == null) trainRoot = transform;
        }

        void OnDestroy()
        {
            foreach (var kv in _cars) ReleaseCars(kv.Value);
            _cars.Clear();
            if (RailTrackWorld.Instance != null && Sim != null) RailTrackWorld.Instance.Leave();
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
            var pool = PoolManager.Instance;
            foreach (var s in Sim.State.services)
            {
                if (s.phase == ServicePhase.Sched || s.phase == ServicePhase.Gone) continue;
                _alive.Add(s.id);
                List<PooledObject> cars;
                if (!_cars.TryGetValue(s.id, out cars))
                {
                    cars = new List<PooledObject>(s.veh.Length);
                    for (int i = 0; i < s.veh.Length; i++) cars.Add(pool.Spawn(catalog.PoolFor(s.veh[i]), Vector3.zero, Quaternion.identity, trainRoot));
                    _cars[s.id] = cars;
                }
                // trains still on the approach have no platform yet: draw them on the first track, as the web build does
                var P = Sim.CurrentPath(s);
                for (int i = 0; i < cars.Count; i++)
                {
                    if (cars[i] == null) continue;
                    double fdx, fdz, bdx, bdz;
                    P3 f = P.At(s.s - i * carPitch - 1, out fdx, out fdz), b = P.At(s.s - i * carPitch - (carPitch - 1), out bdx, out bdz);
                    var t = cars[i].transform;
                    t.position = new Vector3((float)((f.x + b.x) / 2), (float)((f.y + b.y) / 2), (float)((f.z + b.z) / 2));
                    float yaw = (float)(System.Math.Atan2(f.x - b.x, f.z - b.z) * 180 / System.Math.PI);
                    if (i > 0 && i == cars.Count - 1 && catalog.FlipWhenLast(s.veh[i])) yaw += 180;
                    t.rotation = Quaternion.Euler(0, yaw, 0);
                }
            }
            _dead.Clear();
            foreach (var kv in _cars) if (!_alive.Contains(kv.Key)) _dead.Add(kv.Key);
            foreach (var id in _dead) { ReleaseCars(_cars[id]); _cars.Remove(id); }
        }

        static void ReleaseCars(List<PooledObject> cars)
        {
            var pool = PoolManager.Instance; if (pool == null) return;
            foreach (var c in cars) if (c != null) pool.Release(c);
        }
    }
}
