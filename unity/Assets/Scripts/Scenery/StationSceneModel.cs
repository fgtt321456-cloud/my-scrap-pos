using System;
using System.Collections.Generic;
using System.Linq;
using ThaiRail.Data;
using ThaiRail.Simulation;

namespace ThaiRail.Scenery
{
    /// <summary>A world-space label (station sign, track number, landmark) in web coordinates.</summary>
    public struct SceneLabel { public string title, sub; public V3 at; public float width; }

    /// <summary>Static scenery of one station: an opaque and a transparent layer (2 draw calls) plus labels and lamp posts.</summary>
    public abstract class SceneModel
    {
        public readonly MeshData Opaque = new MeshData(), Transparent = new MeshData();
        public readonly List<SceneLabel> Labels = new List<SceneLabel>();
        public readonly List<V3> Lamps = new List<V3>();
        public double CenterX, Deck;
    }

    /// <summary>
    /// The static 3D scene of a timetable station, generated from its StationDef: tracks, platforms, canopies,
    /// the building in the station's real style, and its landmarks. Port of stnBuild / railInstances / build* /
    /// stnExtras in railway/src/stations.js. Pure C#: <see cref="StationSceneBuilder"/> turns it into Unity meshes.
    /// Two layers keep it at two draw calls: <see cref="Opaque"/> and <see cref="Transparent"/> (glass roofs, canopies).
    /// </summary>
    public sealed class StationSceneModel : SceneModel
    {

        // palette (SM in stations.js)
        static readonly Rgba Ground = new Rgba(0xDCD1B8), Ballast = new Rgba(0xA79F92), Sleeper = new Rgba(0x6B5646), Rail = new Rgba(0x59626e),
            Plat = new Rgba(0xD9DEE5), Edge = new Rgba(0xF1C232), Buffer = new Rgba(0xD33B3B), White = new Rgba(0xF7F3EA), Cream = new Rgba(0xF0E4C6),
            Tile = new Rgba(0x8A3B2A), TileO = new Rgba(0xC2622D), Wood = new Rgba(0x7A4B2A), Dark = new Rgba(0x2B313A), Glass = new Rgba(0x86A9CC),
            GlassRoof = new Rgba(0xD4E4F4, 0.22f), Steel = new Rgba(0x8A96A8), Concrete = new Rgba(0xC8C4BC), Water = new Rgba(0x5E8FA8),
            Red = new Rgba(0xC8102E), BlueSign = new Rgba(0x1F4FD1), Yellow = new Rgba(0xF5B400), ClockFace = new Rgba(0xFBF7EC);

        readonly StationDef d;
        readonly StationGeometry geo;
        readonly Random rng;

        public StationSceneModel(StationDef def, StationGeometry geometry = null)
        {
            d = def; geo = geometry ?? new StationGeometry(def);
            int seed = 17; foreach (char ch in def.id) seed = seed * 31 + ch;   // same scenery every visit
            rng = new Random(seed);
            Build();
        }

        double R() { return rng.NextDouble(); }
        static V3 P(double x, double y, double z) { return new V3(x, y, z); }
        void Bx(double w, double h, double dd, Rgba c, double x, double y, double z, double yaw = 0) { Opaque.Box(P(x, y, z), w, h, dd, c, yaw); }
        void Label(string t, string sub, double x, double y, double z, float width) { Labels.Add(new SceneLabel { title = t, sub = sub, at = P(x, y, z), width = width }); }
        double MainZ() { var t = d.tracks.Where(x => !x.siding).ToArray(); return t.Length > 0 ? t.Average(x => x.z) : 0; }
        double MaxTrackZ() { return d.tracks.Max(t => t.z); }

