using System;
using System.Collections.Generic;
using ThaiRail.Simulation.Hlp;

namespace ThaiRail.Scenery
{
    /// <summary>Where a signal's lamps are, for the runner to light by aspect (web coordinates).</summary>
    public struct SignalLamps { public string id; public V3 red, yellow, green; public bool hasYellow; }

    /// <summary>
    /// Static 3D scene of Hua Lamphong (Krungthep station), from the interlocking graph: track bed along every edge,
    /// eight island platforms, the concourse and buffers, the arched trainshed, the head house with its barrel vault,
    /// great arched window, clock and colonnade, the forecourt fountain, Rama IV road, the khlong and the city.
    /// Port of tBuildScene (hlp_engine.js) and the static part of tBeautify (hlp_scenery.js); traffic, boats, crowds
    /// and service vehicles are animated in the web build and not part of this model.
    /// </summary>
    public sealed class HlpSceneModel : SceneModel
    {
        public readonly List<SignalLamps> Signals = new List<SignalLamps>();
        readonly HlpGraph G;
        readonly Random rng = new Random(1916);   // opened 25 June 2459 BE (1916)

        static readonly Rgba Ground = new Rgba(0xDCD1B8), Ballast = new Rgba(0xA79F92), Sleeper = new Rgba(0x6B5646), Rail = new Rgba(0x59626e),
            Plat = new Rgba(0xD9DEE5), Edge = new Rgba(0xF1C232), Buffer = new Rgba(0xD33B3B), Water = new Rgba(0x4E93C2), Dark = new Rgba(0x2B313A),
            Building = new Rgba(0xEFE3C8), BuildRoof = new Rgba(0x9A6B4F), Rib = new Rgba(0xC9CED6), GlassRoof = new Rgba(0xD4E4F4, 0.22f),
            Glass = new Rgba(0x8FB4D8), White = new Rgba(0xFBF7EC), Stone = new Rgba(0xEFE3C8), StoneDk = new Rgba(0xD9C9A6), Trim = new Rgba(0xC9B48A),
            VaultCol = new Rgba(0xD8C7A0), Win = new Rgba(0x2A3A52), Plaza = new Rgba(0xE6DCC6), Grass = new Rgba(0x7FB069), Road = new Rgba(0x4A4F57),
            Dash = new Rgba(0xF2F2E8), Trunk = new Rgba(0x6B4F3A);

        public HlpSceneModel(HlpGraph g)
        {
            G = g; CenterX = 300; Deck = 0;
            Build();
        }
        double R() { return rng.NextDouble(); }
        static V3 P(double x, double y, double z) { return new V3(x, y, z); }
        void Bx(double w, double h, double d, Rgba c, double x, double y, double z, double yaw = 0) { Opaque.Box(P(x, y, z), w, h, d, c, yaw); }
        void Label(string t, string sub, double x, double y, double z, float width) { Labels.Add(new SceneLabel { title = t, sub = sub, at = P(x, y, z), width = width }); }

        void Build()
        {
            const double cz = 42.75;
            Bx(2400, 2, 800, Ground, 450, -1, 45);
            Opaque.TopQuad(P(-150, 0.05, 45), 26, 800, Water);

            // track bed along every edge of the interlocking graph
            foreach (var e in G.edges)
            {
                double yaw = Math.Atan2(e.bx - e.ax, e.bz - e.az), mx = (e.ax + e.bx) / 2, mz = (e.az + e.bz) / 2, nx = -(e.bz - e.az) / e.len, nz = (e.bx - e.ax) / e.len;
                Bx(3.4, 0.3, e.len + 0.6, Ballast, mx, 0.15, mz, yaw);
                foreach (var o in new[] { -0.52, 0.52 }) Bx(0.09, 0.14, e.len + 0.05, Rail, mx + nx * o, 0.47, mz + nz * o, yaw);
                int n = (int)Math.Floor(e.len / 1.1);
                for (int j = 0; j < n; j++)
                {
                    double t = (j + 0.5) * 1.1 / e.len;
                    Opaque.TopQuad(P(e.ax + (e.bx - e.ax) * t, 0.39, e.az + (e.bz - e.az) * t), 1.9, 0.25, Sleeper, yaw);
                }
            }
            // eight island platforms, the concourse and the buffers
            foreach (var z in G.file.platformsZ)
            {
                double w = z < 0 || z > 86 ? 5 : 5.6;
                Bx(236, 1.0, w, Plat, 154, 0.5, z);
                foreach (var sd in new[] { -1, 1 }) Opaque.TopQuad(P(154, 1.03, z + sd * (w / 2 - 0.3)), 236, 0.35, Edge);
                for (double x = 46; x <= 262; x += 36) Lamps.Add(P(x, 6.5, z));
            }
            Bx(26, 1.0, 112, Plat, -47, 0.5, 42.75);
            for (int i = 1; i <= 14; i++)
            {
                double z = G.file.trackZ[i - 1];
                Bx(1.2, 1.5, 2.6, Buffer, -29.4, 0.9, z);
                Label(i.ToString(), "", -22, 5, z, 5);
            }
            // arched trainshed: glass vault with steel ribs every 25 m, low side walls
            const double Rs = 52;
            for (int i = 0; i < 28; i++)
            {
                double a = Math.PI * i / 28, b = Math.PI * (i + 1) / 28, m = (a + b) / 2;
                V3 pa = P(0, 0.45 * Rs * Math.Sin(a), Rs * Math.Cos(a)), pb = P(0, 0.45 * Rs * Math.Sin(b), Rs * Math.Cos(b)), X = P(100, 0, 0), c = P(150, 2, cz);
                Transparent.QuadTwoSided(c + pa - X, c + pb - X, c + pb + X, c + pa + X, P(0, Math.Sin(m), Math.Cos(m)), GlassRoof);
            }
            for (double x = 50; x <= 250; x += 25) Opaque.ArcYZ(P(x, 2, cz), Rs, 0.45 * Rs, 0.22, 28, Rib);
            foreach (var z in new[] { -9.3, 94.8 }) Bx(200, 2.2, 0.6, Rib, 150, 1.1, z);
            Label("สถานีกรุงเทพ", "หัวลำโพง", -78, 42, cz, 40);

            HeadHouse(cz);
            Forecourt(cz);
            Signals_(cz);
            City();
        }

