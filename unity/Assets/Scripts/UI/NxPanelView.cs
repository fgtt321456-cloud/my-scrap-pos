using System;
using System.Collections.Generic;
using System.Text;
using ThaiRail.Simulation.Hlp;
using ThaiRail.Stations;
using UnityEngine;
using UnityEngine.UI;

namespace ThaiRail.UI
{
    /// <summary>
    /// Hua Lamphong's NX relay panel on screen (port of the web build's #nx panel): the track schematic coloured by
    /// track circuits and locked routes, switch circles (reversed / moving / locked), signal triangles by aspect,
    /// platform and exit buttons, train tags per track, the hint line and ARS indicators. All presses go to
    /// <see cref="NxPanelModel"/>. Built in code; redraws only when the picture changes.
    /// </summary>
    public sealed class NxPanelView : MonoBehaviour
    {
        // panel palette (dark control-room style, as the web panel)
        static readonly Color32 Bg = new Color32(0x0F, 0x1B, 0x29, 0xF2), Plat = new Color32(0x24, 0x35, 0x4D, 255), EdgeFree = new Color32(0x6E, 0x7C, 0x8E, 255),
            EdgeOcc = new Color32(0xE5, 0x48, 0x4D, 255), EdgeRt = new Color32(0x3F, 0xC5, 0x8B, 255), EdgeSh = new Color32(0x6F, 0xA0, 0xF0, 255), EdgeSet = new Color32(0xE8, 0xC5, 0x47, 255),
            SigRed = new Color32(0xE5, 0x48, 0x4D, 255), SigYel = new Color32(0xE8, 0xC5, 0x47, 255), SigGrn = new Color32(0x3F, 0xC5, 0x8B, 255), Sel = new Color32(0xFF, 0xC2, 0x0E, 255),
            NodeN = new Color32(0xB9, 0xC4, 0xD2, 255), NodeR = new Color32(0xF0, 0x8A, 0x24, 255), NodeLk = new Color32(0x3F, 0xC5, 0x8B, 255), Btn = new Color32(0x2E, 0x4F, 0x80, 255);

        NxPanelModel _m;
        UiShapes _g;
        RectTransform _rt;
        Text _hint, _arsArr, _arsDep;
        readonly Text[] _tags = new Text[15];
        readonly StringBuilder _sb = new StringBuilder();
        string _sig = "";
        float _acc;
        Font _font;
        public Action OpenControllers;

