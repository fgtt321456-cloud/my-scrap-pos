using System;
using System.Collections.Generic;

namespace ThaiRail.Scenery
{
    /// <summary>RGBA colour, 0..1. Hex constructor takes 0xRRGGBB like the web build's materials.</summary>
    public struct Rgba
    {
        public float r, g, b, a;
        public Rgba(int hex, float alpha = 1) { r = ((hex >> 16) & 255) / 255f; g = ((hex >> 8) & 255) / 255f; b = (hex & 255) / 255f; a = alpha; }
        public static Rgba Parse(string css, int fallback)
        {
            if (string.IsNullOrEmpty(css) || css[0] != '#' || css.Length != 7) return new Rgba(fallback);
            int v; return int.TryParse(css.Substring(1), System.Globalization.NumberStyles.HexNumber, null, out v) ? new Rgba(v) : new Rgba(fallback);
        }
    }

    public struct V3
    {
        public double x, y, z;
        public V3(double x, double y, double z) { this.x = x; this.y = y; this.z = z; }
        public static V3 operator +(V3 a, V3 b) { return new V3(a.x + b.x, a.y + b.y, a.z + b.z); }
        public static V3 operator -(V3 a, V3 b) { return new V3(a.x - b.x, a.y - b.y, a.z - b.z); }
        public static V3 operator *(V3 a, double k) { return new V3(a.x * k, a.y * k, a.z * k); }
        public static double Dot(V3 a, V3 b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
        public static V3 Cross(V3 a, V3 b) { return new V3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x); }
        public V3 Normalized { get { double l = Math.Sqrt(x * x + y * y + z * z); return l > 1e-12 ? new V3(x / l, y / l, z / l) : new V3(0, 1, 0); } }
        /// <summary>Rotate about +y by yaw radians, three.js convention (the web build's rotation.y).</summary>
        public V3 Yaw(double yaw) { double c = Math.Cos(yaw), s = Math.Sin(yaw); return new V3(x * c + z * s, y, -x * s + z * c); }
    }

    /// <summary>
    /// Flat-shaded, vertex-coloured triangle soup built in the web build's coordinates (right-handed, as in
    /// railway/src/stations.js), so positions can be compared one to one. <see cref="ToLeftHanded"/> converts for Unity
    /// (z → −z with the winding reversed). Every face is oriented from an outward hint, so callers never think about winding.
    /// </summary>
    public sealed class MeshData
    {
        public readonly List<float> pos = new List<float>(), nor = new List<float>(), col = new List<float>();
        public readonly List<int> idx = new List<int>();
        public int VertexCount { get { return pos.Count / 3; } }
        public int TriangleCount { get { return idx.Count / 3; } }

        int V(V3 p, V3 n, Rgba c)
        {
            pos.Add((float)p.x); pos.Add((float)p.y); pos.Add((float)p.z);
            nor.Add((float)n.x); nor.Add((float)n.y); nor.Add((float)n.z);
            col.Add(c.r); col.Add(c.g); col.Add(c.b); col.Add(c.a);
            return pos.Count / 3 - 1;
        }

        /// <summary>Triangle facing <paramref name="outward"/> (zero hint: keep the given order).</summary>
        public void Tri(V3 a, V3 b, V3 c, V3 outward, Rgba col)
        {
            var n = V3.Cross(b - a, c - a);
            if (V3.Dot(n, outward) < 0) { var t = b; b = c; c = t; n = n * -1; }
            n = n.Normalized; int i = V(a, n, col); V(b, n, col); V(c, n, col); idx.Add(i); idx.Add(i + 1); idx.Add(i + 2);
        }
        /// <summary>Planar quad a-b-c-d (in order around the edge) facing <paramref name="outward"/>.</summary>
        public void Quad(V3 a, V3 b, V3 c, V3 d, V3 outward, Rgba col)
        {
            var n = V3.Cross(b - a, c - a);
            if (V3.Dot(n, outward) < 0) { var t = b; b = d; d = t; n = n * -1; }
            n = n.Normalized; int i = V(a, n, col); V(b, n, col); V(c, n, col); V(d, n, col);
            idx.Add(i); idx.Add(i + 1); idx.Add(i + 2); idx.Add(i); idx.Add(i + 2); idx.Add(i + 3);
        }
        public void QuadTwoSided(V3 a, V3 b, V3 c, V3 d, V3 outward, Rgba col) { Quad(a, b, c, d, outward, col); Quad(a, b, c, d, outward * -1, col); }

