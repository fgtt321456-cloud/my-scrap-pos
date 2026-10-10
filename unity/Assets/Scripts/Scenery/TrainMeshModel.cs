using System;
using ThaiRail.Data;

namespace ThaiRail.Scenery
{
    /// <summary>
    /// Simple low-poly car built from a rolling_stock.json model: length, kind and livery colours.
    /// Placeholder art until real prefabs are assigned in the RollingStockCatalog (same proportions as the web
    /// build's stnVehGeo). Web coordinates, car along +z (front at +z), rail head at y = 0.
    /// </summary>
    public static class TrainMeshModel
    {
        static readonly Rgba Under = new Rgba(0x2B313A), Bogie = new Rgba(0x1F242B), WindowBand = new Rgba(0x203047), Glass = new Rgba(0x1A2433);

        public static MeshData Build(TrainModel m, int variant = 0)
        {
            var g = new MeshData();
            string kind = m != null ? m.kind : "car";
            double L = Math.Max(10, (m != null ? m.len : 20) - 0.6);
            Rgba body = Rgba.Parse(m != null && m.livery != null ? m.livery.body : null, 0xF2F3F5), low = Rgba.Parse(m != null && m.livery != null ? m.livery.low : null, 0x1F2F5A),
                 line = Rgba.Parse(m != null && m.livery != null ? m.livery.line : null, 0xF4F1E6), roof = Rgba.Parse(m != null && m.livery != null ? m.livery.roof : null, 0x8F99A6);

            g.Box(new V3(0, 1.05, 0), 2.5, 0.7, L - 0.4, Under);
            foreach (var z in new[] { -L * 0.34, L * 0.34 }) g.Box(new V3(0, 0.6, z), 2.2, 0.75, 2.8, Bogie);

            if (kind == "flat")
            {
                g.Box(new V3(0, 1.55, 0), 2.6, 0.25, L, new Rgba(0x7C8693));
                int[] a = { 0x13294B, 0xF5B400, 0xC62F3C, 0x2F6BFF }, b = { 0x8A96A8, 0x14A37F, 0xE2772B };
                g.Box(new V3(0, 2.95, -L / 4), 2.5, 2.5, L / 2 - 0.6, new Rgba(a[variant % a.Length]));
                g.Box(new V3(0, 2.95, L / 4), 2.5, 2.5, L / 2 - 0.6, new Rgba(b[variant % b.Length]));
                return g;
            }
            if (kind == "hood")   // GE UM12C: narrow hood with the cab towards one end
            {
                g.Box(new V3(0, 1.6, 0), 2.8, 0.4, L, low);
                g.Box(new V3(0, 2.9, -1.5), 1.9, 2.2, L - 6, body);
                g.Box(new V3(0, 3.3, L / 2 - 3.6), 2.7, 3.0, 3.2, body);
                g.Box(new V3(0, 4.0, L / 2 - 3.6), 2.72, 0.8, 3.22, Glass);
                g.Box(new V3(0, 4.9, L / 2 - 3.6), 2.6, 0.25, 3.0, roof);
                g.Box(new V3(0, 2.2, L / 2 - 1), 2.0, 1.4, 1.6, body);
                return g;
            }
            bool loco = kind == "loco", cab = loco || kind == "dmu" || kind == "emu";
            g.Box(new V3(0, 2.9, 0), 2.85, 3.0, L, body);
            g.Box(new V3(0, 1.75, 0), 2.88, loco ? 0.9 : 0.4, L + 0.02, low);
            g.Box(new V3(0, 2.15, 0), 2.88, 0.14, L + 0.02, line);
            if (!loco) g.Box(new V3(0, 3.3, 0), 2.88, 0.7, L - 3, WindowBand);
            g.Box(new V3(0, 4.55, 0), 2.6, 0.4, L - 0.4, roof);
            if (cab)
            {
                g.Box(new V3(0, 3.5, L / 2 + 0.02), 2.4, 0.9, 0.1, Glass);                  // windscreen
                g.Box(new V3(0, 2.0, L / 2 + 0.05), 2.6, 0.5, 0.12, low);                  // nose band
                if (loco) g.Box(new V3(0, 3.5, -L / 2 - 0.02), 2.4, 0.9, 0.1, Glass);     // locomotives have a cab at both ends
            }
            return g;
        }
    }
}
