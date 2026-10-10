using System;
using ThaiRail.Pooling;
using UnityEngine;

namespace ThaiRail.Trains
{
    /// <summary>
    /// Maps the model ids used by the simulation and rolling_stock.json ("HID", "cnr", "THN_car", ...) to pooled prefabs.
    /// Create: Create > Thai Railway > Rolling Stock Catalog, add one row per model. A missing id falls back to
    /// <see cref="fallback"/> so a station still runs before every model has art.
    /// </summary>
    [CreateAssetMenu(menuName = "Thai Railway/Rolling Stock Catalog", fileName = "RollingStockCatalog")]
    public sealed class RollingStockCatalog : ScriptableObject
    {
        [Serializable]
        public struct Row
        {
            [Tooltip("Model id from rolling_stock.json, or an alias such as THN_car / coach / cnr")] public string modelId;
            public PoolId pool;
            [Tooltip("Turn the car 180° when it is the last vehicle (driving trailers / rear cabs of DMUs and EMUs)")] public bool cabAtBothEnds;
        }

        public Row[] rows = new Row[0];
        public PoolId fallback = PoolId.ThnDmuTrailer;

        public PoolId PoolFor(string modelId)
        {
            for (int i = 0; i < rows.Length; i++) if (rows[i].modelId == modelId) return rows[i].pool;
            return fallback;
        }
        /// <summary>Same rule as isCab() in the web build: DMU/EMU power cars have a cab at the rear of the set too.</summary>
        public bool FlipWhenLast(string modelId)
        {
            for (int i = 0; i < rows.Length; i++) if (rows[i].modelId == modelId) return rows[i].cabAtBothEnds;
            return modelId == "THN" || modelId == "NKF" || modelId == "APD" || modelId == "ASR" || modelId == "red";
        }
    }
}
