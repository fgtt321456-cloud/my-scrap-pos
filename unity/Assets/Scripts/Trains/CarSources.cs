using System.Collections.Generic;
using ThaiRail.Data;
using ThaiRail.Pooling;
using ThaiRail.Scenery;
using UnityEngine;

namespace ThaiRail.Trains
{
    /// <summary>Where a station runner gets car GameObjects from.</summary>
    public interface ICarSource
    {
        Transform Spawn(string modelId, int variant, Transform parent);
        void Release(Transform car);
    }

    /// <summary>Real prefabs through the PoolManager, chosen by the RollingStockCatalog.</summary>
    public sealed class PooledCarSource : ICarSource
    {
        readonly RollingStockCatalog _catalog;
        readonly Dictionary<Transform, PooledObject> _live = new Dictionary<Transform, PooledObject>();
        public PooledCarSource(RollingStockCatalog catalog) { _catalog = catalog; }
        public Transform Spawn(string modelId, int variant, Transform parent)
        {
            var o = PoolManager.Instance.Spawn(_catalog.PoolFor(modelId), Vector3.zero, Quaternion.identity, parent);
            if (o == null) return null;
            _live[o.transform] = o; return o.transform;
        }
        public void Release(Transform car)
        {
            PooledObject o; if (car == null || !_live.TryGetValue(car, out o)) return;
            _live.Remove(car); PoolManager.Instance.Release(o);
        }
    }

    /// <summary>
    /// Placeholder cars generated from rolling_stock.json (TrainMeshModel): one shared mesh per model, GameObjects
    /// recycled through a small free list. Lets a station run with no art assigned at all.
    /// </summary>
    public sealed class ProceduralCarSource : ICarSource
    {
        readonly RailTrackDatabase _db;
        readonly Material _mat;
        readonly Dictionary<string, Mesh> _meshes = new Dictionary<string, Mesh>();
        readonly Dictionary<string, Stack<Transform>> _free = new Dictionary<string, Stack<Transform>>();
        readonly Dictionary<Transform, string> _key = new Dictionary<Transform, string>();

        public ProceduralCarSource(RailTrackDatabase db, Material mat) { _db = db; _mat = mat; }

        Mesh MeshFor(string key, string modelId, int variant)
        {
            Mesh m; if (_meshes.TryGetValue(key, out m)) return m;
            var data = TrainMeshModel.Build(_db.Model(modelId) ?? _db.Model("coach"), variant);
            float[] p, n; int[] t; data.ToLeftHanded(out p, out n, out t);
            int vc = p.Length / 3; var v = new Vector3[vc]; var nn = new Vector3[vc]; var c = new Color32[vc];
            for (int i = 0; i < vc; i++)
            {
                v[i] = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); nn[i] = new Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
                c[i] = new Color32((byte)(data.col[i * 4] * 255), (byte)(data.col[i * 4 + 1] * 255), (byte)(data.col[i * 4 + 2] * 255), 255);
            }
            m = new Mesh { name = key, vertices = v, normals = nn, colors32 = c, triangles = t };
            m.RecalculateBounds(); _meshes[key] = m; return m;
        }

        public Transform Spawn(string modelId, int variant, Transform parent)
        {
            // the mesh is built in web coordinates with the front at +z; after the z mirror the front is at −z,
            // so the child is turned 180° to keep "forward = +z" for the runner
            string key = modelId == "frt" ? modelId + "#" + (variant % 12) : modelId;
            Stack<Transform> st; Transform tr;
            if (_free.TryGetValue(key, out st) && st.Count > 0) { tr = st.Pop(); tr.gameObject.SetActive(true); tr.SetParent(parent, false); }
            else
            {
                var go = new GameObject("Car " + key); go.transform.SetParent(parent, false); tr = go.transform;
                var body = new GameObject("Body"); body.transform.SetParent(tr, false); body.transform.localRotation = Quaternion.Euler(0, 180, 0);
                body.AddComponent<MeshFilter>().sharedMesh = MeshFor(key, modelId, variant);
                body.AddComponent<MeshRenderer>().sharedMaterial = _mat;
            }
            _key[tr] = key; return tr;
        }

        public void Release(Transform car)
        {
            string key; if (car == null || !_key.TryGetValue(car, out key)) return;
            _key.Remove(car); car.gameObject.SetActive(false);
            Stack<Transform> st; if (!_free.TryGetValue(key, out st)) _free[key] = st = new Stack<Transform>();
            st.Push(car);
        }
    }
}