        void Build()
        {
            double y = d.deck; Deck = y; CenterX = (d.P0 + d.P1) / 2;
            Opaque.Box(P(CenterX, -1, 40), 3200, 2, 1400, Ground);

            // tracks: each one inside the throats, then the main lines once
            var paths = new List<TrackPath>();
            foreach (var t in d.tracks)
            {
                var full = geo.PathFor(t.n, Side.East);
                paths.Add(new TrackPath(full.pts.Where(p => p.x <= d.P1 + StationGeometry.Throat + 0.01 && (d.IsTerminus || p.x >= d.P0 - StationGeometry.Throat - 0.01)).ToArray()));
            }
            double zm = MainZ();
            paths.Add(new TrackPath(new[] { new P3(d.P1 + 170, y, zm), new P3(d.P1 + 900, y, zm) }));
            if (!d.IsTerminus) paths.Add(new TrackPath(new[] { new P3(d.P0 - 900, y, zm), new P3(d.P0 - 170, y, zm) }));
            if (d.split) paths.Add(new TrackPath(new[] { new P3(d.P1 + 260, y, zm), new P3(d.P1 + 420, y, zm + 40), new P3(d.P1 + 900, y, zm + 160) }));
            if (d.red != null) foreach (var z in d.red) paths.Add(new TrackPath(new[] { new P3(-900, y, z), new P3(900, y, z) }));
            if (d.hsr != null) foreach (var z in d.hsr) paths.Add(new TrackPath(new[] { new P3(-260, y, z), new P3(260, y, z) }));
            for (int i = 0; i < paths.Count; i++) Rails(paths[i], i);

            if (y > 0) Viaduct(y, zm);
            Platforms(y);
            foreach (var t in d.tracks)
            {
                if (d.IsTerminus) Bx(1.2, 1.5, 2.6, Buffer, d.P0 - 0.6, y + 0.9, t.z);
                Label(t.n.ToString(), "", d.IsTerminus ? d.P0 + 12 : d.P1 - 12, y + 5, t.z, 5);
            }
            switch (d.style)
            {
                case "lanna": Lanna(); break;
                case "modern": Modern(); break;
                case "midcentury": Mid(); break;
                case "colonial": Colonial(); break;
                case "grand": Grand(); break;
            }
            Extras(zm);
            if (!string.IsNullOrEmpty(d.endEast)) Label(d.endEast, "", d.P1 + 260, y + 14, zm, 34);
            if (!string.IsNullOrEmpty(d.endWest)) Label(d.endWest, "", d.P0 - 260, y + 14, zm, 34);
        }

        void Rails(TrackPath Pth, int pi)
        {
            for (int j = 0; j < Pth.pts.Length - 1; j++)
            {
                P3 a = Pth.pts[j], b = Pth.pts[j + 1]; double dx = b.x - a.x, dz = b.z - a.z, L = Math.Max(1e-6, Math.Sqrt(dx * dx + dz * dz)), nx = -dz / L, nz = dx / L, yaw = Math.Atan2(dx, dz);
                double mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
                Opaque.Box(P(mx, a.y + 0.15 + pi * 0.002, mz), 3.4, 0.3, L + 0.4, Ballast, yaw);
                foreach (var o in new[] { -0.52, 0.52 }) Opaque.Box(P(mx + nx * o, a.y + 0.47, mz + nz * o), 0.09, 0.14, L + 0.05, Rail, yaw);
            }
            int n = (int)Math.Floor(Pth.Len / 1.2);
            for (int j = 0; j < n; j++)
            {
                double dx, dz; var p = Pth.At((j + 0.5) * 1.2, out dx, out dz);
                Opaque.TopQuad(P(p.x, p.y + 0.39, p.z), 1.9, 0.25, Sleeper, Math.Atan2(dx, dz));
            }
        }

        void Viaduct(double y, double zm)
        {
            for (int x = -900; x <= 900; x += 30) if (x < -300 || x > 300) Bx(6, y - 0.3, 5, Concrete, x, (y - 0.3) / 2, zm);
            Bx(520, 0.6, 12, Concrete, -640, y - 0.1, zm); Bx(520, 0.6, 12, Concrete, 640, y - 0.1, zm);
            double za = d.tracks.Min(t => t.z) - 4, zb = MaxTrackZ() + 4;
            foreach (var sx in new[] { -1, 1 })
            {
                Bx(100, 0.6, zb - za, Concrete, sx * 340, y - 0.1, (za + zb) / 2);
                for (int x = 300; x <= 390; x += 30) for (double z = za + 4; z < zb; z += 20) Bx(3, y - 0.3, 3, Concrete, sx * x, (y - 0.3) / 2, z);
            }
        }

