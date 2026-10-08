using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ThaiRail.UI.WorldIcons
{
    /// <summary>
    /// One pooled icon element living under the shared WorldIconCanvas.
    /// Prefab layout (all Images from one sprite atlas, no LayoutGroups, no ContentSizeFitters):
    ///   WorldIcon (RectTransform 64x64, this script)
    ///     Glow   (Image, soft radial sprite, raycastTarget off)
    ///     Disc   (Image, circle sprite, raycastTarget ON  - the only tappable graphic)
    ///     Ring   (Image, Filled / Radial360, raycastTarget off)
    ///     Glyph  (Image, raycastTarget off)
    /// </summary>
    public sealed class WorldIcon : MonoBehaviour, IPointerClickHandler
    {
        [SerializeField] private Image glow;
        [SerializeField] private Image disc;
        [SerializeField] private Image ring;
        [SerializeField] private Image glyph;

        public RectTransform Rect { get; private set; }
        public WorldIconAnchor Anchor { get; internal set; }
        public WorldIconType Type { get; private set; }
        public int Slot { get; internal set; }
        public bool Pulses { get; private set; }
        public float PixelSize { get; private set; }

        internal int ActiveIndex = -1;
        internal float PulsePhase;
        internal WorldIconCanvas Owner;

        private bool _culled;
        private float _progress = -1f;

        private void Awake()
        {
            Rect = (RectTransform)transform;
            ring.type = Image.Type.Filled;
            ring.fillMethod = Image.FillMethod.Radial360;
        }

        internal void Apply(WorldIconType type, WorldIconStyleSet.Style style)
        {
            Type = type;
            Pulses = style.pulse;
            PixelSize = style.pixelSize > 0f ? style.pixelSize : 64f;
            glyph.sprite = style.glyph;
            glyph.color = style.glyphColor;
            disc.color = style.background;
            disc.raycastTarget = style.clickable;
            glow.enabled = style.glow;
            if (style.glow)
            {
                var g = style.background;
                g.a = 0.45f;
                glow.color = g;
            }
            SetProgress(-1f);
            SetCulled(false);
        }

        /// <summary>0..1 shows a ring; a negative value hides it. Ignores changes under 1% so the
        /// canvas is not re-batched every frame for invisible differences.</summary>
        public void SetProgress(float value01)
        {
            if (value01 < 0f)
            {
                if (_progress >= 0f || ring.enabled) { ring.enabled = false; _progress = -1f; }
                return;
            }
            if (!ring.enabled) ring.enabled = true;
            if (Mathf.Abs(value01 - _progress) < 0.01f) return;
            _progress = value01;
            ring.fillAmount = value01;
        }

        /// <summary>Hides the graphics without disabling the GameObject (disabling forces a canvas rebuild).</summary>
        internal void SetCulled(bool culled)
        {
            if (culled == _culled) return;
            _culled = culled;
            glow.canvasRenderer.cull = culled;
            disc.canvasRenderer.cull = culled;
            ring.canvasRenderer.cull = culled;
            glyph.canvasRenderer.cull = culled;
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            if (Owner != null) Owner.NotifyClicked(this);
        }
    }
}