        void HeadHouse(double cz)
        {
            Bx(36, 16, 124, Building, -78, 8, cz); Bx(37, 1.2, 125, BuildRoof, -78, 16.6, cz);
            Opaque.DiscX(P(-59.9, 4, cz), 15, 20, Glass, false, 0, Math.PI);     // arched opening to the concourse
            Bx(10, 8, 10, Building, -78, 20.6, cz);
            Opaque.DiscX(P(-72.9, 21, cz), 3, 24, White, false);
            // main hall barrel vault and the great arched window, the station's signature front
            Opaque.Cylinder(P(-78, 16.6, cz), 17, 17, 34, 32, VaultCol, MeshData.Axis.X);
            for (double x = -94; x <= -62; x += 8) Opaque.ArcYZ(P(x, 16.6, cz), 17.25, 17.25, 0.35, 24, Trim);
            Opaque.DiscX(P(-95.15, 16.6, cz), 14.6, 24, Glass, true, 0, Math.PI);
            Opaque.ArcYZ(P(-95.3, 16.6, cz), 15.2, 15.2, 0.7, 24, Stone);
            for (int k = -3; k <= 3; k++)
            {
                double h = 14.6 * Math.Cos(Math.Asin(Math.Min(0.99, Math.Abs(k) * 4.2 / 14.6)));
                Bx(0.25, h, 0.3, Trim, -95.05, 16.6 + h / 2, cz + k * 4.2);
            }
            Opaque.DiscX(P(-94.9, 25.5, cz), 3.1, 24, White, true);             // clock in the arch
            Bx(0.12, 1.8, 0.32, Dark, -94.8, 26.4, cz); Bx(0.12, 0.32, 2.6, Dark, -94.8, 25.5, cz + 1.3);
            // colonnade, entablature and steps
            for (int k = -4; k <= 4; k++) if (k != 0) Opaque.Cylinder(P(-98, 5.8, cz + k * 3.6), 0.85, 0.95, 11.6, 12, Stone);
            Bx(3.6, 1.8, 33, Stone, -98, 12.5, cz); Bx(3.8, 0.5, 34, StoneDk, -98, 13.6, cz);
            for (int i = 0; i < 3; i++) Bx(2, 0.32, 36 - i * 2, StoneDk, -100.4 + i * 1.4, 0.16 + i * 0.32, cz);
            // wing windows, cornices, corner pavilions with pyramid roofs
            foreach (var side in new[] { -1, 1 }) for (double z = 22; z <= 58; z += 4.5) foreach (var y in new[] { 4.6, 10.2 }) Bx(0.2, 3.3, 2.2, Win, -96.05, y, cz + side * z);
            foreach (var y in new[] { 7.6, 13.6, 16.2 }) Bx(0.8, 0.45, 124.5, Trim, -96.2, y, cz);
            foreach (var side in new[] { -1, 1 })
            {
                Bx(14, 20, 12, Stone, -84, 10, cz + side * 58);
                Opaque.Cylinder(P(-84, 23, cz + side * 58), 0, 9.4, 6, 4, BuildRoof, MeshData.Axis.Y, false, Math.PI / 4);
                Opaque.DiscX(P(-91.05, 8, cz + side * 58), 3.2, 12, Glass, true, 0, Math.PI);
            }
        }

