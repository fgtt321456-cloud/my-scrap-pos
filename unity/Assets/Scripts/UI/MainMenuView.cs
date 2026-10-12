using System;
using System.Collections.Generic;
using ThaiRail.Game;
using ThaiRail.Meta;
using ThaiRail.Simulation;
using UnityEngine;
using UnityEngine.UI;

namespace ThaiRail.UI
{
    /// <summary>
    /// Main menu and station picker (port of the web build's menu + hub picker): title, player level and coins, the
    /// daily gift, one card per hub (locked until its level, stars from the station's record) and the live Thailand
    /// map with the real timetable trains. Choosing a station raises <see cref="Open"/>.
    /// </summary>
    public sealed class MainMenuView : MonoBehaviour
    {
        static readonly Color Navy = new Color32(0x0F, 0x22, 0x40, 255), Navy2 = new Color32(0x1B, 0x35, 0x5E, 255), Accent = new Color32(0xFF, 0xC2, 0x0E, 255),
            Fg = new Color32(0x13, 0x23, 0x3D, 255), Muted = new Color32(0x6B, 0x7A, 0x90, 255), Card = new Color32(0xF4, 0xF6, 0xF9, 255), OnNavyMuted = new Color32(0xA7, 0xB6, 0xCF, 255);

        public event Action<string> Open;
        MenuModel _m; Font _font; RectTransform _root, _list; Text _profile, _giftLabel, _toast; Button _gift; MapView _map;
        float _acc, _toastT; string _sig = "", _selected;

        public static MainMenuView Create(Transform parent, MenuModel model, RailGraph graph, Font font)
        {
            var go = new GameObject("Main menu", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var v = go.AddComponent<MainMenuView>(); v._m = model; v._font = font; v.Build(graph); return v;
        }

        void Build(RailGraph graph)
        {
            var canvas = gameObject.AddComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 20;
            var sc = gameObject.AddComponent<CanvasScaler>(); sc.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; sc.referenceResolution = new Vector2(1920, 1080); sc.matchWidthOrHeight = 0.6f;
            gameObject.AddComponent<GraphicRaycaster>();
            if (UnityEngine.EventSystems.EventSystem.current == null) { var es = new GameObject("EventSystem"); es.AddComponent<UnityEngine.EventSystems.EventSystem>(); es.AddComponent<UnityEngine.EventSystems.StandaloneInputModule>(); }
            _root = GetComponent<RectTransform>();
            Box(_root, "Background", Vector2.zero, Vector2.one, Vector2.zero, Vector2.zero, Navy);
            var left = Box(_root, "Left", new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 0), new Vector2(620, 0), Navy);
            var t = Text(left, "RailTrack Thailand", 52, Color.white, new Vector2(40, -36), new Vector2(560, 64)); t.fontStyle = FontStyle.Bold;
            Text(left, "บริหารสถานีรถไฟไทย · ตารางเดินรถจริงของ รฟท.", 22, OnNavyMuted, new Vector2(40, -104), new Vector2(560, 30));
            _profile = Text(left, "", 24, Accent, new Vector2(40, -150), new Vector2(380, 32)); _profile.fontStyle = FontStyle.Bold;
            _gift = Btn(left, "", new Vector2(420, -146), new Vector2(170, 44), () => { var W = RailTrackWorld.Instance; if (W != null) W.Meta.ClaimGift(); _sig = ""; });
            _giftLabel = _gift.GetComponentInChildren<Text>();
            Text(left, "เลือกสถานีที่จะบริหาร", 22, OnNavyMuted, new Vector2(40, -214), new Vector2(560, 30));
            _list = Box(left, "Hubs", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0, 1), new Vector2(0, 0), new Color(0, 0, 0, 0));
            _list.anchoredPosition = new Vector2(0, -252);
            Text(left, "จัดทำเพื่อการศึกษาและพัฒนา · ข้อมูลสถานีและตารางเดินรถอ้างอิงแหล่งสาธารณะ", 15, OnNavyMuted, new Vector2(40, -1040), new Vector2(560, 22));
            var mapHolder = Box(_root, "Map holder", new Vector2(0, 0), new Vector2(1, 1), new Vector2(0, 0), new Vector2(0, 0), new Color(0, 0, 0, 0));
            mapHolder.offsetMin = new Vector2(636, 16); mapHolder.offsetMax = new Vector2(-16, -16);
            _map = MapView.Create(mapHolder, _m, graph, _font);
            var mr = _map.GetComponent<RectTransform>(); mr.anchorMin = Vector2.zero; mr.anchorMax = Vector2.one; mr.offsetMin = mr.offsetMax = Vector2.zero;
            _map.HubTapped += Choose; _map.TrainInfo += Toast;
            var tb = Box(_root, "Toast", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(900, 54), new Color32(0x0F, 0x22, 0x40, 235));
            tb.anchoredPosition = new Vector2(310, -24);
            _toast = Text(tb, "", 20, Color.white, Vector2.zero, new Vector2(900, 54)); _toast.alignment = TextAnchor.MiddleCenter;
            tb.gameObject.SetActive(false);
            var W0 = RailTrackWorld.Instance; if (W0 != null) W0.Meta.Message += Toast;
        }
        void OnDestroy() { var W = RailTrackWorld.Instance; if (W != null && W.Meta != null) W.Meta.Message -= Toast; }

