using ThaiRail.Pooling;
using UnityEngine;

namespace ThaiRail.UI.WorldIcons
{
    /// <summary>
    /// Put on anything that can carry floating icons: the lead car of each train prefab, station
    /// buildings, signals. Holds up to <see cref="MaxSlots"/> icons side by side (e.g. Refuel, Clean, Load).
    /// Implements IPoolable so a recycled train never keeps the previous trip's icons.
    /// </summary>
    public sealed class WorldIconAnchor : MonoBehaviour, IPoolable
    {
        public const int MaxSlots = 4;

        [Tooltip("World-space offset above the pivot (metres).")]
        [SerializeField] private Vector3 offset = new Vector3(0f, 6f, 0f);

        [Tooltip("Trains: on. Stations/signals: off, so their icons sit on the static layer and never re-batch.")]
        [SerializeField] private bool moves = true;

        internal readonly WorldIcon[] Slots = new WorldIcon[MaxSlots];
        private Transform _t;

        public bool Moves { get { return moves; } }

        /// <summary>Optional payload for click handlers (platform index, train id...). No boxing: plain int.</summary>
        public int UserId { get; set; }

        public Vector3 WorldPosition
        {
            get
            {
                if (_t == null) _t = transform;
                return _t.position + offset;
            }
        }

        private void Awake() { _t = transform; }

        public void OnSpawned() { }

        public void OnDespawned() { HideAll(); }

        private void OnDisable() { HideAll(); }

        public void HideAll()
        {
            var canvas = WorldIconCanvas.Instance;
            if (canvas == null) return;
            for (int i = 0; i < MaxSlots; i++)
                if (Slots[i] != null) canvas.Hide(this, i);
        }
    }
}