        void Platforms(double y)
        {
            double pl0 = d.IsTerminus ? d.P0 - 2 : d.P0, pl1 = d.P1;
            foreach (var p in d.platforms)
            {
                Bx(pl1 - pl0, 1, p.w, Plat, (pl0 + pl1) / 2, y + 0.5, p.z);
                foreach (var sd in new[] { -1, 1 }) Opaque.TopQuad(P((pl0 + pl1) / 2, y + 1.03, p.z + sd * (p.w / 2 - 0.3)), pl1 - pl0, 0.35, Edge);
                if (y == 0 && p.w >= 5)
                {
                    double len = Math.Min(180, pl1 - pl0 - 20), cx = d.IsTerminus ? pl0 + len / 2 + 6 : (pl0 + pl1) / 2;
                    var key = d.style == "lanna" ? Tile : d.style == "colonial" ? TileO : Steel; key.a = 0.5f;
                    if (d.style == "lanna") Transparent.Gable(P(cx, 5.2, p.z), len, p.w + 1.6, 1.6, key);
                    else Transparent.Box(P(cx, 5.2, p.z), len, 0.35, p.w + 1.2, key);
                    for (double x = cx - len / 2 + 6; x < cx + len / 2; x += 18) Bx(0.3, 4.2, 0.3, Steel, x, 3.1, p.z);
                }
                for (double x = pl0 + 10; x <= pl1 - 10; x += 34) { Lamps.Add(P(x, 6.5 + y, p.z)); Bx(0.16, 6.2, 0.16, Dark, x, y + 3.1 + 1, p.z); Bx(0.7, 0.25, 0.4, Dark, x, y + 7.2, p.z); }
            }
        }

