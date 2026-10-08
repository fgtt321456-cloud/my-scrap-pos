using System;
using UnityEngine;

namespace ThaiRail.UI.WorldIcons
{
    /// <summary>
    /// Look and behaviour per icon type. Put every sprite in ONE Sprite Atlas so all icons render in a
    /// single batch. Create via Assets > Create > Thai Railway > World Icon Styles.
    /// </summary>
    [CreateAssetMenu(menuName = "Thai Railway/World Icon Styles", fileName = "WorldIconStyles")]
    public sealed class WorldIconStyleSet : ScriptableObject
    {
        [Serializable]
        public struct Style
        {
            public WorldIconType type;
            public Sprite glyph;
            [Tooltip("Glyph colour.")] public Color glyphColor;
            [Tooltip("Disc behind the glyph.")] public Color background;
            [Tooltip("Soft halo behind the disc; leave off for informational icons.")] public bool glow;
            [Tooltip("Gentle scale pulse. Use only for icons that need the player now.")] public bool pulse;
            [Tooltip("Receives taps. Keep informational icons non-clickable so taps reach the 3D map.")] public bool clickable;
            [Tooltip("Pixel size on screen at scale 1.")] [Min(16f)] public float pixelSize;
        }

        public Style[] styles = new Style[0];

        [NonSerialized] private Style[] _byType;

        public Style Get(WorldIconType type)
        {
            if (_byType == null) Build();
            int i = (int)type;
            return i < _byType.Length ? _byType[i] : default(Style);
        }

        private void OnEnable() { _byType = null; }

        private void Build()
        {
            _byType = new Style[256];
            for (int i = 0; i < styles.Length; i++) _byType[(int)styles[i].type] = styles[i];
        }

        /// <summary>Fills the asset with the RailTrack palette defaults (sprites still need assigning).</summary>
        [ContextMenu("Reset To Palette Defaults")]
        private void ResetToDefaults()
        {
            styles = new[]
            {
                Action(WorldIconType.NeedsPlatform), Action(WorldIconType.ServiceRefuel),
                Action(WorldIconType.ServiceClean), Action(WorldIconType.ServiceLoad), Action(WorldIconType.NeedsRepair),
                new Style { type = WorldIconType.ReadyToDepart, glyphColor = Theme.RailTrackPalette.White, background = Theme.RailTrackPalette.Success, glow = true, pulse = false, clickable = true, pixelSize = 64f },
                Info(WorldIconType.ServiceInProgress), Info(WorldIconType.WaitingForTrack), Info(WorldIconType.Locked), Info(WorldIconType.Overcrowded),
            };
            _byType = null;
        }

        private static Style Action(WorldIconType t)
        {
            return new Style { type = t, glyphColor = Theme.RailTrackPalette.Navy900, background = Theme.RailTrackPalette.Yellow500, glow = true, pulse = true, clickable = true, pixelSize = 64f };
        }

        private static Style Info(WorldIconType t)
        {
            return new Style { type = t, glyphColor = Theme.RailTrackPalette.White, background = Theme.RailTrackPalette.Navy700, glow = false, pulse = false, clickable = false, pixelSize = 48f };
        }
    }
}
