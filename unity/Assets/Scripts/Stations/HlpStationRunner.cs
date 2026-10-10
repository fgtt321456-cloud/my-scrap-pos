using System.Collections.Generic;
using System.Text;
using ThaiRail.Game;
using ThaiRail.Scenery;
using ThaiRail.Simulation.Hlp;
using ThaiRail.Trains;
using UnityEngine;

namespace ThaiRail.Stations
{
    /// <summary>
    /// Scene component for Hua Lamphong: advances the interlocking engine, places every consist's cars along its
    /// path (port of tSyncMeshes), lights the signals by aspect (H: red/yellow/green, S1–S14: red/green) and shows the
    /// route a platform choice would take while the platform sheet is open. The UI talks to <see cref="Adapter"/>.
    /// </summary>
    public sealed class HlpStationRunner : MonoBehaviour, IStationView
    {
        [Tooltip("Optional: real prefabs per model. Empty = the built-in SRT models")] public RollingStockCatalog catalog;
        public Material placeholderMaterial;
        public Transform trainRoot;

        public HlpEngine Engine { get; private set; }
        public HuaLamphongAdapter Adapter { get; private set; }
        IStationAdapter IStationView.Adapter { get { return Adapter; } }
        public bool Running { get { return Engine != null; } }
        public float Speed { get { return Engine != null ? Engine.S.speed : 0; } set { if (Engine != null) Engine.S.speed = value; } }

        sealed class Live { public string sig; public List<Transform> cars = new List<Transform>(); }
        readonly Dictionary<string, Live> _live = new Dictionary<string, Live>();
        readonly HashSet<string> _alive = new HashSet<string>();
        readonly List<string> _dead = new List<string>();
        readonly StringBuilder _sb = new StringBuilder();
        ICarSource _cars;

        struct Lamp { public string id; public MeshRenderer r, y, g; }
        readonly List<Lamp> _lamps = new List<Lamp>();
        Material _off, _red, _yellow, _green;
        GameObject _preview;

        public void Begin(IList<SignalLamps> signals)
        {
            if (Engine != null) return;
            var W = RailTrackWorld.Instance;
            Engine = W != null && W.Ready ? W.HuaLamphong() : null;
            if (Engine == null) { Debug.LogError("HlpStationRunner needs a ready RailTrackWorld and hualamphong.json"); enabled = false; return; }
            Adapter = new HuaLamphongAdapter(Engine);
            Adapter.PreviewChanged += ShowPreview;
            if (trainRoot == null) trainRoot = transform;
            _cars = CarSourceFactory.Create(catalog, W.Db, placeholderMaterial);
            BuildLamps(signals);
        }

        void OnDestroy()
        {
            foreach (var kv in _live) Release(kv.Value);
            _live.Clear();
            if (RailTrackWorld.Instance != null) RailTrackWorld.Instance.Save();
        }

        void Update()
        {
            if (Engine == null) return;
            var W = RailTrackWorld.Instance;   // purchased controllers switch the ARS on, as metaTick does in the web build
            if (W != null) { Engine.S.arsArr = W.ControllerOn("app"); Engine.S.arsDep = W.ControllerOn("dep"); }
            Engine.Advance(Mathf.Min(0.1f, Time.deltaTime));
            SyncCars(); SyncLamps();
        }

        void SyncCars()
        {
            _alive.Clear();
            float VL = Engine.G.file.physics.carLen;
            foreach (var c in Engine.S.consists)
            {
                _alive.Add(c.id);
                _sb.Length = 0; foreach (var v in c.veh) _sb.Append(v.t).Append(',');
                string sig = _sb.ToString();
                Live L;
                if (!_live.TryGetValue(c.id, out L) || L.sig != sig)
                {
                    if (L != null) Release(L);
                    L = new Live { sig = sig }; _live[c.id] = L;
                    for (int i = 0; i < c.veh.Count; i++) L.cars.Add(_cars.Spawn(c.veh[i].t, c.id.GetHashCode() + i, trainRoot));
                }
                for (int i = 0; i < c.veh.Count && i < L.cars.Count; i++)
                {
                    var t = L.cars[i]; if (t == null) continue;
                    double fx, fz, bx, bz, d1, d2;
                    Engine.At(c, c.s - i * VL - 3, out fx, out fz, out d1, out d2);
                    Engine.At(c, c.s - i * VL - VL + 3, out bx, out bz, out d1, out d2);
                    Vector3 uf = StationSceneBuilder.ToUnity(fx, 0, fz), ub = StationSceneBuilder.ToUnity(bx, 0, bz);
                    t.position = (uf + ub) * 0.5f;
                    float yaw = Mathf.Atan2(uf.x - ub.x, uf.z - ub.z) * Mathf.Rad2Deg;
                    t.rotation = Quaternion.Euler(0, c.veh[i].f < 0 ? yaw + 180 : yaw, 0);
                }
            }
            _dead.Clear();
            foreach (var kv in _live) if (!_alive.Contains(kv.Key)) _dead.Add(kv.Key);
            foreach (var id in _dead) { Release(_live[id]); _live.Remove(id); }
        }
        void Release(Live L) { if (_cars != null) foreach (var c in L.cars) _cars.Release(c); L.cars.Clear(); }