        /// <summary>Box w (local x) × h (y) × d (local z) centred at c, turned by yaw (radians, three.js rotation.y).</summary>
        public void Box(V3 c, double w, double h, double d, Rgba col, double yaw = 0, bool bottom = false)
        {
            V3 ux = new V3(w / 2, 0, 0).Yaw(yaw), uy = new V3(0, h / 2, 0), uz = new V3(0, 0, d / 2).Yaw(yaw);
            Face(c, uy, ux, uz, col);          // top
            if (bottom) Face(c, uy * -1, ux, uz, col);
            Face(c, ux, uy, uz, col); Face(c, ux * -1, uy, uz, col);
            Face(c, uz, ux, uy, col); Face(c, uz * -1, ux, uy, col);
        }
        void Face(V3 c, V3 n, V3 u, V3 v, Rgba col) { var o = c + n; Quad(o - u - v, o + u - v, o + u + v, o - u + v, n, col); }

        /// <summary>Flat horizontal rectangle (top face only), e.g. sleepers seen from above.</summary>
        public void TopQuad(V3 c, double w, double d, Rgba col, double yaw = 0)
        {
            V3 ux = new V3(w / 2, 0, 0).Yaw(yaw), uz = new V3(0, 0, d / 2).Yaw(yaw);
            Quad(c - ux - uz, c + ux - uz, c + ux + uz, c - ux + uz, new V3(0, 1, 0), col);
        }

        /// <summary>
        /// Port of gable() in stations.js: a triangular prism roof, ridge along x, base at y = c.y, width w across z, height h.
        /// </summary>
        public void Gable(V3 c, double len, double w, double h, Rgba col, double yaw = 0)
        {
            V3 X = new V3(len / 2, 0, 0).Yaw(yaw), Z = new V3(0, 0, w / 2).Yaw(yaw), top = c + new V3(0, h, 0);
            V3 a0 = c - X - Z, a1 = c + X - Z, b0 = c - X + Z, b1 = c + X + Z, r0 = top - X, r1 = top + X;
            Quad(a0, a1, r1, r0, Up(Z * -1, h, w), col);
            Quad(b0, b1, r1, r0, Up(Z, h, w), col);
            Tri(a0, b0, r0, X * -1, col); Tri(a1, b1, r1, X, col);
        }
        static V3 Up(V3 side, double h, double w) { return side.Normalized * h + new V3(0, w / 2, 0); }   // outward normal of a roof slope

