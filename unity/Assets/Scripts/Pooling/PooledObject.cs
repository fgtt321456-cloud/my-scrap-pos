using UnityEngine;

namespace ThaiRail.Pooling
{
    /// <summary>
    /// Added to every pooled instance (the PoolManager adds it automatically if the prefab lacks it).
    /// Caches the Transform and the IPoolable components once, so spawning and releasing never call
    /// GetComponent.
    /// </summary>
    [DisallowMultipleComponent]
    public sealed class PooledObject : MonoBehaviour
    {
        public PoolId Id { get; private set; }

        /// <summary>True while the object sits unused in its pool.</summary>
        public bool IsInPool { get; private set; }

        /// <summary>Increments on every spawn. Lets delayed releases detect that the object was
        /// already returned and reused by someone else in the meantime.</summary>
        public int SpawnVersion { get; private set; }

        public Transform CachedTransform { get; private set; }

        internal int ActiveIndex = -1; // slot in the pool's active list, for O(1) removal

        private IPoolable[] _poolables;
        private Component _primary;     // typed component cache, see GetPrimary<T>

        internal void Initialize(PoolId id)
        {
            Id = id;
            CachedTransform = transform;
            // includeInactive: instances are created under an inactive root.
            _poolables = GetComponentsInChildren<IPoolable>(true);
            IsInPool = true;
        }

        internal void NotifySpawned()
        {
            IsInPool = false;
            SpawnVersion++;
            var list = _poolables;
            for (int i = 0; i < list.Length; i++) list[i].OnSpawned();
        }

        internal void NotifyDespawned()
        {
            var list = _poolables;
            for (int i = 0; i < list.Length; i++) list[i].OnDespawned();
            IsInPool = true;
        }

        /// <summary>
        /// Returns the gameplay component of type T, looked up once and cached.
        /// Use it instead of GetComponent in hot paths.
        /// </summary>
        public T GetPrimary<T>() where T : Component
        {
            var cached = _primary as T;
            if (cached != null) return cached;
            cached = GetComponent<T>();
            _primary = cached;
            return cached;
        }

        /// <summary>Shorthand for PoolManager.Instance.Release(this).</summary>
        public void Release()
        {
            PoolManager.Instance.Release(this);
        }
    }
}
