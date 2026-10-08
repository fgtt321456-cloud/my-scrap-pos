using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ThaiRail.UI.WorldIcons
{
    /// <summary>
    /// ONE world-space canvas for every floating icon above trains, stations and signals.
    ///
    /// Why one canvas instead of a canvas per train (the usual mobile killer):
    ///  - Icons share one sprite atlas, so the whole layer draws in one or two batches.
    ///  - Two nested canvases split the work: icons on moving trains live on the Dynamic layer
    ///    (re-batched every frame), icons on stations live on the Static layer (re-batched only when an
    ///    icon is added or removed).
    ///  - Billboarding is free: with the fixed isometric camera every icon faces the same way, so only
    ///    the root rotation is set, and only when the camera turns.
    ///  - Constant on-screen size: each icon is scaled so 1 canvas unit = 1 screen pixel, computed once
    ///    per frame for an orthographic camera (per icon for perspective).
    ///  - Offscreen icons are culled through CanvasRenderer.cull (no SetActive, which forces rebuilds).
    ///  - Icons are pooled; Show/Hide never instantiate after prewarm and never allocate.
    ///
    /// Scene setup: a Canvas (Render Mode = World Space, Event Camera = the game camera) with a
    /// GraphicRaycaster, plus two child RectTransforms each holding its own Canvas component
    /// ("Static" and "Dynamic"). Assign them below.
    /// </summary>
    [RequireComponent(typeof(Canvas))]
    [DefaultExecutionOrder(500)] // after gameplay moved the trains this frame
    public sealed class WorldIconCanvas : MonoBehaviour
    {
        public static WorldIconCanvas Instance { get; private set; }

        [SerializeField] private Camera worldCamera;
        [SerializeField] private WorldIcon iconPrefab;
        [SerializeField] private WorldIconStyleSet styles;
        [SerializeField] private RectTransform staticLayer;
        [SerializeField] private RectTransform dynamicLayer;

        [SerializeField, Min(0)] private int prewarm = 32;
        [Tooltip("Horizontal spacing between icons on the same anchor, in screen pixels.")]
        [SerializeField] private float slotSpacingPx = 72f;
        [Tooltip("Extra viewport margin before an icon is culled (0.1 = 10% of the screen).")]
        [SerializeField] private float cullMargin = 0.08f;
        [SerializeField] private float pulseSpeed = 4f;
        [SerializeField, Range(0f, 0.3f)] private float pulseAmount = 0.12f;
        [Tooltip("Scale icons a little with zoom so they shrink when zoomed far out, instead of cluttering.")]
        [SerializeField, Range(0f, 1f)] private float zoomInfluence = 0.35f;
        [SerializeField] private float referenceOrthoSize = 60f;

        /// <summary>Raised when the player taps a clickable icon. Subscribe once (no per-icon closures).</summary>
        public event Action<WorldIconAnchor, WorldIconType, int> IconClicked;

        private readonly Stack<WorldIcon> _free = new Stack<WorldIcon>(64);
        private readonly List<WorldIcon> _active = new List<WorldIcon>(64);
        private Transform _root;
        private Transform _camT;
        private Quaternion _lastCamRot;
        private float _unitsPerPixel = 0.05f;

        private void Awake()
        {
            if (Instance != null && Instance != this) { Destroy(gameObject); return; }
            Instance = this;
            _root = transform;
            var canvas = GetComponent<Canvas>();
            canvas.renderMode = RenderMode.WorldSpace;
            if (worldCamera == null) worldCamera = Camera.main;
            canvas.worldCamera = worldCamera;
            _camT = worldCamera.transform;
            for (int i = 0; i < prewarm; i++) _free.Push(Create());
        }

        private void OnDestroy() { if (Instance == this) Instance = null; }

        // ------------------------------------------------------------------ public API

        /// <summary>Shows (or replaces) the icon in <paramref name="slot"/> of an anchor.</summary>
        public WorldIcon Show(WorldIconAnchor anchor, WorldIconType type, int slot = 0)
        {
            if (anchor == null || (uint)slot >= WorldIconAnchor.MaxSlots) return null;
            var current = anchor.Slots[slot];
            if (current != null)
            {
                if (current.Type == type) return current; // no change, no rebuild
                current.Apply(type, styles.Get(type));
                return current;
            }

            var icon = _free.Count > 0 ? _free.Pop() : Create();
            icon.Anchor = anchor;
            icon.Slot = slot;
            icon.PulsePhase = (anchor.GetInstanceID() & 255) * 0.1f; // desync pulses between trains
            icon.Rect.SetParent(anchor.Moves ? dynamicLayer : staticLayer, false);
            icon.Rect.localRotation = Quaternion.identity;
            icon.Apply(type, styles.Get(type));
            icon.ActiveIndex = _active.Count;
            _active.Add(icon);
            anchor.Slots[slot] = icon;
            _forceLayout = true; // neighbours on this anchor shift to stay centred
            Place(icon, worldCamera.orthographic ? _unitsPerPixel : UnitsPerPixelAt(icon.Anchor.WorldPosition));
            return icon;
        }

        public void Hide(WorldIconAnchor anchor, int slot)
        {
            if (anchor == null || (uint)slot >= WorldIconAnchor.MaxSlots) return;
            var icon = anchor.Slots[slot];
            if (icon == null) return;
            anchor.Slots[slot] = null;

            int i = icon.ActiveIndex, last = _active.Count - 1;
            if (i >= 0 && i <= last && _active[i] == icon)
            {
                var moved = _active[last];
                _active[i] = moved;
                moved.ActiveIndex = i;
                _active.RemoveAt(last);
            }
            icon.ActiveIndex = -1;
            icon.Anchor = null;
            icon.SetCulled(true); // hidden without SetActive
            _forceLayout = true;
            _free.Push(icon);
        }

        public void SetProgress(WorldIconAnchor anchor, int slot, float value01)
        {
            if (anchor == null || (uint)slot >= WorldIconAnchor.MaxSlots) return;
            var icon = anchor.Slots[slot];
            if (icon != null) icon.SetProgress(value01);
        }

        internal void NotifyClicked(WorldIcon icon)
        {
            var h = IconClicked;
            if (h != null && icon.Anchor != null) h(icon.Anchor, icon.Type, icon.Slot);
        }

        // ------------------------------------------------------------------ per-frame

        private void LateUpdate()
        {
            if (_active.Count == 0) return;

            // Billboard: rotate the root only when the camera turned.
            var camRot = _camT.rotation;
            if (camRot != _lastCamRot)
            {
                _root.rotation = camRot;
                _lastCamRot = camRot;
                _forceLayout = true; // slot offsets follow the camera's right axis
            }

            bool ortho = worldCamera.orthographic;
            if (ortho) _unitsPerPixel = UnitsPerPixelOrtho();

            float time = Time.unscaledTime;
            for (int i = 0; i < _active.Count; i++)
            {
                var icon = _active[i];
                var anchor = icon.Anchor;
                if (anchor == null) continue;

                Vector3 world = anchor.WorldPosition;
                Vector3 vp = worldCamera.WorldToViewportPoint(world);
                bool visible = vp.z > 0f && vp.x > -cullMargin && vp.x < 1f + cullMargin && vp.y > -cullMargin && vp.y < 1f + cullMargin;
                icon.SetCulled(!visible);
                if (!visible) continue;

                // Static-layer icons only need updating when the layout changed or they pulse.
                if (!anchor.Moves && !icon.Pulses && !_forceLayout) continue;

                float upp = ortho ? _unitsPerPixel : UnitsPerPixelAt(world);
                float pulse = icon.Pulses ? 1f + Mathf.Sin(time * pulseSpeed + icon.PulsePhase) * pulseAmount : 1f;
                Place(icon, upp, pulse);
            }
            _forceLayout = false;
        }

        private bool _forceLayout;
        private float _lastOrthoSize = -1f;
        private int _lastScreenH = -1;

        private float UnitsPerPixelOrtho()
        {
            float size = worldCamera.orthographicSize;
            int h = worldCamera.pixelHeight;
            if (size != _lastOrthoSize || h != _lastScreenH)
            {
                _lastOrthoSize = size;
                _lastScreenH = h;
                _forceLayout = true;
                float upp = 2f * size / Mathf.Max(1, h);
                // Shrink slightly when zoomed out, grow slightly when zoomed in.
                float zoomFactor = Mathf.Lerp(1f, referenceOrthoSize / size, zoomInfluence);
                _unitsPerPixel = upp * Mathf.Clamp(zoomFactor, 0.6f, 1.4f);
            }
            return _unitsPerPixel;
        }

        private float UnitsPerPixelAt(Vector3 world)
        {
            float dist = Vector3.Dot(world - _camT.position, _camT.forward);
            return 2f * dist * Mathf.Tan(worldCamera.fieldOfView * 0.5f * Mathf.Deg2Rad) / Mathf.Max(1, worldCamera.pixelHeight);
        }

        private void Place(WorldIcon icon, float unitsPerPixel, float pulse = 1f)
        {
            float slotOffsetPx = (icon.Slot - (CountSlots(icon.Anchor) - 1) * 0.5f) * slotSpacingPx;
            Vector3 world = icon.Anchor.WorldPosition + _root.right * (slotOffsetPx * unitsPerPixel);
            float s = unitsPerPixel * (icon.PixelSize / 64f) * pulse;
            icon.Rect.position = world;
            icon.Rect.localScale = new Vector3(s, s, s);
        }

        private static int CountSlots(WorldIconAnchor anchor)
        {
            int highest = 0;
            for (int i = 0; i < WorldIconAnchor.MaxSlots; i++) if (anchor.Slots[i] != null) highest = i + 1;
            return Mathf.Max(1, highest);
        }

        private WorldIcon Create()
        {
            var icon = Instantiate(iconPrefab, staticLayer, false);
            icon.Owner = this;
            icon.SetCulled(true);
            return icon;
        }
    }
}
