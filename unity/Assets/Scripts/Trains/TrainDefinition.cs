using System.Collections.Generic;
using ThaiRail.Pooling;
using UnityEngine;

namespace ThaiRail.Trains
{
    public enum FleetTier : byte { Tier1 = 1, Tier2 = 2, Tier3 = 3, Tier4 = 4 }

    /// <summary>
    /// Static data for one train model. Create one asset per model:
    ///   THN DMU        : head ThnDmuCab,      middle ThnDmuTrailer x1-2,  tail ThnDmuCab,      runAround false
    ///   Alsthom AD24C  : head Ad24cLocomotive, middle ContainerFlatWagon x4-8, tail None,     runAround true
    ///   ASR Sprinter   : head AsrSprinterCab,  middle AsrSprinterCoach x1-2, tail AsrSprinterCab, runAround false
    ///   QSY "Ultraman" : head QsyLocomotive,   middle QsyVipCoach or ContainerFlatWagon, tail None, runAround true
    /// </summary>
    [CreateAssetMenu(menuName = "Thai Railway/Train Definition", fileName = "Train_")]
    public sealed class TrainDefinition : ScriptableObject
    {
        public string displayName = "THN DMU";
        public FleetTier tier = FleetTier.Tier1;

        [Header("Composition (pool ids)")]
        public PoolId headCar = PoolId.ThnDmuCab;
        public PoolId middleCar = PoolId.ThnDmuTrailer;
        [Min(0)] public int defaultMiddleCount = 1;
        [Tooltip("PoolId.None for loco-hauled trains: the tail is the last wagon.")]
        public PoolId tailCar = PoolId.ThnDmuCab;

        [Header("Gameplay")]
        [Tooltip("Loco-hauled trains must detach the locomotive and run it around to the other end before departing.")]
        public bool requiresRunAround;
        [Tooltip("Container type loaded onto cargo wagons by the forklift service.")]
        public PoolId cargoContainer = PoolId.Container40ft;
        [Min(0f)] public float maxSpeedKmh = 100f;
        [Min(0)] public int purchasePrice = 35000;

        /// <summary>Writes the car ids front to back into a caller-owned buffer (no allocation).</summary>
        public void GetComposition(List<PoolId> buffer, int middleCount = -1)
        {
            buffer.Clear();
            if (middleCount < 0) middleCount = defaultMiddleCount;
            if (headCar != PoolId.None) buffer.Add(headCar);
            for (int i = 0; i < middleCount; i++) buffer.Add(middleCar);
            if (tailCar != PoolId.None) buffer.Add(tailCar);
        }
    }
}
