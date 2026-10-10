using System;
using System.Collections.Generic;

namespace ThaiRail.Simulation.Hlp
{
    // ---------- hualamphong.json (exported from hlp_engine.js by railway/tools/export_unity.js) ----------
    [Serializable]
    public sealed class HlpFile
    {
        public HlpNodeDef[] nodes;
        public HlpEdgeDef[] edges;
        public float[] platformsZ, trackZ;
        public HlpPhysics physics;
        public HlpResourceDef[] resources;
        public HlpOrigin[] origins;
        public HlpRegion[] regions;
        public string[] locoTypes, dmuTypes;
    }
    /// <summary>kind: buffer | switch | plain | diamond | slip | signal | end. pairs = the edge pairs a train can pass between,
    /// one pair per switch position (a slip has four).</summary>
    [Serializable] public sealed class HlpNodeDef { public string id, kind, label; public float x, z; public HlpPair[] pairs; }
    [Serializable] public sealed class HlpPair { public string a, b; }
    /// <summary>speed in m/s; rev = a train may reverse on it (shunting); track = platform track 1..14 or 0.</summary>
    [Serializable] public sealed class HlpEdgeDef { public string id, u, v, kind, label; public float len, speed; public bool rev; public int track; }
    [Serializable] public sealed class HlpPhysics { public float rate, carLen, throwT, acc, bCurve, bMax, shunt; }
    [Serializable] public sealed class HlpResourceDef { public string k, name; public int start, price, max; }
    [Serializable] public sealed class HlpOrigin { public string name, code; }
    [Serializable] public sealed class HlpRegion { public string code, region; }

    /// <summary>The track graph with integer indices (the engine never looks up strings in its inner loops).</summary>
    public sealed class HlpGraph
    {
        public sealed class Node { public int i; public string id, kind, label; public double x, z; public int[][] pairs; public int[] adj; }
        public sealed class Edge { public int i; public string id, kind, label; public int u, v, track; public double len, speed, ax, az, bx, bz; public bool rev; }

        public readonly Node[] nodes;
        public readonly Edge[] edges;
        public readonly HlpFile file;
        readonly Dictionary<string, int> _n = new Dictionary<string, int>(), _e = new Dictionary<string, int>();

        public HlpGraph(HlpFile f)
        {
            file = f;
            nodes = new Node[f.nodes.Length]; edges = new Edge[f.edges.Length];
            for (int i = 0; i < nodes.Length; i++) { var d = f.nodes[i]; nodes[i] = new Node { i = i, id = d.id, kind = d.kind, label = d.label, x = d.x, z = d.z }; _n[d.id] = i; }
            var adj = new List<int>[nodes.Length]; for (int i = 0; i < adj.Length; i++) adj[i] = new List<int>();
            for (int i = 0; i < edges.Length; i++)
            {
                var d = f.edges[i]; int u = _n[d.u], v = _n[d.v];
                edges[i] = new Edge { i = i, id = d.id, kind = d.kind, label = d.label, u = u, v = v, track = d.track, len = d.len, speed = d.speed, rev = d.rev,
                    ax = nodes[u].x, az = nodes[u].z, bx = nodes[v].x, bz = nodes[v].z };
                _e[d.id] = i; adj[u].Add(i); adj[v].Add(i);
            }
            for (int i = 0; i < nodes.Length; i++)
            {
                nodes[i].adj = adj[i].ToArray();
                var p = f.nodes[i].pairs ?? new HlpPair[0];
                nodes[i].pairs = new int[p.Length][];
                for (int k = 0; k < p.Length; k++) nodes[i].pairs[k] = new[] { _e[p[k].a], _e[p[k].b] };
            }
        }
        public int N(string id) { int i; return _n.TryGetValue(id, out i) ? i : -1; }
        public int E(string id) { int i; return _e.TryGetValue(id, out i) ? i : -1; }
        public bool IsSwitch(int node) { var k = nodes[node].kind; return k == "switch" || k == "slip"; }
    }