        void Choose(HubCard h)
        {
            if (h.isMap) { Toast("แผนที่: แตะสถานีเพื่อเข้าบริหาร · แตะขบวนเพื่อดูข้อมูล"); return; }
            if (h.locked) { Toast(h.name + " ปลดล็อกที่เลเวล " + h.lockLevel); return; }
            _selected = h.stationId; if (Open != null) Open(h.stationId);
        }
        public void Toast(string s) { _toast.text = s; _toastT = 3; _toast.transform.parent.gameObject.SetActive(true); }

        void Update()
        {
            if (_toastT > 0) { _toastT -= Time.unscaledDeltaTime; if (_toastT <= 0) _toast.transform.parent.gameObject.SetActive(false); }
            _acc += Time.unscaledDeltaTime; if (_acc < 0.5f) return; _acc = 0;
            var W = RailTrackWorld.Instance; if (W == null || !W.Ready) return;
            var M = W.Meta.P;
            _profile.text = "Lv " + M.lv + " · XP " + M.xp + "/" + W.Meta.XpNeed(M.lv) + " · " + M.coins + " เหรียญ";
            _giftLabel.text = W.Meta.GiftReady ? "รับของขวัญ +" + W.Meta.C.giftCoins : "รับแล้ววันนี้";
            _gift.interactable = W.Meta.GiftReady;
            var hubs = _m.Hubs(M.lv, id => W.StationStateIfAny(id), W.HuaLamphongStateIfAny());
            string sig = M.lv + "|"; foreach (var h in hubs) sig += h.id + h.stars + h.locked;
            if (sig == _sig) return; _sig = sig;
            _map.SetHubs(hubs, _selected);
            for (int i = _list.childCount - 1; i >= 0; i--) Destroy(_list.GetChild(i).gameObject);
            float y = 0;
            foreach (var h in hubs)
            {
                var hub = h;
                var card = Box(_list, "Card " + h.code, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(-64, 104), h.locked ? new Color(1, 1, 1, 0.55f) : Card);
                card.anchoredPosition = new Vector2(0, y);
                var b = card.gameObject.AddComponent<Button>(); b.targetGraphic = card.GetComponent<Image>(); b.onClick.AddListener(() => Choose(hub));
                var nm = Text(card, (h.code != null ? h.code + "  " : "") + h.name, 24, Fg, new Vector2(20, -12), new Vector2(420, 32)); nm.fontStyle = FontStyle.Bold;
                Text(card, h.sub, 17, Muted, new Vector2(20, -50), new Vector2(520, 46));
                string right = h.isMap ? "ดูแผนที่ ›" : h.locked ? "🔒 Lv " + h.lockLevel : new string('★', h.stars) + new string('☆', 5 - h.stars);
                var r = Text(card, right, 22, h.locked ? Muted : (Color)new Color32(0xE0, 0xA1, 0x00, 255), new Vector2(380, -12), new Vector2(160, 32)); r.alignment = TextAnchor.UpperRight;
                y -= 116;
            }
        }

        RectTransform Box(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 pivot, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = aMin; rt.anchorMax = aMax; rt.pivot = pivot; rt.sizeDelta = size; rt.anchoredPosition = Vector2.zero;
            var img = go.AddComponent<Image>(); img.color = color; img.raycastTarget = color.a > 0.01f; return rt;
        }
        Text Text(RectTransform parent, string text, int size, Color color, Vector2 pos, Vector2 box)
        {
            var go = new GameObject("Text", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(0, 1); rt.anchoredPosition = pos; rt.sizeDelta = box;
            var t = go.AddComponent<Text>(); t.font = _font; t.text = text; t.fontSize = size; t.color = color; t.alignment = TextAnchor.UpperLeft; t.raycastTarget = false;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow; return t;
        }
        Button Btn(RectTransform parent, string text, Vector2 pos, Vector2 size, Action onClick)
        {
            var rt = Box(parent, "Button", new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), size, Accent); rt.anchoredPosition = pos;
            var b = rt.gameObject.AddComponent<Button>(); b.targetGraphic = rt.GetComponent<Image>(); b.onClick.AddListener(() => onClick());
            var t = Text(rt, text, 19, Navy, Vector2.zero, size); t.alignment = TextAnchor.MiddleCenter; t.fontStyle = FontStyle.Bold; return b;
        }
    }
}
