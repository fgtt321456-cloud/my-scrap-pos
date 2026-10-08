namespace ThaiRail.Pooling
{
    /// <summary>
    /// Implement on any component of a pooled prefab that holds per-use state.
    /// The callbacks replace Awake/OnDestroy for gameplay state: Awake runs only once per instance,
    /// but a pooled object is reused many times.
    /// </summary>
    public interface IPoolable
    {
        /// <summary>Called after the object is taken from the pool, positioned and active.</summary>
        void OnSpawned();

        /// <summary>Called just before the object goes back into the pool. Clear every reference here
        /// (consists, listeners, cargo) so a reused object never carries old state.</summary>
        void OnDespawned();
    }
}