    // ---------- runtime state (all [Serializable] for save games) ----------
    /// <summary>One step of a path: an edge travelled in a direction; node/pi = the switch passed on entry and its position.</summary>
    [Serializable] public struct HlpStep { public int e, dir, node, pi; public HlpStep(int e, int dir, int node = -1, int pi = 0) { this.e = e; this.dir = dir; this.node = node; this.pi = pi; } }
    [Serializable] public struct HlpVeh { public string t; public int f; public HlpVeh(string t, int f) { this.t = t; this.f = f; } }

    public enum ConsistMode : byte { SB, FS, SH }   // ETCS: standby, full supervision, shunting
    public enum ConsistJob : byte { None, Approach, Arr, Dep, Leg1, Leg2, Leg3 }

    [Serializable]
    public sealed class HlpConsist
    {
        public string id, sid, routeId = "", couple = "";
        public List<HlpVeh> veh = new List<HlpVeh>();
        public double len, s, v, stopS, P, vlim;
        public List<HlpStep> steps = new List<HlpStep>();
        public bool moving;
        public ConsistMode mode;
        public ConsistJob job;
        public int @base;
        /// <summary>Speed-limit target the driver is braking for (DMI): kind "eoa" | "lim" | "obs", distance, speed.</summary>
        public string tgKind = ""; public double tgD, tgV;
        [NonSerialized] public double[] cum;
    }

    public enum TaskState : byte { Wait, Queue, Run, Done }
    [Serializable] public sealed class HlpTask { public string name, res = ""; public TaskState st; public double p, dur, q; }

    public enum RaState : byte { None, Detach, Leg1, Leg2, Leg3, Couple, Done }
    /// <summary>Run-around of a locomotive-hauled train: detach, run to the partner track's stub, back past the train, couple at the other end.</summary>
    [Serializable] public sealed class HlpRunAround { public RaState st; public double t, tryT; public string lid = "", rid = "", why = ""; public List<HlpStep> leg3 = new List<HlpStep>(); }

    public enum HlpPhase : byte { Sched, Approach, Held, Entering, Dwell, Departing }
    public enum HlpSvcState : byte { None, Work, Ready }

    [Serializable]
    public sealed class HlpService
    {
        public string id, name, outName, from, cid = "", ty = "";
        /// <summary>Locomotive-hauled (needs a run-around) or push-pull / DMU (driver changes ends).</summary>
        public bool lh;
        public double schedArr, schedDep, hold, arrAt, lag = -1;
        public HlpPhase phase;
        public HlpSvcState state;
        public int track, plan, prio, pax, paxOut, coaches, cars, lateIn;
        public bool special;
        public List<HlpTask> tasks = new List<HlpTask>();
        public HlpRunAround ra = new HlpRunAround();
        public HlpTask Task(string n) { foreach (var t in tasks) if (t.name == n) return t; return null; }
    }

    public enum RouteKind : byte { Arr, Dep, Shunt }
    [Serializable]
    public sealed class HlpRoute
    {
        public string id, from, cid = "";
        public RouteKind kind;
        public List<HlpStep> steps = new List<HlpStep>();
        public bool set, used;
        public int @base, track;
    }

    [Serializable] public sealed class HlpStats { public int arr, dep, onTime, rev; public double delayMin, holdMin; }
    [Serializable] public sealed class HlpRegionStat { public string region; public int n, up, down, done; }

    [Serializable]
    public sealed class HlpState
    {
        public int v = 1;
        public double now = 6.5 * 3600, t0 = 6.5 * 3600;
        public float speed = 1;
        public int nextId = 1;
        public bool arsArr, arsDep, hinted;
        /// <summary>Ground-service teams per resource, same order as hualamphong.json resources.</summary>
        public int[] res;
        public int[] nodePos;
        public double[] nodeMv;
        /// <summary>Route id holding each edge / node ("" = free): route locking.</summary>
        public string[] elock, nlock;
        public List<HlpRoute> routes = new List<HlpRoute>();
        public List<HlpConsist> consists = new List<HlpConsist>();
        public List<HlpService> services = new List<HlpService>();
        public List<StationLogEntry> log = new List<StationLogEntry>();
        public HlpStats stats = new HlpStats();
        public List<HlpRegionStat> rstat = new List<HlpRegionStat>();
        public double arsAt = -1, arsAcc;
    }
}
