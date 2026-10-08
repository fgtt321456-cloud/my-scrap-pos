using System.Collections.Generic;
using UnityEngine;

namespace ThaiRail.Pooling
{
    /// <summary>
    /// One pool per prefab. Not a MonoBehaviour: the PoolManager owns and drives it.
    ///
    /// Activation strategy: instances live under an INACTIVE storage root and keep activeSelf = true.
    /// Spawning reparents them under an active parent (which activates them), releasing reparents
    /// them back. That is one hierarchy change per spawn/release, and freshly instantiated objects
    /// never run OnEnable or render a frame before they are used.
    /// </summary>
    public sealed class GameObjectPool
    {
        public readonly PoolId Id;

        private readonly GameObject _prefab;
        private readonly Transform _storageRoot;   // inactive
        private readonly Transform _defaultParent; // active
        private readonly int _maxSize;

        private readonly Stack<PooledObject> _free;
        private readonly List<PooledObject> _active;

        public int CountFree { get { return _free.Count; } }
        public int CountActive { get { return _active.Count; } }
        public int CountTotal { get { return _free.Count + _active.Count; } }

        /// <summary>Highest simultaneous active count seen. Use it to tune the catalog's prewarm.</summary>
        public int PeakActive { get; private set; }

        /// <summary>Instances created after prewarm, i.e. during gameplay. Should stay 0 in a tuned build.</summary>
        public int RuntimeInstantiations { get; private set; }

        public GameObjectPool(PoolId id, GameObject prefab, Transform storageRoot, Transform defaultParent, int capacity, int maxSize)
        {
            Id = id;
            _prefab = prefab;
            _storageRoot = storageRoot;
            _defaultParent = defaultParent;
            _maxSize = Mathf.Max(1, maxSize);
            _free = new Stack<PooledObject>(Mathf.Max(capacity, 4));
            _active = new List<PooledObject>(Mathf.Max(capacity, 4));
        }

        /// <summary>Creates one stored instance. Called by the manager's frame-sliced prewarm.</summary>
        public void PrewarmOne()
        {
            if (CountTotal >= _maxSize) return;
            _free.Push(CreateInstance());
        }

        public PooledObject Get(Vector3 position, Quaternion rotation, Transform parent)
        {
            PooledObject obj;
            if (_free.Count > 0)
            {
                obj = _free.Pop();
            }
            else
            {
                obj = CreateInstance();
                RuntimeInstantiations++;
#if UNITY_EDITOR || DEVELOPMENT_BUILD
                if (RuntimeInstantiations == 1)
                    Debug.LogWarning($"[Pool] {Id} ran dry and instantiated at runtime. Raise its prewarm count.");
#endif
            }

            var t = obj.CachedTransform;
            // Position before activation so physics and renderers never see the stale pose.
            t.SetParent(parent != null ? parent : _defaultParent, false);
            t.SetPositionAndRotation(position, rotation);

            obj.ActiveIndex = _active.Count;
            _active.Add(obj);
            if (_active.Count > PeakActive) PeakActive = _active.Count;

            obj.NotifySpawned();
            return obj;
        }

        public void Release(PooledObject obj)
        {
            obj.NotifyDespawned();
            RemoveFromActive(obj);

            if (CountTotal >= _maxSize)
            {
                Object.Destroy(obj.gameObject);
                return;
            }

            obj.CachedTransform.SetParent(_storageRoot, false);
            _free.Push(obj);
        }

        /// <summary>Returns every active instance, e.g. at the end of a shift or when unloading a station.</summary>
        public void ReleaseAll()
        {
            for (int i = _active.Count - 1; i >= 0; i--) Release(_active[i]);
        }

        /// <summary>Destroys the free instances, e.g. when leaving a station that used a different fleet.</summary>
        public void TrimFree(int keep)
        {
            while (_free.Count > keep) Object.Destroy(_free.Pop().gameObject);
        }

        private void RemoveFromActive(PooledObject obj)
        {
            int i = obj.ActiveIndex;
            int last = _active.Count - 1;
            if (i < 0 || i > last || _active[i] != obj) return;
            // Swap-remove: O(1), no array shifting.
            var moved = _active[last];
            _active[i] = moved;
            moved.ActiveIndex = i;
            _active.RemoveAt(last);
            obj.ActiveIndex = -1;
        }

        private PooledObject CreateInstance()
        {
            // Instantiating under the inactive root: Awake/OnEnable are deferred until first spawn,
            // and nothing renders in between.
            var go = Object.Instantiate(_prefab, _storageRoot, false);
            var pooled = go.GetComponent<PooledObject>();
            if (pooled == null) pooled = go.AddComponent<PooledObject>();
            pooled.Initialize(Id);
            return pooled;
        }
    }
}