        public enum Axis { X, Y, Z }
        /// <summary>Cylinder (or cone when rTop = 0) of height h centred at c along axis; open = no caps; arc in radians from start.</summary>
        public void Cylinder(V3 c, double rTop, double rBottom, double h, int seg, Rgba col, Axis axis = Axis.Y, bool open = false, double thetaStart = 0, double thetaLen = Math.PI * 2, bool twoSided = false)
        {
            Func<double, double, V3> P = (ang, t) =>   // t = −0.5 bottom .. +0.5 top; ang as three.js: x = r sin, z = r cos
            {
                double r = rBottom + (rTop - rBottom) * (t + 0.5);
                var p = new V3(r * Math.Sin(ang), h * t, r * Math.Cos(ang));
                return c + Orient(p, axis);
            };
            Func<double, V3> Radial = ang => Orient(new V3(Math.Sin(ang), (rBottom - rTop) / Math.Max(h, 1e-6), Math.Cos(ang)), axis);
            for (int i = 0; i < seg; i++)
            {
                double a = thetaStart + thetaLen * i / seg, b = thetaStart + thetaLen * (i + 1) / seg, m = (a + b) / 2;
                if (rTop <= 1e-9) Tri(P(a, -0.5), P(b, -0.5), P(m, 0.5), Radial(m), col);
                else if (twoSided) QuadTwoSided(P(a, -0.5), P(b, -0.5), P(b, 0.5), P(a, 0.5), Radial(m), col);
                else Quad(P(a, -0.5), P(b, -0.5), P(b, 0.5), P(a, 0.5), Radial(m), col);
                if (!open)
                {
                    var bc = c + Orient(new V3(0, -h / 2, 0), axis);
                    Tri(bc, P(a, -0.5), P(b, -0.5), Orient(new V3(0, -1, 0), axis), col);
                    if (rTop > 1e-9) { var tc = c + Orient(new V3(0, h / 2, 0), axis); Tri(tc, P(a, 0.5), P(b, 0.5), Orient(new V3(0, 1, 0), axis), col); }
                }
            }
        }
        static V3 Orient(V3 p, Axis axis)
        {
            if (axis == Axis.Y) return p;
            if (axis == Axis.X) return new V3(-p.y, p.x, p.z);   // three.js rotation.z = π/2
            return new V3(p.x, -p.z, p.y);                       // three.js rotation.x = π/2 (axis along z)
        }

        /// <summary>Flat disc (or half disc with thetaLen = π) in a vertical plane at constant z, facing −z or +z.</summary>
        public void DiscZ(V3 c, double r, int seg, Rgba col, bool facingMinusZ, double thetaStart = 0, double thetaLen = Math.PI * 2)
        {
            var n = new V3(0, 0, facingMinusZ ? -1 : 1);
            for (int i = 0; i < seg; i++)
            {
                double a = thetaStart + thetaLen * i / seg, b = thetaStart + thetaLen * (i + 1) / seg;
                Tri(c, c + new V3(r * Math.Cos(a), r * Math.Sin(a), 0), c + new V3(r * Math.Cos(b), r * Math.Sin(b), 0), n, col);
            }
        }

        /// <summary>Low-poly ellipsoid (tree crowns).</summary>
        public void Blob(V3 c, double rx, double ry, double rz, Rgba col, int seg = 8, int rings = 5)
        {
            Func<int, int, V3> P = (i, j) =>
            {
                double th = Math.PI * j / rings, ph = 2 * Math.PI * i / seg;
                return c + new V3(rx * Math.Sin(th) * Math.Cos(ph), ry * Math.Cos(th), rz * Math.Sin(th) * Math.Sin(ph));
            };
            for (int j = 0; j < rings; j++) for (int i = 0; i < seg; i++)
            {
                V3 a = P(i, j), b = P(i + 1, j), cc = P(i + 1, j + 1), d = P(i, j + 1), mid = (a + cc) * 0.5 - c;
                if (j == 0) Tri(a, cc, d, mid, col); else if (j == rings - 1) Tri(a, b, cc, mid, col); else Quad(a, b, cc, d, mid, col);
            }
        }

        /// <summary>Unity is left-handed: mirror z and reverse each triangle so faces stay front-facing.</summary>
        public void ToLeftHanded(out float[] positions, out float[] normals, out int[] triangles)
        {
            positions = pos.ToArray(); normals = nor.ToArray();
            for (int i = 2; i < positions.Length; i += 3) { positions[i] = -positions[i]; normals[i] = -normals[i]; }
            triangles = idx.ToArray();
            for (int i = 0; i < triangles.Length; i += 3) { int t = triangles[i + 1]; triangles[i + 1] = triangles[i + 2]; triangles[i + 2] = t; }
        }
    }
}
