using ThaiRail.Data;
using ThaiRail.Pooling;
using ThaiRail.Scenery;
using UnityEngine;

namespace ThaiRail.Trains
{
    /// <summary>Picks where cars come from: real pooled prefabs when a catalog and a PoolManager exist, else the built-in models.</summary>
    public static class CarSourceFactory
    {
        public static ICarSource Create(RollingStockCatalog catalog, RailTrackDatabase db, Material placeholder)
        {
            if (catalog != null && PoolManager.Instance != null) return new PooledCarSource(catalog);
            return new ProceduralCarSource(db, placeholder != null ? placeholder : new Material(RailTrackShaders.Find("VertexColorLit")));
        }
        /// <summary>DMU/EMU power cars have a cab at the rear of the set too (isCab() in the web build).</summary>
        public static bool IsCab(string m) { return m == "THN" || m == "NKF" || m == "APD" || m == "ASR" || m == "red"; }
    }
}
