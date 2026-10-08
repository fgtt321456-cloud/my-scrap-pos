using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace ThaiRail.Pooling
{
    /// <summary>
    /// Central access point for every pool (train cars, cargo, ground service vehicles).
    ///
    /// Mobile performance rules this class follows:
    ///  - Lookup is an array index by PoolId: no strings, no dictionaries, no boxing.
    ///  - Prewarm is sliced across frames (a budget per frame) so the loading screen keeps animating
    ///    and there is no single long hitch.
    ///  - Spawn/Release never call GetComponent, never allocate, and never use LINQ or closures.
    ///  - Delayed releases use one list ticked in Update instead of a coroutine per object.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public sealed class PoolManager : MonoBehaviour
    {
        public static PoolManager Instance { get; private set; }

        [SerializeField] private PoolCatalog catalog;

        [Tooltip("Instances created per frame while prewarming. Lower it if the loading screen stutters on low-end phones.")]
        [SerializeField, Min(1)] private int prewarmPerFrame = 6;

        [SerializeField] private bool prewarmOnAwake = true;

        [Tooltip("Keep the pools when loading another scene (e.g. switching from a station to the network map).")]
        [SerializeField] private bool persistAcrossScenes = true;

        private readonly GameObjectPool[] _pools = new GameObjectPool[(int)PoolId.Count];
        private Transform _storageRoot;
        private Transform _activeRoot;

        private struct TimedRelease
        {
            public PooledObject Obj;
            public int Version;
            public float At;
        }
        private readonly List<TimedRelease> _timed = new List<TimedRelease>(64);

        public bool IsPrewarmed { get; private set; }
        public float PrewarmProgress { get; private set; }

        /// <summary>Raised once when every pool reached its prewarm count. Hook the loading screen to it.</summary>
        public event Action Prewarmed;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            if (persistAcrossScenes) DontDestroyOnLoad(gameObject);

            var storage = new GameObject("[Pool Storage]");
            storage.SetActive(false); // children stay inactive in hierarchy
            _storageRoot = storage.transform;
            _storageRoot.SetParent(transform, false);

            _activeRoot = new GameObject("[Pool Active]").transform;
            _activeRoot.SetParent(transform, false);

            BuildPools();
            if (prewarmOnAwake) StartCoroutine(PrewarmRoutine());
        }

        private void OnDestroy()
        {
            if (Instance == this) Instance = null;
        }

        private void BuildPools()
        {
            if (catalog == null)
            {
                Debug.LogError("[Pool] PoolManager has no PoolCatalog assigned.", this);
                return;
            }
            var entries = catalog.entries;
            for (int i = 0; i < entries.Length; i++)
            {
                var e = entries[i];
                if (e.id == PoolId.None || e.prefab == null) continue;
                _pools[(int)e.id] = new GameObjectPool(e.id, e.prefab, _storageRoot, _activeRoot, e.prewarm, Mathf.Max(e.maxSize, e.prewarm));
            }
        }

        /// <summary>Frame-sliced prewarm. Call it yourself (and set prewarmOnAwake off) to run it behind a loading screen.</summary>
        public IEnumerator PrewarmRoutine()
        {
            IsPrewarmed = false;
            if (catalog == null) yield break;

            int total = 0;
            var entries = catalog.entries;
            for (int i = 0; i < entries.Length; i++) total += entries[i].prewarm;

            int done = 0, thisFrame = 0;
            for (int i = 0; i < entries.Length; i++)
            {
                var pool = GetPool(entries[i].id);
                if (pool == null) continue;
                while (pool.CountTotal < entries[i].prewarm)
                {
                    pool.PrewarmOne();
                    done++;
                    PrewarmProgress = total > 0 ? (float)done / total : 1f;
                    if (++thisFrame >= prewarmPerFrame)
                    {
                        thisFrame = 0;
                        yield return null;
                    }
                }
            }

            PrewarmProgress = 1f;
            IsPrewarmed = true;
            var handler = Prewarmed;
            if (handler != null) handler();
        }

        // ------------------------------------------------------------------ spawn

        public PooledObject Spawn(PoolId id, Vector3 position, Quaternion rotation, Transform parent = null)
        {
            var pool = GetPool(id);
            if (pool == null)
            {
                Debug.LogError($"[Pool] No pool registered for {id}. Add it to the PoolCatalog.");
                return null;
            }
            return pool.Get(position, rotation, parent);
        }

        /// <summary>Spawns and returns the prefab's gameplay component (cached after the first lookup).</summary>
        public T Spawn<T>(PoolId id, Vector3 position, Quaternion rotation, Transform parent = null) where T : Component
        {
            var obj = Spawn(id, position, rotation, parent);
            return obj != null ? obj.GetPrimary<T>() : null;
        }

        // ------------------------------------------------------------------ release

        public void Release(PooledObject obj)
        {
            if (obj == null) return;
            if (obj.IsInPool)
            {
#if UNITY_EDITOR || DEVELOPMENT_BUILD
                Debug.LogWarning($"[Pool] {obj.name} ({obj.Id}) was released twice. Ignored.", obj);
#endif
                return;
            }
            var pool = GetPool(obj.Id);
            if (pool == null) { Destroy(obj.gameObject); return; }
            pool.Release(obj);
        }

        /// <summary>Releases a component's object. Convenience for gameplay code holding a TrainCar etc.</summary>
        public void Release(Component component)
        {
            if (component == null) return;
            var obj = component.GetComponent<PooledObject>();
            if (obj != null) Release(obj);
            else Destroy(component.gameObject);
        }

        /// <summary>
        /// Returns the object after a delay. Safe if the object is released earlier and re-spawned
        /// for another use: the stored SpawnVersion will no longer match and the release is skipped.
        /// </summary>
        public void ReleaseAfter(PooledObject obj, float seconds)
        {
            if (obj == null || obj.IsInPool) return;
            _timed.Add(new TimedRelease { Obj = obj, Version = obj.SpawnVersion, At = Time.time + seconds });
        }

        public void ReleaseAll(PoolId id)
        {
            var pool = GetPool(id);
            if (pool != null) pool.ReleaseAll();
        }

        /// <summary>Returns everything to the pools, e.g. at the end of a shift before showing the receipt.</summary>
        public void ReleaseAll()
        {
            _timed.Clear();
            for (int i = 0; i < _pools.Length; i++)
                if (_pools[i] != null) _pools[i].ReleaseAll();
        }

        private void Update()
        {
            if (_timed.Count == 0) return;
            float now = Time.time;
            for (int i = _timed.Count - 1; i >= 0; i--)
            {
                var t = _timed[i];
                if (t.At > now) continue;
                // Swap-remove before releasing so the list stays valid.
                int last = _timed.Count - 1;
                _timed[i] = _timed[last];
                _timed.RemoveAt(last);
                if (t.Obj != null && !t.Obj.IsInPool && t.Obj.SpawnVersion == t.Version) Release(t.Obj);
            }
        }

        // ------------------------------------------------------------------ queries

        public GameObjectPool GetPool(PoolId id)
        {
            int i = (int)id;
            return i > 0 && i < _pools.Length ? _pools[i] : null;
        }

        public bool Has(PoolId id) { return GetPool(id) != null; }

#if UNITY_EDITOR || DEVELOPMENT_BUILD
        /// <summary>Logs active/free/peak counts per pool. Run it after a busy shift to tune prewarm values.</summary>
        [ContextMenu("Log Pool Stats")]
        public void LogStats()
        {
            var sb = new System.Text.StringBuilder("[Pool] stats\n");
            for (int i = 0; i < _pools.Length; i++)
            {
                var p = _pools[i];
                if (p == null) continue;
                sb.Append(p.Id).Append(": active ").Append(p.CountActive)
                  .Append(", free ").Append(p.CountFree)
                  .Append(", peak ").Append(p.PeakActive)
                  .Append(", runtime instantiations ").Append(p.RuntimeInstantiations).Append('\n');
            }
            Debug.Log(sb.ToString(), this);
        }
#endif
    }
}