        // ---------- buildings by real style ----------
        void Lanna()   // Chiang Mai: single-storey hall with layered Thai gable roofs and a porch
        {
            double z = d.bz, cx = 150;
            Bx(40, 7, d.bd, White, cx, 3.5, z);
            Opaque.Gable(P(cx, 7, z), 46, d.bd + 4, 7, Tile); Opaque.Gable(P(cx, 11.5, z), 30, d.bd - 4, 5, Tile);
            foreach (var s in new[] { -1, 1 })
            {
                Bx(30, 5.2, d.bd - 4, White, cx + s * 36, 2.6, z);
                Opaque.Gable(P(cx + s * 36, 5.2, z), 34, d.bd, 4.6, Tile);
                Opaque.Cylinder(P(cx + s * 23, 13.4, z - d.bd / 2 + 2), 0, 0.5, 2.6, 6, Yellow);
            }
            for (int k = -3; k <= 3; k++) Opaque.Cylinder(P(cx + k * 4, 3, z - d.bd / 2 - 4), 0.45, 0.5, 6, 10, White);
            Opaque.Gable(P(cx, 6, z - d.bd / 2 - 4), 30, 9, 3.4, Tile);
            for (int k = -6; k <= 6; k++) if (Math.Abs(k) > 1) Bx(2.2, 2.6, 0.2, Glass, cx + k * 5.6, 3.4, z - d.bd / 2 - 0.05);
            Label("สถานีเชียงใหม่", "CHIANG MAI", cx, 24, z - 6, 30);
        }
        void Modern()   // Nong Khai: modern terminal with a broad canopy and a customs block
        {
            double z = d.bz, cx = -40;
            Bx(d.bw, 6.5, d.bd, Cream, cx, 3.25, z);
            for (int k = 0; k < 12; k++) Bx(4.2, 4.2, 0.2, Glass, cx - d.bw / 2 + 4 + k * 5.6, 3.2, z - d.bd / 2 - 0.05);
            Opaque.Gable(P(cx, 6.5, z), d.bw + 8, d.bd + 10, 6, TileO);
            Bx(d.bw + 30, 0.5, 12, Steel, cx, 6.2, z - d.bd / 2 - 6);
            for (int k = -5; k <= 5; k++) Bx(0.5, 6, 0.5, Steel, cx + k * 9, 3, z - d.bd / 2 - 11.5);
            Label("สถานีหนองคาย", "NONG KHAI", cx, 18, z - 4, 28);
            Bx(26, 5, 14, White, 60, 2.5, z - 2); Opaque.Gable(P(60, 5, z - 2), 28, 16, 3, TileO);
            Label("ด่านพรมแดน", "ตม. · ศุลกากร", 60, 13, z - 2, 16);
        }
        void Mid()   // Ubon Ratchathani: two-storey mid-century concrete hall with a clock tower
        {
            double z = d.bz, cx = 150;
            Bx(d.bw, 10, d.bd, Cream, cx, 5, z);
            foreach (var yy in new[] { 3, 7.6 }) for (int k = 0; k < 14; k++) Bx(4, 2, 0.2, Glass, cx - d.bw / 2 + 4 + k * 6, yy, z - d.bd / 2 - 0.05);
            Bx(d.bw + 3, 0.6, d.bd + 3, Concrete, cx, 10.3, z);
            Bx(9, 20, 9, White, cx, 10, z - d.bd / 2 + 4);
            Opaque.DiscZ(P(cx, 16.5, z - d.bd / 2 - 0.6), 2.6, 24, ClockFace, true);
            Bx(60, 0.45, 8, Concrete, cx, 5, z - d.bd / 2 - 4);
            Label("สถานีอุบลราชธานี", "UBON RATCHATHANI", cx, 26, z - 4, 32);
        }
        void Colonial()   // Hat Yai Junction: two-storey colonial building with arched verandas
        {
            double z = d.bz, cx = 0;
            Bx(d.bw, 11, d.bd, new Rgba(0xEAD9A8), cx, 5.5, z);
            foreach (var yy in new[] { 3.5, 8.3 }) for (int k = 0; k < 18; k++)
            {
                double x = cx - d.bw / 2 + 4 + k * 6;
                Opaque.DiscZ(P(x, yy + 0.6, z - d.bd / 2 - 0.06), 1.7, 8, Dark, true, 0, Math.PI);
                Bx(3.4, 1.2, 0.12, Dark, x, yy, z - d.bd / 2 - 0.06);
            }
            Bx(d.bw + 2, 0.6, d.bd + 2, White, cx, 6.6, z);
            Opaque.Gable(P(cx, 11, z), d.bw + 4, d.bd + 4, 4.5, TileO);
            Opaque.Gable(P(cx, 11, z - d.bd / 2 + 2), 18, 10, 5, White);
            Opaque.DiscZ(P(cx, 13.4, z - d.bd / 2 - 1.2), 1.9, 24, ClockFace, true);
            Label("สถานีชุมทางหาดใหญ่", "HAT YAI JUNCTION", cx, 25, z - 4, 34);
        }
        void Grand()   // Krung Thep Aphiwat: three-level hall, long-distance + Red Line on level 2, vaulted roof
        {
            double y = d.deck, x0 = -300, x1 = 300, z0 = -26, z1 = 196, cx = 0, cz = (z0 + z1) / 2;
            Bx(x1 - x0, y - 0.4, z1 - z0, Concrete, cx, (y - 0.4) / 2, cz);
            Bx(x1 - x0, 0.4, z1 - z0, new Rgba(0xBFC4CC), cx, y - 0.2, cz);
            for (double x = x0; x <= x1; x += 30) foreach (var z in new[] { z0, z1 }) Bx(1.6, 30, 1.6, White, x, 15, z);
            for (double x = x0 + 30; x < x1; x += 60) for (double z = z0 + 26; z < z1; z += 52) Opaque.Cylinder(P(x, y + 11, z), 0.9, 0.9, 22, 10, White);
            for (double z = z0; z < z1; z += 37)
            {
                Vault(cx, 30, z + 18.5, x1 - x0, 18.5, 7.4);
                Bx(x1 - x0, 0.8, 1.2, White, cx, 30, z);
            }
            for (double x = x0 + 20; x < x1; x += 40) Bx(36, 18, 0.4, Glass, x, y + 9, z0 - 0.6);
            Bx(200, 1, 18, White, cx, 8, z0 - 10);
            Label("สถานีกลางกรุงเทพอภิวัฒน์", "KRUNG THEP APHIWAT CENTRAL TERMINAL", cx, 46, z0 - 4, 90);
            Bx(14, 4, 8, BlueSign, -180, 2, z0 - 46); Label("MRT", "บางซื่อ", -180, 9, z0 - 46, 10);
            Label("รถไฟฟ้าสายสีแดง", "ชานชาลา 4 ราง", 230, y + 16, 97, 28);
            Label("รถไฟความเร็วสูง", "10 ชานชาลา · สำรองอนาคต", 230, y + 16, 152, 32);
        }
        /// <summary>Half-elliptic glass vault along x (the web build's scaled open half cylinder).</summary>
        void Vault(double cx, double cy, double cz, double len, double rz, double ry, int seg = 16)
        {
            for (int i = 0; i < seg; i++)
            {
                double a = Math.PI * i / seg, b = Math.PI * (i + 1) / seg, m = (a + b) / 2;
                V3 pa = P(0, ry * Math.Sin(a), rz * Math.Cos(a)), pb = P(0, ry * Math.Sin(b), rz * Math.Cos(b)), X = P(len / 2, 0, 0), c = P(cx, cy, cz);
                Transparent.QuadTwoSided(c + pa - X, c + pb - X, c + pb + X, c + pa + X, P(0, Math.Sin(m), Math.Cos(m)), GlassRoof);
            }
        }