        void Forecourt(double cz)
        {
            Bx(32, 0.3, 126, Plaza, -112, 0.15, cz);
            foreach (var side in new[] { -1, 1 }) Bx(20, 0.4, 30, Grass, -113, 0.2, cz + side * 36);
            Opaque.Cylinder(P(-112, 0.55, cz), 7.2, 7.6, 1.1, 32, StoneDk);
            Opaque.Cylinder(P(-112, 1.07, cz), 6.7, 6.7, 0.02, 32, new Rgba(0x4FA3D9));
            Opaque.Cylinder(P(-112, 1.2, cz), 1.4, 1.8, 2.4, 16, Stone);
            Opaque.Cylinder(P(-112, 3.4, cz), 0.7, 0.9, 2.2, 14, Stone);          // decorative fountain column (not verified against the real forecourt)
            // Thai flags (five horizontal stripes, red-white-blue-white-red)
            var stripes = new[] { new Rgba(0xA51931), new Rgba(0xF4F5F8), new Rgba(0x2D2A4A), new Rgba(0xF4F5F8), new Rgba(0xA51931) };
            var hs = new[] { 4 / 6.0, 4 / 6.0, 4 / 3.0, 4 / 6.0, 4 / 6.0 };
            foreach (var z in new[] { cz - 22, cz + 22 })
            {
                Opaque.Cylinder(P(-122, 8, z), 0.15, 0.2, 16, 8, Rib);
                double top = 16;
                for (int i = 0; i < 5; i++) { double y1 = top - hs[i]; Opaque.QuadTwoSided(P(-122, y1, z - 6.1), P(-122, y1, z - 0.1), P(-122, top, z - 0.1), P(-122, top, z - 6.1), P(1, 0, 0), stripes[i]); top = y1; }
            }
            // Rama IV / Rong Mueang road, Khlong Phadung Krung Kasem and its banks
            Bx(9, 0.2, 520, Road, -132.5, 0.1, 80);
            for (int i = 0; i < 60; i++) Opaque.TopQuad(P(-132.5, 0.23, -175 + i * 8.6), 0.25, 4, Dash);
            Opaque.TopQuad(P(-150, 0.22, 45), 24, 800, Water);
            foreach (var x in new[] { -137.6, -162.4 }) Bx(1.2, 0.7, 800, StoneDk, x, 0.35, 45);
            // rain trees and palms along the forecourt and the far bank
            var tp = new List<double[]>();
            for (int z = -16; z <= 102; z += 11) { tp.Add(new double[] { -126, z, z % 22 != 0 ? 1 : 0 }); tp.Add(new double[] { -170, z * 1.6 - 30, 0 }); }
            for (int z = -60; z <= 150; z += 18) tp.Add(new double[] { -178, z, 0 });
            Rgba g1 = new Rgba(0x4E8B3A), g2 = new Rgba(0x6FA34B), g3 = new Rgba(0x3C7A35);
            for (int i = 0; i < tp.Count; i++)
            {
                bool palm = tp[i][2] > 0; double h = palm ? 9 + R() * 3 : 4 + R() * 2, x = tp[i][0], z = tp[i][1];
                Opaque.Cylinder(P(x, h / 2, z), 0.25, 0.4, h, 6, Trunk, MeshData.Axis.Y, true);
                if (palm) Opaque.Blob(P(x, h + 0.4, z), 3.2, 1.1, 3.2, g3);
                else { double s = 3.4 + R() * 1.8; Opaque.Blob(P(x, h + 1.6, z), s * 1.3, s * 0.75, s * 1.3, i % 2 == 1 ? g1 : g2); }
            }
        }

        void Signals_(double cz)
        {
            // home signal H on the approach (red / yellow / green) and starting signals S1..S14 at the platform ends
            Bx(0.35, 7, 0.35, Dark, 642, 3.5, 36.8); Bx(0.7, 2.8, 1.0, Dark, 642, 7.8, 36.8);
            Signals.Add(new SignalLamps { id = "HA", red = P(641.55, 8.7, 36.8), yellow = P(641.55, 7.8, 36.8), green = P(641.55, 6.9, 36.8), hasYellow = true });
            Label("H", "สัญญาณเข้า", 642, 14, 36.8, 14);
            for (int i = 1; i <= 14; i++)
            {
                double z = G.file.trackZ[i - 1] - 1.95;
                Bx(0.5, 1.1, 0.5, Dark, 281, 0.85, z);
                Signals.Add(new SignalLamps { id = "ST" + i, red = P(280.7, 1.15, z), green = P(280.7, 0.65, z) });
            }
        }

        void City()
        {
            var cc = new[] { 0xffffff, 0xdfe8f7, 0xeef1f5, 0xcfdcf2, 0xf6efe4 };
            int ci = 0;
            for (int n = 0; n < 400 && ci < 170; n++)
            {
                double x = -260 + R() * 1150; bool side = R() < 0.5; double z = side ? -70 - R() * 220 : 150 + R() * 220;
                if (x > -175 && x < -128) continue;
                double w = 12 + R() * 26, d = 12 + R() * 26, h = 6 + R() * R() * 55;
                Bx(w, h, d, new Rgba(cc[(int)(R() * cc.Length)]), x, h / 2, z); ci++;
            }
        }
    }
}
