using System;
using System.Collections.Generic;
using ThaiRail.Data;
using UnityEngine;

namespace ThaiRail.Trains
{
    /// <summary>Raw model file (Resources/RailTrack/Trains/trains.json), exported from the web build by export_unity.js.</summary>
    [Serializable] public sealed class TrainModelsFile { public TrainModelData[] models; public LiveryFamily[] families; }
    /// <summary>One vehicle: non-indexed triangles in the web build's right-handed space, front at +z, rail head at y = 0.</summary>
    [Serializable] public sealed class TrainModelData { public string key, family; public float len; public float[] p, n, uv; }
    /// <summary>A livery family shares one atlas pair: atlas_{family}.png and atlas_{family}_em.png.</summary>
    [Serializable] public sealed class LiveryFamily { public string family; public float rough, metal; }

    /// <summary>
    /// The detailed SRT train models (same geometry and painted liveries as the web build's rolling_stock.js):
    /// one mesh per model key, one material per livery family, so a car is one draw call. Loaded lazily from
    /// Resources and converted to Unity's left-handed space (z mirrored, winding reversed, UVs unchanged: the
    /// conversion keeps the picture identical, side lettering included).
    /// </summary>
    public static class TrainLibrary
    {
        public const string Folder = "RailTrack/Trains/";
        static TrainModelsFile _file;
        static readonly Dictionary<string, TrainModelData> _byKey = new Dictionary<string, TrainModelData>();
        static readonly Dictionary<string, Mesh> _meshes = new Dictionary<string, Mesh>();
        static readonly Dictionary<string, Material> _mats = new Dictionary<string, Material>();
        static bool _tried;

        public static bool Available { get { Load(); return _file != null; } }

        static void Load()
        {
            if (_tried) return; _tried = true;
            var ta = Resources.Load<TextAsset>(Folder + "trains");
            if (ta == null) { Debug.LogWarning("RailTrack: Resources/" + Folder + "trains.json missing, using placeholder trains"); return; }
            Init(ta.text);
        }
        /// <summary>Parse step without Resources (tests, editor tools).</summary>
        public static void Init(string json)
        {
            _file = JsonUtility.FromJson<TrainModelsFile>(json); _byKey.Clear();
            foreach (var m in _file.models) _byKey[m.key] = m;
        }

        /// <summary>Model key for a vehicle id from the timetable sim ("HID", "THN_car", aliases such as "GEA").</summary>
        public static string Resolve(string vehicleId, RailTrackDatabase db)
        {
            Load(); if (_file == null) return null;
            if (_byKey.ContainsKey(vehicleId)) return vehicleId;
            if (db != null) foreach (var a in db.rollingStock.aliases) if (a.key == vehicleId && _byKey.ContainsKey(a.model)) return a.model;
            return _byKey.ContainsKey("coach") ? "coach" : null;
        }
        public static TrainModelData Data(string key) { Load(); TrainModelData d; return key != null && _byKey.TryGetValue(key, out d) ? d : null; }

        /// <summary>Unity-space arrays for a model (shared by the mesh builder and the checks).</summary>
        public static void ToLeftHanded(TrainModelData m, out Vector3[] verts, out Vector3[] norms, out Vector2[] uvs, out int[] tris)
        {
            int n = m.p.Length / 3; verts = new Vector3[n]; norms = new Vector3[n]; uvs = new Vector2[n]; tris = new int[n];
            for (int i = 0; i < n; i++)
            {
                verts[i] = new Vector3(m.p[i * 3], m.p[i * 3 + 1], -m.p[i * 3 + 2]);
                norms[i] = new Vector3(m.n[i * 3], m.n[i * 3 + 1], -m.n[i * 3 + 2]);
                uvs[i] = new Vector2(m.uv[i * 2], m.uv[i * 2 + 1]);
            }
            for (int t = 0; t + 2 < n; t += 3) { tris[t] = t; tris[t + 1] = t + 2; tris[t + 2] = t + 1; }
        }

        public static Mesh MeshFor(string key)
        {
            Mesh mesh; if (_meshes.TryGetValue(key, out mesh)) return mesh;
            var m = Data(key); if (m == null) return null;
            Vector3[] v, nn; Vector2[] uv; int[] t; ToLeftHanded(m, out v, out nn, out uv, out t);
            mesh = new Mesh { name = "SRT " + key, vertices = v, normals = nn, uv = uv, triangles = t };
            mesh.RecalculateBounds(); mesh.UploadMeshData(true);
            _meshes[key] = mesh; return mesh;
        }

        public static Material MaterialFor(string key)
        {
            var m = Data(key); if (m == null) return null;
            Material mat; if (_mats.TryGetValue(m.family, out mat)) return mat;
            LiveryFamily fam = null; foreach (var f in _file.families) if (f.family == m.family) fam = f;
            var shader = Shader.Find("RailTrack/Train") ?? Shader.Find("Standard");
            mat = new Material(shader) { name = "SRT livery " + m.family, enableInstancing = true };
            mat.SetTexture("_MainTex", Resources.Load<Texture2D>(Folder + "atlas_" + m.family));
            mat.SetTexture("_EmissionMap", Resources.Load<Texture2D>(Folder + "atlas_" + m.family + "_em"));
            if (fam != null) { mat.SetFloat("_Glossiness", 1 - fam.rough); mat.SetFloat("_Metallic", fam.metal); }
            _mats[m.family] = mat; return mat;
        }

        /// <summary>Window and lamp glow, 0 by day .. 1 at night (port of trainsNight()).</summary>
        public static void SetNight(float f) { Shader.SetGlobalFloat("_RailTrackNight", Mathf.Round(f * 20) / 20); }
        /// <summary>Night factor for an hour of the day, same curve as the web build's station frame.</summary>
        public static float NightFactor(float hour)
        {
            return hour < 5.8f || hour > 18.4f ? 1 : hour < 6.6f ? (6.6f - hour) / 0.8f : hour > 17.6f ? (hour - 17.6f) / 0.8f : 0;
        }
    }
}
