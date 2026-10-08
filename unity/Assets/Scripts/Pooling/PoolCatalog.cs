using System;
using UnityEngine;

namespace ThaiRail.Pooling
{
    /// <summary>
    /// Designer-facing list of every pooled prefab and how many to create up front.
    /// Create via Assets > Create > Thai Railway > Pool Catalog and assign it to the PoolManager.
    /// </summary>
    [CreateAssetMenu(menuName = "Thai Railway/Pool Catalog", fileName = "PoolCatalog")]
    public sealed class PoolCatalog : ScriptableObject
    {
        [Serializable]
        public struct Entry
        {
            public PoolId id;
            public GameObject prefab;

            [Tooltip("Instances created during the loading screen. Set it to the peak count you see in " +
                     "PoolManager stats during a busy shift, so gameplay never instantiates.")]
            [Min(0)] public int prewarm;

            [Tooltip("Upper bound kept in memory. Extra instances released above it are destroyed.")]
            [Min(1)] public int maxSize;
        }

        public Entry[] entries = new Entry[0];

#if UNITY_EDITOR
        private void OnValidate()
        {
            var seen = new bool[(int)PoolId.Count];
            for (int i = 0; i < entries.Length; i++)
            {
                var e = entries[i];
                if (e.id == PoolId.None) Debug.LogWarning($"{name}: entry {i} has PoolId.None.", this);
                else if (seen[(int)e.id]) Debug.LogError($"{name}: PoolId {e.id} is listed twice.", this);
                else seen[(int)e.id] = true;
                if (e.prefab == null) Debug.LogWarning($"{name}: entry {e.id} has no prefab.", this);
                if (e.maxSize < e.prewarm) Debug.LogWarning($"{name}: {e.id} maxSize is below prewarm.", this);
            }
        }
#endif
    }
}
