using ThaiRail.Simulation.Hlp;
using ThaiRail.Stations;
using UnityEngine;
using UnityEngine.UI;

namespace ThaiRail.UI
{
    /// <summary>
    /// ETCS DMI for the selected train at Hua Lamphong (port of the web build's #dmi): circular speed dial 0–160 km/h
    /// with permitted-speed (grey), target-speed (yellow) and overspeed (orange) arcs, the needle coloured by
    /// supervision state, digital speed, mode (FS/SH/SB), target distance bar and the movement-authority message.
    /// </summary>
    public sealed class DmiView : MonoBehaviour
    {
        static readonly Color32 Panel = new Color32(0x0F, 0x1B, 0x29, 0xF0), Track = new Color32(0x23, 0x34, 0x4A, 255), Csg = new Color32(0x7F, 0x8B, 0x9B, 255),
            Tsm = new Color32(0xE8, 0xC5, 0x47, 255), Over = new Color32(0xF0, 0x8A, 0x24, 255), Tick = new Color32(0x8B, 0x98, 0xA8, 255), White = new Color32(0xF3, 0xF6, 0xFA, 255),
            Red = new Color32(0xE5, 0x48, 0x4D, 255), Hub = new Color32(0x0F, 0x1B, 0x29, 255), Bar = new Color32(0x3F, 0xC5, 0x8B, 255);
        static readonly Color32[] NeedleCol = { White, Tsm, Over, Red };

        HlpEngine _e;
        public string ServiceId;
        UiShapes _g;
        Text _name, _mode, _speed, _target, _msg;
        Font _font;
        float _acc;
        const float S = 1.6f;   // pixels per design unit (web viewBox 180 × 170)

        public static DmiView Create(RectTransform parent, HlpEngine engine, Font font)
        {
            var go = new GameObject("ETCS DMI", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var v = go.AddComponent<DmiView>(); v._e = engine; v._font = font; v.Build(); return v;
        }

        void Build()
        {
            var rt = GetComponent<RectTransform>();
            rt.anchorMin = rt.anchorMax = new Vector2(1, 0); rt.pivot = new Vector2(1, 0);
            rt.sizeDelta = new Vector2(180 * S + 20, 170 * S + 120); rt.anchoredPosition = new Vector2(-16, 290);
            gameObject.AddComponent<Image>().color = Panel;
            _name = Label(rt, "—", 18, White, TextAnchor.UpperLeft, new Vector2(12, -8), new Vector2(220, 24)); _name.fontStyle = FontStyle.Bold;
            _mode = Label(rt, "SB", 18, Tsm, TextAnchor.UpperRight, new Vector2(180 * S + 20 - 62, -8), new Vector2(50, 24));
            var d = new GameObject("Dial", typeof(RectTransform)); d.transform.SetParent(rt, false);
            var drt = d.GetComponent<RectTransform>(); drt.anchorMin = drt.anchorMax = new Vector2(0, 1); drt.pivot = new Vector2(0, 1);
            drt.sizeDelta = new Vector2(180 * S, 170 * S); drt.anchoredPosition = new Vector2(10, -36);
            _g = d.AddComponent<UiShapes>(); _g.unitsToPixels = S; _g.raycastTarget = false;
            for (int v = 0; v <= 160; v += 40)
            {
                float a = DmiState.Angle(v) * Mathf.Deg2Rad;
                Label(drt, v.ToString(), 15, Tick, TextAnchor.MiddleCenter, new Vector2((90 + 45 * Mathf.Sin(a)) * S - 20, -(90 - 45 * Mathf.Cos(a)) * S + 10), new Vector2(40, 20));
            }
            _speed = Label(drt, "0", 24, White, TextAnchor.MiddleCenter, new Vector2(90 * S - 40, -(90 * S - 14)), new Vector2(80, 28)); _speed.fontStyle = FontStyle.Bold;
            Label(drt, "กม./ชม.", 14, Tick, TextAnchor.MiddleCenter, new Vector2(90 * S - 40, -(140 * S - 10)), new Vector2(80, 20));
            _target = Label(rt, "", 15, White, TextAnchor.UpperLeft, new Vector2(12, -(36 + 170 * S + 8)), new Vector2(180 * S, 22));
            _msg = Label(rt, "", 15, Tsm, TextAnchor.UpperLeft, new Vector2(12, -(36 + 170 * S + 52)), new Vector2(180 * S, 40));
        }
        Text Label(RectTransform parent, string text, int size, Color color, TextAnchor align, Vector2 pos, Vector2 box)
        {
            var go = new GameObject("Text", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(0, 1); rt.anchoredPosition = pos; rt.sizeDelta = box;
            var t = go.AddComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = align; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow;
            return t;
        }

        void Update()
        {
            if (_e == null) return;
            _acc += Time.unscaledDeltaTime; if (_acc < 0.1f) return; _acc = 0;
            var d = DmiState.For(_e, ServiceId);
            _g.Clear();
            _g.Arc(90, 90, 72, 7, DmiState.Angle(0), DmiState.Angle(160), Track);
            if (d.has)
            {
                _g.Arc(90, 90, 72, 7, DmiState.Angle(0), DmiState.Angle(Mathf.Min(d.permitted, 160)), Csg);
                if (d.tsm) _g.Arc(90, 90, 72, 7, DmiState.Angle(d.targetSpeed), DmiState.Angle(Mathf.Min(d.permitted, 160)), Tsm);
                if (d.over) _g.Arc(90, 90, 72, 7, DmiState.Angle(d.permitted), DmiState.Angle(d.speed), Over);
            }
            for (int v = 0; v <= 160; v += 10)
            {
                float a = DmiState.Angle(v) * Mathf.Deg2Rad, r1 = v % 40 == 0 ? 55 : 59;
                _g.Line(90 + 64 * Mathf.Sin(a), 90 - 64 * Mathf.Cos(a), 90 + r1 * Mathf.Sin(a), 90 - r1 * Mathf.Cos(a), v % 40 == 0 ? 1.8f : 1, Tick);
            }
            float na = DmiState.Angle(d.has ? d.speed : 0) * Mathf.Deg2Rad;
            _g.Line(90, 90, 90 + 60 * Mathf.Sin(na), 90 - 60 * Mathf.Cos(na), 3.5f, NeedleCol[d.has ? d.needle : 0]);
            _g.Disc(90, 90, 19, White, 24); _g.Disc(90, 90, 17, Hub, 24);
            if (d.has && d.targetBar > 0) { _g.Rect(10, 150, 160, 5, Track); _g.Rect(10, 150, 160 * d.targetBar, 5, Bar); }
            _g.Commit();
            _name.text = d.has ? d.name : "—"; _mode.text = d.has ? d.mode : "";
            _speed.text = d.has ? Mathf.RoundToInt(d.speed).ToString() : "0";
            _target.text = d.has ? d.target : "แตะขบวนเพื่อดู DMI"; _msg.text = d.has ? d.message : "";
        }
    }
}
