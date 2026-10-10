using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace ThaiRail.UI
{
    /// <summary>
    /// A uGUI graphic that draws vector shapes into its own mesh: lines, filled triangles, discs and ring arcs.
    /// Used for the NX panel schematic and the ETCS DMI dial (one draw call each, no sprites).
    /// Coordinates are local to the RectTransform with the origin at the top-left corner and y pointing down,
    /// in "design units" scaled by <see cref="unitsToPixels"/>, matching the web build's SVG viewBoxes.
    /// </summary>
    public sealed class UiShapes : MaskableGraphic
    {
        public float unitsToPixels = 1;
        struct V { public Vector2 p; public Color32 c; }
        readonly List<V> _v = new List<V>();
        readonly List<int> _i = new List<int>();

        public void Clear() { _v.Clear(); _i.Clear(); }
        public void Commit() { SetVerticesDirty(); }

        Vector2 P(float x, float y)
        {
            var r = rectTransform.rect;
            return new Vector2(r.xMin + x * unitsToPixels, r.yMax - y * unitsToPixels);
        }
        int Add(Vector2 p, Color32 c) { _v.Add(new V { p = p, c = c }); return _v.Count - 1; }

        public void Line(float x0, float y0, float x1, float y1, float width, Color32 c)
        {
            Vector2 a = P(x0, y0), b = P(x1, y1), d = b - a; float len = d.magnitude; if (len < 1e-4f) return;
            Vector2 n = new Vector2(-d.y / len, d.x / len) * (width * unitsToPixels / 2);
            int i = Add(a - n, c); Add(a + n, c); Add(b + n, c); Add(b - n, c);
            _i.Add(i); _i.Add(i + 1); _i.Add(i + 2); _i.Add(i); _i.Add(i + 2); _i.Add(i + 3);
        }
        public void Triangle(float x0, float y0, float x1, float y1, float x2, float y2, Color32 c)
        {
            int i = Add(P(x0, y0), c); Add(P(x1, y1), c); Add(P(x2, y2), c);
            _i.Add(i); _i.Add(i + 1); _i.Add(i + 2);
        }
        public void Rect(float x, float y, float w, float h, Color32 c)
        {
            int i = Add(P(x, y), c); Add(P(x + w, y), c); Add(P(x + w, y + h), c); Add(P(x, y + h), c);
            _i.Add(i); _i.Add(i + 1); _i.Add(i + 2); _i.Add(i); _i.Add(i + 2); _i.Add(i + 3);
        }
        public void Disc(float cx, float cy, float r, Color32 c, int seg = 18)
        {
            int ci = Add(P(cx, cy), c), first = _v.Count;
            for (int k = 0; k <= seg; k++) { float a = Mathf.PI * 2 * k / seg; Add(P(cx + r * Mathf.Cos(a), cy + r * Mathf.Sin(a)), c); }
            for (int k = 0; k < seg; k++) { _i.Add(ci); _i.Add(first + k); _i.Add(first + k + 1); }
        }
        /// <summary>Ring arc between angles a0..a1 (degrees, 0 = up, clockwise), radius r, thickness w.</summary>
        public void Arc(float cx, float cy, float r, float w, float a0, float a1, Color32 c, int segPer90 = 10)
        {
            if (a1 - a0 < 0.3f) return;
            int seg = Mathf.Max(2, Mathf.CeilToInt((a1 - a0) / 90f * segPer90));
            float ri = r - w / 2, ro = r + w / 2; int first = _v.Count;
            for (int k = 0; k <= seg; k++)
            {
                float a = (a0 + (a1 - a0) * k / seg) * Mathf.Deg2Rad, sx = Mathf.Sin(a), sy = -Mathf.Cos(a);
                Add(P(cx + ri * sx, cy + ri * sy), c); Add(P(cx + ro * sx, cy + ro * sy), c);
            }
            for (int k = 0; k < seg; k++) { int i = first + k * 2; _i.Add(i); _i.Add(i + 1); _i.Add(i + 3); _i.Add(i); _i.Add(i + 3); _i.Add(i + 2); }
        }

        protected override void OnPopulateMesh(VertexHelper vh)
        {
            vh.Clear();
            var ui = UIVertex.simpleVert;
            foreach (var v in _v) { ui.position = v.p; ui.color = v.c; vh.AddVert(ui); }
            for (int k = 0; k + 2 < _i.Count; k += 3) vh.AddTriangle(_i[k], _i[k + 1], _i[k + 2]);
        }
    }
}
