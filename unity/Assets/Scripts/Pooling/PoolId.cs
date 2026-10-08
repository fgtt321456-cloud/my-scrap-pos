namespace ThaiRail.Pooling
{
    /// <summary>
    /// Every poolable prefab in the game has one id. The PoolManager stores its pools in an array
    /// indexed by this value, so a lookup is a single array read (no string hashing, no dictionary).
    ///
    /// Values are serialized by number in the PoolCatalog asset: ONLY APPEND new ids before
    /// <see cref="Count"/> and never renumber existing ones.
    /// </summary>
    public enum PoolId : byte
    {
        None = 0,

        // ---- Train cars (cabins, coaches, locomotives, wagons) ----
        ThnDmuCab = 1,          // Tier 1 THN DMU driving car
        ThnDmuTrailer = 2,      // Tier 1 THN DMU intermediate car
        Ad24cLocomotive = 3,    // Tier 2 Alsthom AD24C
        ContainerFlatWagon = 4, // Tier 2 cargo wagon
        AsrSprinterCab = 5,     // Tier 3 ASR Sprinter driving car
        AsrSprinterCoach = 6,   // Tier 3 ASR Sprinter intermediate car
        QsyLocomotive = 7,      // Tier 4 QSY "Ultraman"
        QsyVipCoach = 8,        // Tier 4 VIP coach

        // ---- Cargo carried on wagons ----
        Container20ft = 20,
        Container40ft = 21,

        // ---- Ground service vehicles ----
        Forklift = 40,
        FuelTruck = 41,
        CleaningCart = 42,

        Count = 64 // array size; keep above every id
    }
}
