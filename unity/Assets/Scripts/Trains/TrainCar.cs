using ThaiRail.Pooling;
using UnityEngine;

namespace ThaiRail.Trains
{
    public enum CarRole : byte
    {
        Cab,         // DMU / Sprinter driving car (push-pull, no run-around needed)
        Coach,       // passenger trailer
        Locomotive,  // AD24C, QSY
        CargoWagon   // container flat wagon
    }

    /// <summary>
    /// One pooled car of a train. Holds no reference to the pool beyond its PooledObject, and resets
    /// every bit of per-trip state in OnDespawned so a recycled car is indistinguishable from a new one.
    /// </summary>
    [RequireComponent(typeof(PooledObject))]
    public sealed class TrainCar : MonoBehaviour, IPoolable
    {
        [SerializeField] private CarRole role = CarRole.Coach;

        [Tooltip("Coupler-to-coupler length in metres, used to lay cars out along a platform.")]
        [SerializeField, Min(1f)] private float length = 20f;

        [Tooltip("Where containers sit on a cargo wagon. Leave empty for passenger cars.")]
        [SerializeField] private Transform[] cargoSlots = new Transform[0];

        [Tooltip("Renderers tinted for selection. Tinting uses a MaterialPropertyBlock, so no material copies.")]
        [SerializeField] private Renderer[] tintRenderers = new Renderer[0];

        private static readonly int ColorId = Shader.PropertyToID("_BaseColor");
        private static MaterialPropertyBlock _mpb;

        private PooledObject[] _cargo;
        private int _cargoCount;

        public CarRole Role { get { return role; } }
        public float Length { get { return length; } }
        public int CargoCapacity { get { return cargoSlots.Length; } }
        public int CargoCount { get { return _cargoCount; } }
        public bool IsLocomotive { get { return role == CarRole.Locomotive; } }

        /// <summary>The consist this car currently belongs to (null while in the pool or while a
        /// detached locomotive runs around the train on its own).</summary>
        public TrainConsist Consist { get; internal set; }

        public PooledObject Pooled { get; private set; }
        public Transform CachedTransform { get; private set; }

        private void Awake()
        {
            Pooled = GetComponent<PooledObject>();
            CachedTransform = transform;
            _cargo = new PooledObject[cargoSlots.Length];
            if (_mpb == null) _mpb = new MaterialPropertyBlock();
        }

        public void OnSpawned()
        {
            _cargoCount = 0;
            Consist = null;
            ClearTint();
        }

        public void OnDespawned()
        {
            UnloadAllCargo();
            Consist = null;
        }

        // ------------------------------------------------------------ cargo (pooled containers)

        /// <summary>Puts one pooled container on the next free slot. Returns false when full.</summary>
        public bool TryLoadContainer(PoolId containerId)
        {
            if (_cargoCount >= cargoSlots.Length) return false;
            var slot = cargoSlots[_cargoCount];
            var box = PoolManager.Instance.Spawn(containerId, slot.position, slot.rotation, slot);
            if (box == null) return false;
            _cargo[_cargoCount++] = box;
            return true;
        }

        /// <summary>Removes the last container and returns it to its pool.</summary>
        public bool TryUnloadContainer()
        {
            if (_cargoCount == 0) return false;
            var box = _cargo[--_cargoCount];
            _cargo[_cargoCount] = null;
            if (box != null && !box.IsInPool) box.Release();
            return true;
        }

        public void UnloadAllCargo()
        {
            while (_cargoCount > 0) TryUnloadContainer();
        }

        // ------------------------------------------------------------ selection tint

        public void SetTint(Color color)
        {
            _mpb.Clear();
            _mpb.SetColor(ColorId, color);
            for (int i = 0; i < tintRenderers.Length; i++) tintRenderers[i].SetPropertyBlock(_mpb);
        }

        public void ClearTint()
        {
            for (int i = 0; i < tintRenderers.Length; i++) tintRenderers[i].SetPropertyBlock(null);
        }
    }
}