        /// <summary>Create the panel as a child of a canvas rect, docked to the bottom of the screen.</summary>
        public static NxPanelView Create(RectTransform parent, NxPanelModel model, Font font, float heightPx = 360)
        {
            var go = new GameObject("NX panel", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var v = go.AddComponent<NxPanelView>(); v._m = model; v._font = font; v.Build(heightPx);
            return v;
        }

        void Build(float h)
        {
            _rt = GetComponent<RectTransform>();
            _rt.anchorMin = new Vector2(0.5f, 0); _rt.anchorMax = new Vector2(0.5f, 0); _rt.pivot = new Vector2(0.5f, 0);
            float scale = h / (NxPanelModel.Height + 30), w = NxPanelModel.Width * scale;
            _rt.sizeDelta = new Vector2(w, h); _rt.anchoredPosition = new Vector2(0, 16);
            var bg = gameObject.AddComponent<Image>(); bg.color = Bg;

            var draw = new GameObject("Schematic", typeof(RectTransform)); draw.transform.SetParent(_rt, false);
            var drt = draw.GetComponent<RectTransform>(); drt.anchorMin = new Vector2(0, 1); drt.anchorMax = new Vector2(0, 1); drt.pivot = new Vector2(0, 1);
            drt.sizeDelta = new Vector2(w, NxPanelModel.Height * scale); drt.anchoredPosition = Vector2.zero;
            _g = draw.AddComponent<UiShapes>(); _g.unitsToPixels = scale; _g.raycastTarget = false;

            // invisible hit areas over every button (bigger than the drawing, for fingers)
            foreach (var b in _m.Buttons)
            {
                float hw = b.kind == NxButtonKind.Switch ? 9 : b.kind == NxButtonKind.Signal ? 11 : b.kind == NxButtonKind.ExitMain ? 20 : 15, hh = b.kind == NxButtonKind.Platform ? 7 : 9;
                var hit = new GameObject("Btn " + b.id, typeof(RectTransform)); hit.transform.SetParent(drt, false);
                var hr = hit.GetComponent<RectTransform>(); hr.anchorMin = hr.anchorMax = new Vector2(0, 1); hr.pivot = new Vector2(0.5f, 0.5f);
                hr.sizeDelta = new Vector2(hw * 2 * scale, hh * 2 * scale); hr.anchoredPosition = new Vector2(b.x * scale, -b.y * scale);
                var img = hit.AddComponent<Image>(); img.color = new Color(1, 1, 1, 0.001f);
                var btn = hit.AddComponent<Button>(); btn.targetGraphic = img; string id = b.id;
                btn.onClick.AddListener(() => { _m.Press(id); _sig = ""; });
                if (b.kind == NxButtonKind.Platform || b.kind == NxButtonKind.ExitMain) Label(hr, b.label, 15, Color.white, TextAnchor.MiddleCenter, Vector2.zero, hr.sizeDelta, true);
            }
            for (int i = 1; i <= 14; i++)
            {
                float y = NxPanelModel.Y(_m.Graph.file.trackZ[i - 1]);
                _tags[i] = Label(drt, "", 13, new Color(0.73f, 0.77f, 0.82f), TextAnchor.LowerLeft, new Vector2(NxPanelModel.X(48) * scale, -(y - 1) * scale), new Vector2(260 * scale, 14), false);
            }
            Label(drt, "ชานชาลา", 14, new Color(0.55f, 0.6f, 0.66f), TextAnchor.UpperCenter, new Vector2(NxPanelModel.X(150) * scale, -6 * scale), new Vector2(200, 18), false);
            Label(drt, "คอขวด (throat)", 14, new Color(0.55f, 0.6f, 0.66f), TextAnchor.UpperCenter, new Vector2(NxPanelModel.X(460) * scale, -6 * scale), new Vector2(200, 18), false);
            _hint = Label(_rt, "", 15, new Color(0.85f, 0.88f, 0.92f), TextAnchor.LowerLeft, new Vector2(14, -(h - 8)), new Vector2(w - 330, 22), false);
            _arsArr = ArsButton("ARS ขาเข้า", new Vector2(w - 310, -(h - 30)));
            _arsDep = ArsButton("ARS ขาออก", new Vector2(w - 160, -(h - 30)));
        }

        Text ArsButton(string text, Vector2 pos)
        {
            var go = new GameObject(text, typeof(RectTransform)); go.transform.SetParent(_rt, false);
            var r = go.GetComponent<RectTransform>(); r.anchorMin = r.anchorMax = new Vector2(0, 1); r.pivot = new Vector2(0, 1); r.sizeDelta = new Vector2(144, 26); r.anchoredPosition = pos;
            var img = go.AddComponent<Image>(); img.color = Btn; var b = go.AddComponent<Button>(); b.targetGraphic = img;
            b.onClick.AddListener(() => { if (OpenControllers != null) OpenControllers(); });
            return Label(r, text, 14, Color.white, TextAnchor.MiddleCenter, Vector2.zero, r.sizeDelta, true);
        }
        Text Label(RectTransform parent, string text, int size, Color color, TextAnchor align, Vector2 pos, Vector2 box, bool centred)
        {
            var go = new GameObject("Text", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>();
            if (centred) { rt.anchorMin = Vector2.zero; rt.anchorMax = Vector2.one; rt.offsetMin = rt.offsetMax = Vector2.zero; }
            else { rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(align == TextAnchor.UpperCenter ? 0.5f : 0, 1); rt.anchoredPosition = pos; rt.sizeDelta = box; }
            var t = go.AddComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        void Update()
        {
            if (_m == null) return;
            _acc += Time.unscaledDeltaTime; if (_acc < 0.15f) return; _acc = 0;
            Redraw();
        }

        void Redraw()
        {
            var G = _m.Graph;
            // signature of everything drawn, so the mesh is rebuilt only when something changed
            _sb.Length = 0;
            for (int e = 0; e < G.edges.Length; e++) { bool st; _sb.Append((int)_m.EdgeState(e, out st)).Append(st ? 's' : '.'); }
            foreach (var n in G.nodes) if (G.IsSwitch(n.i)) { bool r, mv, lk; _m.NodeState(n.i, out r, out mv, out lk); _sb.Append(r ? 'r' : 'n').Append(mv ? 'm' : '.').Append(lk ? 'l' : '.'); }
            foreach (var b in _m.Buttons) if (b.kind == NxButtonKind.Signal) _sb.Append(_m.Aspect(b.id)[0]);
            _sb.Append(_m.Selected).Append(Time.unscaledTime % 1 < 0.5f ? '1' : '0');   // blink for moving switches / routes being set
            string sig = _sb.ToString(); if (sig == _sig) return; _sig = sig;
            bool blink = Time.unscaledTime % 1 < 0.5f;

            _g.Clear();
            foreach (var z in G.file.platformsZ) _g.Rect(NxPanelModel.X(36), NxPanelModel.Y(z) - 3.2f, NxPanelModel.X(272) - NxPanelModel.X(36), 6.4f, Plat);
            foreach (var e in G.edges)
            {
                bool setting; var st = _m.EdgeState(e.i, out setting);
                Color32 c = st == NxEdgeState.Occupied ? EdgeOcc : st == NxEdgeState.Shunt ? EdgeSh : st == NxEdgeState.Route ? EdgeRt : EdgeFree;
                if (setting && blink) c = EdgeSet;
                _g.Line(NxPanelModel.X(e.ax), NxPanelModel.Y(e.az), NxPanelModel.X(e.bx), NxPanelModel.Y(e.bz), st == NxEdgeState.Free ? 1.6f : 2.6f, c);
            }
            foreach (var n in G.nodes)
            {
                if (!G.IsSwitch(n.i)) continue;
                bool r, mv, lk; _m.NodeState(n.i, out r, out mv, out lk);
                Color32 c = mv && blink ? EdgeSet : lk ? NodeLk : r ? NodeR : NodeN;
                _g.Disc(NxPanelModel.X(n.x), NxPanelModel.Y(n.z), n.kind == "slip" ? 4.6f : 2.8f, c, 12);
            }
            foreach (var b in _m.Buttons)
            {
                switch (b.kind)
                {
                    case NxButtonKind.Platform: _g.Rect(4, b.y - 5.5f, 26, 11, _m.Selected == "HA" ? Sel : Btn); break;
                    case NxButtonKind.ExitMain: _g.Rect(962, b.y - 6.5f, 34, 13, _m.Selected != null && _m.Selected.StartsWith("ST") ? Sel : Btn); break;
                    case NxButtonKind.Signal:
                        {
                            string a = _m.Aspect(b.id); Color32 c = a == "green" ? SigGrn : a == "yellow" ? SigYel : SigRed;
                            if (_m.Selected == b.id) _g.Disc(b.x, b.y, 8, Sel, 14);
                            if (b.id == "HA") _g.Triangle(b.x + 6, b.y - 6, b.x - 6, b.y, b.x + 6, b.y + 6, c);   // points toward the platforms (west)
                            else _g.Triangle(b.x - 4, b.y - 4, b.x + 5, b.y, b.x - 4, b.y + 4, c);              // starting signals point east
                            break;
                        }
                }
            }
            _g.Commit();
            for (int i = 1; i <= 14; i++) { string t = _m.TrackTag(i); if (_tags[i].text != t) _tags[i].text = t; }
            _hint.text = _m.Hint;
            _arsArr.text = "ARS ขาเข้า: " + (_m.ArsArr ? "เปิด" : "ปิด"); _arsDep.text = "ARS ขาออก: " + (_m.ArsDep ? "เปิด" : "ปิด");
        }
    }
}