        // ---------- signals ----------
        static Material Unlit(Color c)
        {
            // Unlit/Color may be stripped from a player build; the bundled vertex-colour shader (white lamp mesh × _Tint) is always there
            var m = new Material(Shader.Find(RailTrackShaders.Urp ? "Universal Render Pipeline/Unlit" : "Unlit/Color") ?? RailTrackShaders.Find("VertexColorLit")); m.color = c; m.SetColor("_Tint", c); m.SetColor("_BaseColor", c); return m;
        }
        void BuildLamps(IList<SignalLamps> signals)
        {
            if (signals == null) return;
            _off = Unlit(new Color(0.16f, 0.18f, 0.2f)); _red = Unlit(new Color(1f, 0.2f, 0.18f)); _yellow = Unlit(new Color(1f, 0.78f, 0.1f)); _green = Unlit(new Color(0.2f, 0.95f, 0.45f));
            var mesh = SphereMesh();
            var root = new GameObject("Signal lamps").transform; root.SetParent(transform, false);
            foreach (var s in signals)
            {
                var L = new Lamp { id = s.id, r = LampAt(root, mesh, s.red), g = LampAt(root, mesh, s.green) };
                if (s.hasYellow) L.y = LampAt(root, mesh, s.yellow);
                _lamps.Add(L);
            }
        }
        MeshRenderer LampAt(Transform root, Mesh mesh, V3 p)
        {
            var go = new GameObject("Lamp"); go.transform.SetParent(root, false); go.transform.position = StationSceneBuilder.ToUnity(p);
            go.AddComponent<MeshFilter>().sharedMesh = mesh; var r = go.AddComponent<MeshRenderer>(); r.sharedMaterial = _off; return r;
        }
        static Mesh SphereMesh()
        {
            var d = new MeshData(); d.Blob(new V3(0, 0, 0), 0.3, 0.3, 0.3, new Rgba(0xffffff), 10, 6);
            float[] p, n; int[] t; d.ToLeftHanded(out p, out n, out t);
            var v = new Vector3[p.Length / 3]; var nn = new Vector3[v.Length];
            for (int i = 0; i < v.Length; i++) { v[i] = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); nn[i] = new Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]); }
            var m = new Mesh { name = "Signal lamp", vertices = v, normals = nn, triangles = t }; m.RecalculateBounds(); return m;
        }
        void SyncLamps()
        {
            foreach (var L in _lamps)
            {
                string a = Engine.SigAspect(L.id);
                L.r.sharedMaterial = a == "red" ? _red : _off;
                L.g.sharedMaterial = a == "green" ? _green : _off;
                if (L.y != null) L.y.sharedMaterial = a == "yellow" ? _yellow : _off;
            }
        }

        // ---------- route preview while choosing a platform ----------
        void ShowPreview(HashSet<int> edges)
        {
            if (_preview != null) { Destroy(_preview); _preview = null; }
            if (edges == null || edges.Count == 0) return;
            var d = new MeshData(); var col = new Rgba(0xFFC20E, 0.75f);
            foreach (int ei in edges)
            {
                var e = Engine.G.edges[ei];
                d.TopQuad(new V3((e.ax + e.bx) / 2, 0.62, (e.az + e.bz) / 2), 1.6, e.len, col, System.Math.Atan2(e.bx - e.ax, e.bz - e.az));
            }
            float[] p, n; int[] t; d.ToLeftHanded(out p, out n, out t);
            var v = new Vector3[p.Length / 3]; var nn = new Vector3[v.Length];
            for (int i = 0; i < v.Length; i++) { v[i] = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); nn[i] = new Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]); }
            _preview = new GameObject("Route preview"); _preview.transform.SetParent(transform, false);
            _preview.AddComponent<MeshFilter>().sharedMesh = new Mesh { name = "Route preview", vertices = v, normals = nn, triangles = t };
            _preview.AddComponent<MeshRenderer>().sharedMaterial = _yellow;
        }

        // ---------- IStationView ----------
        public StationStatus Status()
        {
            var S = Engine.S; var st = new StationStatus { now = S.now, dep = S.stats.dep, onTime = S.stats.onTime, revenue = S.stats.rev, platforms = 14 };
            foreach (var s in S.services) { if (s.phase == HlpPhase.Entering || s.phase == HlpPhase.Dwell) st.inPlatform++; if (s.phase == HlpPhase.Held) st.held++; }
            return st;
        }
        public string Pick(Camera cam, Vector2 screen, float radiusPx = 40)
        {
            string best = null; float bd = radiusPx * radiusPx;
            foreach (var kv in _live) foreach (var t in kv.Value.cars)
            {
                if (t == null) continue;
                var sp = cam.WorldToScreenPoint(t.position + Vector3.up * 2.5f); if (sp.z < 0) continue;
                float dx = sp.x - screen.x, dy = sp.y - screen.y, d2 = dx * dx + dy * dy;
                if (d2 < bd) { var c = Engine.Cons(kv.Key); if (c != null && Engine.Svc(c.sid) != null) { bd = d2; best = c.sid; } }
            }
            return best;
        }
        public bool TryGetPosition(string serviceId, out Vector3 pos)
        {
            pos = Vector3.zero; var svc = Engine.Svc(serviceId); if (svc == null) return false;
            // while running round, follow the locomotive
            string cid = svc.lh && svc.ra.lid != "" && svc.ra.st != RaState.Done && svc.ra.st != RaState.Detach ? svc.ra.lid : svc.cid;
            Live L; if (!_live.TryGetValue(cid, out L) && !_live.TryGetValue(svc.cid, out L)) return false;
            if (L.cars.Count == 0 || L.cars[L.cars.Count / 2] == null) return false;
            pos = L.cars[L.cars.Count / 2].position; return true;
        }
    }
}