        // ---------- landmarks ----------
        void Extras(double zm)
        {
            var ex = new HashSet<string>(d.extras ?? new string[0]);
            if (ex.Contains("mountains"))
            {
                var g = new[] { new Rgba(0x5E8C4A), new Rgba(0x6E9A56), new Rgba(0x7FA668) };
                for (int i = 0; i < 16; i++) { double h = 60 + R() * 90, r = 70 + R() * 60; Opaque.Cylinder(P(-330 - R() * 220, h / 2 - 4, -260 + i * 40 + R() * 20), 0, r, h, 7, g[i % 3]); }
                Label("ดอยสุเทพ", "ทิศตะวันตก", -420, 140, 40, 24);
            }
            if (ex.Contains("hills")) for (int i = 0; i < 10; i++) { double h = 30 + R() * 40, r = 60 + R() * 40; Opaque.Cylinder(P(-400 + i * 90, h / 2 - 3, 330 + R() * 80), 0, r, h, 7, new Rgba(0x6E9A56)); }
            if (ex.Contains("mekong")) { Opaque.TopQuad(P(d.P1 + 700, 0.1, 0), 420, 1400, Water); Label("แม่น้ำโขง", "MEKONG", d.P1 + 700, 18, -120, 22); }
            if (ex.Contains("bridge"))
            {
                Bx(470, 1.2, 12, Concrete, d.P1 + 700, 3.4, zm);
                for (double x = d.P1 + 480; x <= d.P1 + 920; x += 44) { Bx(3, 3.4, 8, Concrete, x, 1.7, zm); Bx(0.6, 7, 0.6, Steel, x, 7.4, zm - 6); Bx(0.6, 7, 0.6, Steel, x, 7.4, zm + 6); }
                Bx(470, 0.6, 0.6, Steel, d.P1 + 700, 10.6, zm - 6); Bx(470, 0.6, 0.6, Steel, d.P1 + 700, 10.6, zm + 6);
            }
            if (ex.Contains("mun")) { Opaque.TopQuad(P(150, 0.1, 300), 2400, 120, Water); Label("แม่น้ำมูล", "ฝั่งเมืองอุบลฯ", 150, 16, 300, 22); }
            if (ex.Contains("locoshed"))
            {
                double sx = d.IsTerminus ? 120 : -60, sz = MaxTrackZ() + 22;
                Bx(70, 9, 16, new Rgba(0xB7A68A), sx, 4.5, sz); Opaque.Gable(P(sx, 9, sz), 74, 18, 4, Steel);
                Label("โรงรถจักร", "", sx, 18, sz, 14);
            }
            if (ex.Contains("footbridge"))
            {
                var zs = d.platforms.Select(p => (double)p.z).ToArray(); double zMin = zs.Min() - 2, zMax = zs.Max() + 2;
                Bx(4, 0.7, zMax - zMin, Steel, 20, 7.5, (zMin + zMax) / 2);
                Transparent.Box(P(20, 9.2, (zMin + zMax) / 2), 4, 2.6, zMax - zMin, GlassRoof);
                foreach (var z in zs) Bx(3, 7.5, 3, Steel, 20, 3.75, z);
            }
            if (ex.Contains("steam")) Steam(d.id == "UBN" ? 120 : 150, d.bz - d.bd / 2 - 22, d.id == "UBN" ? "NBL หมายเลข 180" : "");
            if (ex.Contains("turntable"))
            {
                double z = MaxTrackZ() + 40;
                Opaque.Cylinder(P(60, 0.1, z), 11, 11, 0.4, 40, Concrete);
                Bx(21, 0.5, 3, Steel, 60, 0.45, z, 0.4);
                Label("วงเวียนกลับรถจักร", "", 60, 8, z, 16);
            }
            if (ex.Contains("songthaew")) for (int i = 0; i < 8; i++) Bx(2, 2, 4.4, Red, 110 + i * 7, 1, d.bz - d.bd / 2 - 24);
            if (ex.Contains("city") || d.id == "KRT")
            {
                var cc = new[] { 0xffffff, 0xdfe8f7, 0xeef1f5, 0xcfdcf2, 0xf6efe4 };
                for (int ci = 0; ci < 90; ci++)
                {
                    double x = -800 + R() * 1600, z = R() < 0.5 ? -170 - R() * 260 : 260 + R() * 240, h = 10 + R() * R() * 110;
                    Bx(18 + R() * 30, h, 18 + R() * 30, new Rgba(cc[ci % 5]), x, h / 2, z);
                }
            }
            if (ex.Contains("trees"))
            {
                var pts = new List<double[]>();
                for (double x = d.P0 - 60; x <= d.P1 + 60; x += 14)
                {
                    pts.Add(new[] { x, d.bz - d.bd / 2 - 30 - R() * 30 });
                    if (R() < 0.6) pts.Add(new[] { x + 5, MaxTrackZ() + 45 + R() * 60 });
                }
                Rgba g1 = new Rgba(0x4E8B3A), g2 = new Rgba(0x6FA34B);
                for (int i = 0; i < pts.Count; i++)
                {
                    double h = 4 + R() * 3, s = 3 + R() * 2, x = pts[i][0], z = pts[i][1];
                    Opaque.Cylinder(P(x, h / 2, z), 0.3, 0.45, h, 6, Wood, MeshData.Axis.Y, true);
                    Opaque.Blob(P(x, h + 1.4, z), s * 1.3, s * 0.8, s * 1.3, i % 2 == 1 ? g1 : g2);
                }
            }
        }
        void Steam(double x, double z, string label)   // preserved steam locomotive on a plinth, turned along x
        {
            Rgba blk = new Rgba(0x1D232B), red = new Rgba(0x8E2B2B);
            const double yaw = Math.PI / 2;
            Func<double, double, double, V3> L = (lx, ly, lz) => P(x, 0, z) + P(lx, ly, lz).Yaw(yaw);
            Opaque.Box(L(0, 0.25, 0), 2.6, 0.5, 16, Concrete, yaw); Opaque.Box(L(0, 2.2, 1.5), 2.2, 2.2, 9, blk, yaw);
            Opaque.Box(L(0, 2.6, -4.4), 2.6, 2.8, 3.2, blk, yaw); Opaque.Box(L(0, 4.1, -4.4), 2.7, 0.3, 3.4, red, yaw);
            Opaque.Cylinder(L(0, 2.6, 1.5), 1.05, 1.05, 9, 16, blk, MeshData.Axis.X);   // boiler along the (turned) length = world x
            Opaque.Cylinder(L(0, 4.1, 5.2), 0.35, 0.45, 1.2, 10, blk);
            foreach (var zz in new[] { -1.6, 0.6, 2.8 }) foreach (var s in new[] { -1, 1 }) Opaque.Cylinder(L(s * 1.05, 1.35, zz), 0.85, 0.85, 0.2, 16, red, MeshData.Axis.Z);
            if (label != "") Label(label, "รถจักรไอน้ำจัดแสดง", x, 11, z, 20);
        }
    }
}
