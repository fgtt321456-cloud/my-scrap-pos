using System;
using System.Collections.Generic;
using ThaiRail.Data;
using ThaiRail.Game;
using ThaiRail.Meta;
using ThaiRail.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace ThaiRail.UI
{
    /// <summary>
    /// The Thailand map (port of drawMap2d + drawTTTrains): sea, neighbours, Thailand, the real rail network, the
    /// playable stations, and every real SRT timetable train running at the world clock, labelled with its number and
    /// any delay carried by the ledger. Static geometry is drawn once; trains refresh 4× a second.
    /// </summary>
    public sealed class MapView : MonoBehaviour, UnityEngine.EventSystems.IPointerClickHandler
    {
        static readonly Color32 Sea = new Color32(0xCF, 0xE2, 0xF2, 255), Land = new Color32(0xEF, 0xE9, 0xDB, 255), Nb = new Color32(0xE2, 0xE0, 0xD8, 255),
            Rail = new Color32(0x8B, 0x86, 0x7A, 255), Fg = new Color32(0x13, 0x23, 0x3D, 255), Bad = new Color32(0xC9, 0x35, 0x3A, 255), Lock = new Color32(0x9A, 0xA8, 0xBD, 255),
            Accent = new Color32(0xFF, 0xC2, 0x0E, 255), White = new Color32(255, 255, 255, 255);
        static readonly Dictionary<string, Color32> LineCol = new Dictionary<string, Color32> { { "N", new Color32(0xD4, 0x57, 0x2A, 255) }, { "NE", new Color32(0x2F, 0x7F, 0xD1, 255) }, { "S", new Color32(0x2A, 0x9D, 0x6A, 255) } };

        MenuModel _m; RailGraph _graph; Font _font;
        UiShapes _static, _dyn;
        RectTransform _rt, _labels;
        Text _clock;
        readonly List<Text> _trainLabels = new List<Text>();
        List<HubCard> _hubs = new List<HubCard>();
        float _k, _ox, _oz, _acc, _w, _h;
        string _sel;
        public event Action<HubCard> HubTapped;
        public event Action<string> TrainInfo;

        public static MapView Create(RectTransform parent, MenuModel model, RailGraph graph, Font font)
        {
            var go = new GameObject("Thailand map", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var v = go.AddComponent<MapView>(); v._m = model; v._graph = graph; v._font = font; v._rt = go.GetComponent<RectTransform>();
            go.AddComponent<Image>().color = new Color32(Sea.r, Sea.g, Sea.b, 255);
            v._static = v.Layer("Geography"); v._dyn = v.Layer("Trains");
            var lg = new GameObject("Labels", typeof(RectTransform)); lg.transform.SetParent(go.transform, false);
            v._labels = lg.GetComponent<RectTransform>(); v._labels.anchorMin = Vector2.zero; v._labels.anchorMax = Vector2.one; v._labels.offsetMin = v._labels.offsetMax = Vector2.zero;
            v._clock = v.Label(v._rt, "", 18, Fg, TextAnchor.UpperRight, new Vector2(-16, -12), new Vector2(520, 26), new Vector2(1, 1));
            return v;
        }
        UiShapes Layer(string name)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(transform, false);
            var r = go.GetComponent<RectTransform>(); r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one; r.offsetMin = r.offsetMax = Vector2.zero;
            var g = go.AddComponent<UiShapes>(); g.raycastTarget = false; return g;
        }
        Text Label(RectTransform parent, string text, int size, Color color, TextAnchor align, Vector2 pos, Vector2 box, Vector2 anchor)
        {
            var go = new GameObject("Text", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = anchor; rt.pivot = anchor; rt.anchoredPosition = pos; rt.sizeDelta = box;
            var t = go.AddComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Overflow; t.verticalOverflow = VerticalWrapMode.Overflow; return t;
        }

        public void SetHubs(List<HubCard> hubs, string selected) { _hubs = hubs; _sel = selected; _w = -1; }

        void Fit()
        {
            var r = _rt.rect; _w = r.width; _h = r.height;
            float pad = 24, sx = (_w - pad * 2) / (_m.MaxX - _m.MinX), sz = (_h - pad * 2) / (_m.MaxZ - _m.MinZ);
            _k = Mathf.Min(sx, sz); _ox = _m.MinX - ((_w / _k) - (_m.MaxX - _m.MinX)) / 2; _oz = _m.MinZ - ((_h / _k) - (_m.MaxZ - _m.MinZ)) / 2;
            _static.Clear();
            foreach (var t in _m.NeighbourTris) _static.Tris(t, _ox, _oz, _k, Nb);
            foreach (var t in _m.ThailandTris) _static.Tris(t, _ox, _oz, _k, Land);
            foreach (var s in _m.RailSegments) _static.Line(X(s[0]), Y(s[1]), X(s[2]), Y(s[3]), 1.6f, Rail);
            _static.Commit();
            // station markers are buttons
            for (int i = _labels.childCount - 1; i >= 0; i--) Destroy(_labels.GetChild(i).gameObject);
            _trainLabels.Clear();
            foreach (var h in _hubs)
            {
                if (h.isMap || h.stationId == null) continue;
                var hub = h;
                var go = new GameObject("Hub " + h.code, typeof(RectTransform)); go.transform.SetParent(_labels, false);
                var hr = go.GetComponent<RectTransform>(); hr.anchorMin = hr.anchorMax = new Vector2(0, 1); hr.pivot = new Vector2(0.5f, 0.5f);
                hr.sizeDelta = new Vector2(44, 44); hr.anchoredPosition = new Vector2(X(h.mapX), -Y(h.mapZ));
                var img = go.AddComponent<Image>(); img.color = new Color(1, 1, 1, 0.001f);
                var b = go.AddComponent<Button>(); b.targetGraphic = img; b.onClick.AddListener(() => { if (HubTapped != null) HubTapped(hub); });
                var name = Label(hr, h.name.Replace("สถานี", "") + (h.locked ? "  🔒 Lv " + h.lockLevel : ""), 16, h.locked ? (Color)(Color32)Lock : (Color)(Color32)Fg, TextAnchor.MiddleLeft, new Vector2(30, 0), new Vector2(300, 22), new Vector2(0.5f, 0.5f));
                name.rectTransform.pivot = new Vector2(0, 0.5f); name.fontStyle = FontStyle.Bold;
                // Krung Thep Aphiwat (Bang Sue) and Hua Lamphong are 7 km apart: put one label above, one below
                if (h.code == "KRT") name.rectTransform.anchoredPosition = new Vector2(24, 16); else if (h.code == "BKK") name.rectTransform.anchoredPosition = new Vector2(24, -16);
            }
        }
        float X(float x) { return (x - _ox) * _k; }
        float Y(float z) { return (z - _oz) * _k; }

        void Update()
        {
            if (_m == null) return;
            var r = _rt.rect; if (Mathf.Abs(r.width - _w) > 1 || Mathf.Abs(r.height - _h) > 1) Fit();
            _acc += Time.unscaledDeltaTime; if (_acc < 0.25f) return; _acc = 0;
            var W = RailTrackWorld.Instance; if (W == null || !W.Ready) return;
            var run = TimetableTrains.Running(W.Clock.now, W.Db, _graph, W.Ledger);
            _dyn.Clear();
            foreach (var h in _hubs)
            {
                if (h.isMap || h.stationId == null) continue;
                float x = X(h.mapX), y = Y(h.mapZ);
                if (h.stationId == _sel) _dyn.Disc(x, y, 15, Accent, 20);
                _dyn.Disc(x, y, 10, h.locked ? Lock : Fg, 16); _dyn.Disc(x, y, 6.5f, White, 16);
            }
            while (_trainLabels.Count < run.Count) _trainLabels.Add(Label(_labels, "", 14, Fg, TextAnchor.LowerCenter, Vector2.zero, new Vector2(80, 18), new Vector2(0, 1)));
            for (int i = 0; i < _trainLabels.Count; i++)
            {
                var L = _trainLabels[i];
                if (i >= run.Count) { L.text = ""; continue; }
                var t = run[i]; float x = X((float)t.x), y = Y((float)t.z);
                Color32 c; if (!LineCol.TryGetValue(t.t.line, out c)) c = Fg;
                float a = Mathf.Atan2((float)t.tz, (float)t.tx), ca = Mathf.Cos(a), sa = Mathf.Sin(a);
                Func<float, float, Vector2> R = (u, v) => new Vector2(x + u * ca - v * sa, y + u * sa + v * ca);
                Vector2 p0 = R(9, 0), p1 = R(-7, -5), p2 = R(-7, 5);
                _dyn.Disc(x, y, 7.5f, White, 12); _dyn.Triangle(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, c);
                L.text = t.t.no + (t.delay > 3 ? " +" + t.delay + "′" : ""); L.color = t.delay > 3 ? (Color)(Color32)Bad : (Color)(Color32)Fg;
                L.rectTransform.anchoredPosition = new Vector2(x - 40, -(y - 9));
            }
            _dyn.Commit();
            _clock.text = "เวลาเครือข่าย " + Clock.HM(W.Clock.now) + " · ขบวนจริงกำลังวิ่ง " + run.Count;
        }

        public void OnPointerClick(UnityEngine.EventSystems.PointerEventData e)
        {
            Vector2 local;
            if (!RectTransformUtility.ScreenPointToLocalPointInRectangle(_rt, e.position, e.pressEventCamera, out local)) return;
            var r = _rt.rect; TapAt(new Vector2(local.x - r.xMin, r.yMax - local.y));
        }
        /// <summary>Running train nearest a screen point (for a tap), as an info line.</summary>
        public void TapAt(Vector2 local)
        {
            var W = RailTrackWorld.Instance; if (W == null || TrainInfo == null) return;
            foreach (var t in TimetableTrains.Running(W.Clock.now, W.Db, _graph, W.Ledger))
            {
                float dx = X((float)t.x) - local.x, dy = Y((float)t.z) - local.y;
                if (dx * dx + dy * dy > 18 * 18) continue;
                double eta = Clock.ToSec(t.t.arr) + t.delay * 60;
                TrainInfo(t.t.cls + " " + t.t.no + " " + W.Db.PlaceName(t.t.from) + " → " + W.Db.PlaceName(t.t.to) + " · " + Math.Round(t.f * 100) + "% · ถึง " + Clock.HM(eta) + (t.delay > 0 ? " (ช้า " + t.delay + " นาที)" : " ตรงเวลา"));
                return;
            }
        }
    }
}
