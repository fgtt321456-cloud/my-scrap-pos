using UnityEngine;

namespace ThaiRail.Theme
{
    /// <summary>
    /// RailTrack colour system. One source of truth for UI (navy/white/grey + yellow for action only)
    /// and the 3D world (warm terrain so white buildings stop blending into the ground).
    ///
    /// Rule of thumb: if the player does not need to act within a few seconds, it is NOT yellow.
    /// </summary>
    public static class RailTrackPalette
    {
        static Color32 H(uint rgb) { return new Color32((byte)(rgb >> 16), (byte)(rgb >> 8), (byte)rgb, 255); }

        // ---------------- UI: chrome and text
        public static readonly Color32 Navy900 = H(0x0F2240);   // top bar, toolbar, primary text on light
        public static readonly Color32 Navy700 = H(0x1B355E);   // selected tab, informational icon discs
        public static readonly Color32 Navy500 = H(0x2E4F80);   // secondary buttons, links
        public static readonly Color32 Navy300 = H(0x7F95B8);   // muted text on navy
        public static readonly Color32 Navy100 = H(0xE3E9F3);   // hover / selected rows on white
        public static readonly Color32 White = H(0xFFFFFF);     // panels
        public static readonly Color32 Grey50 = H(0xF4F6F9);    // panel insets, input fields
        public static readonly Color32 Grey200 = H(0xD9DFE8);   // dividers, borders
        public static readonly Color32 Grey500 = H(0x6B7A90);   // secondary text (4.6:1 on white)
        public static readonly Color32 Ink = H(0x13233D);       // body text

        // ---------------- UI: action + status (yellow = needs the player now)
        public static readonly Color32 Yellow500 = H(0xFFC20E); // Dispatch button, "train arrived", action icons
        public static readonly Color32 Yellow600 = H(0xE0A800); // pressed state
        public static readonly Color32 Yellow100 = H(0xFFF3C4); // tutorial spotlight halo, action row tint
        public static readonly Color32 Success = H(0x1FA463);   // ready to depart, contract done
        public static readonly Color32 Danger = H(0xE5484D);    // breakdown, red signal, occupied track
        public static readonly Color32 Info = H(0x3A7BD5);      // selection ring, route preview in day light

        // ---------------- UI: dark mode
        public static readonly Color32 DarkBg = H(0x0A1426);
        public static readonly Color32 DarkPanel = H(0x111E36);
        public static readonly Color32 DarkLine = H(0x23345A);
        public static readonly Color32 DarkText = H(0xE6ECF5);
        public static readonly Color32 DarkMuted = H(0x93A3BC);
        public static readonly Color32 DarkYellow = H(0xFFC929);

        // ---------------- 3D world (day). Ground is warm beige; man-made objects are darker or cooler.
        public static readonly Color32 Terrain = H(0xE8E0CC);
        public static readonly Color32 TerrainShade = H(0xD8CDB4);
        public static readonly Color32 Grass = H(0xC5D6A0);
        public static readonly Color32 GrassDeep = H(0x9DBB78);
        public static readonly Color32 TreeLight = H(0x8DBE6A);
        public static readonly Color32 Tree = H(0x6FA35A);
        public static readonly Color32 Water = H(0x8FC1E3);
        public static readonly Color32 Sea = H(0x6FA8D6);
        public static readonly Color32 Ballast = H(0x8C8476);
        public static readonly Color32 Sleeper = H(0x5B4636);
        public static readonly Color32 Rail = H(0x3A3F47);
        public static readonly Color32 Platform = H(0xC9D0DA);
        public static readonly Color32 PlatformEdge = H(0xFFC20E); // safety line: the one yellow that is always on
        public static readonly Color32 StationRoof = H(0x1B355E);
        public static readonly Color32 Wall = H(0xF6F1E7);
        public static readonly Color32 HouseWarm = H(0xEFE3CF);
        public static readonly Color32 HouseCool = H(0xD7DFEA);
        public static readonly Color32 RoofTerracotta = H(0xB8654A);
        public static readonly Color32 RoofSlate = H(0x5E6F86);

        // ---------------- 3D lighting keys for the day/night cycle (sky / sun tint)
        public static readonly Color32 SkyDawn = H(0xF6C89A);  // 06:00
        public static readonly Color32 SkyDay = H(0xDDE7F2);   // 12:00
        public static readonly Color32 SkyDusk = H(0xE9A07A);  // 18:00
        public static readonly Color32 SkyNight = H(0x0B1428); // 21:00+
        public static readonly Color32 SunDawn = H(0xFFB878);
        public static readonly Color32 SunDay = H(0xFFF6E8);
        public static readonly Color32 AmbientNight = H(0x1E2A4A);
        public static readonly Color32 LampGlow = H(0xFFD27A);   // street lights, emissive, blooms at night
        public static readonly Color32 WindowGlow = H(0xFFC768);

        // ---------------- fleet identity (2D map dots, list accents)
        public static readonly Color32 FleetThn = H(0xE8B21D);
        public static readonly Color32 FleetAd24c = H(0xE2772B);
        public static readonly Color32 FleetAsr = H(0xC62F3C);
        public static readonly Color32 FleetQsy = H(0x2F6BFF);
    }
}
