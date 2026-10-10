using System;
using System.Collections.Generic;
using System.Text;
using ThaiRail.Data;
using ThaiRail.Game;
using ThaiRail.Simulation;
using ThaiRail.Stations;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace ThaiRail.UI
{
    /// <summary>
    /// Station HUD built in code (uGUI), driven only by an <see cref="IStationAdapter"/>: navy status bar,
    /// live train list (left), train card (bottom) and platform sheet (right), like the web build's station_view.js.
    /// Rebuilds text at 4 Hz and only when the content changed, and reuses its row objects (no per-frame allocation).
    /// Replace with an art-directed prefab later; it only has to read the same adapter.
    /// </summary>
    public sealed class StationHud : MonoBehaviour
    {
        [Tooltip("A Thai-capable font (e.g. IBM Plex Sans Thai). Empty = Unity's built-in font")] public Font font;
        [Tooltip("Reference resolution for the Canvas Scaler (landscape)")] public Vector2 referenceResolution = new Vector2(1920, 1080);

        // web palette (base.css)
        static readonly Color Navy = Hex(0x0F2240), Navy2 = Hex(0x1B355E), OnNavyMuted = Hex(0xA7B6CF), Panel = new Color(1, 1, 1, 0.94f), Fg = Hex(0x13233D),
            Muted = Hex(0x6B7A90), Line = Hex(0xD9DFE8), Accent = Hex(0xFFC20E), Good = Hex(0x16834F), Bad = Hex(0xC9353A), BadSoft = Hex(0xFCE4E5),
            GoodSoft = Hex(0xDDF3E7), SelectBlue = Hex(0x3A7BD5), Disabled = Hex(0xE6EAF0);
        static Color Hex(int v, float a = 1) { return new Color(((v >> 16) & 255) / 255f, ((v >> 8) & 255) / 255f, (v & 255) / 255f, a); }

        IStationAdapter _a;
        IStationView _runner;
        StationCameraRig _rig;
        string _sel; ListFilter _filter = ListFilter.All; bool _sheet;
        float _acc; string _listSig = "", _cardSig = "", _sheetSig = "";

        RectTransform _root, _list, _card, _sheetPanel, _sheetGrid;
        Text _clock, _money, _onTime, _inPlat, _held, _rev, _toast, _lvl;
        float _toastT;
        readonly List<Row> _rows = new List<Row>();
        readonly List<PlatBtn> _plats = new List<PlatBtn>();
        Text _cName, _cLabel, _cPhase, _cPlat, _cSchedL, _cSchedV, _cStatus, _cAction, _sTitle, _sSub;
        Button _cActionBtn; Image _cActionImg;
        readonly Button[] _filterBtns = new Button[3];

        sealed class Row { public GameObject go; public Image bg, bar; public Text code, name, right; public string id; }
        sealed class PlatBtn { public GameObject go; public Button btn; public Image img; public Text label; public int n; }

        public void Bind(IStationAdapter adapter, IStationView runner, StationCameraRig rig)
        {
            _a = adapter; _runner = runner; _rig = rig;
            if (_root == null) BuildUi();
            if (rig != null) rig.Tapped += OnTap;
            if (RailTrackWorld.Instance != null) RailTrackWorld.Instance.Notified += Toast;
            var ta = adapter as TimetableStationAdapter; if (ta != null) ta.Message += Toast;
            Select(null);
        }

        void OnDestroy()
        {
            if (_rig != null) _rig.Tapped -= OnTap;
            if (RailTrackWorld.Instance != null) RailTrackWorld.Instance.Notified -= Toast;
            var ta = _a as TimetableStationAdapter; if (ta != null) ta.Message -= Toast;
        }

        // ---------- interaction ----------
        void OnTap(Vector2 screen)
        {
            if (_runner == null || _rig == null) return;
            Select(_runner.Pick(_rig.GetComponent<Camera>(), screen));
        }
        void Select(string id)
        {
            _sel = id; _a.Select(id); _cardSig = ""; _listSig = "";
            if (id == null) _sheet = false;
            if (SelectionChanged != null) SelectionChanged(id);
            Refresh(true);
        }
        /// <summary>Raised when the selected train changes (null = none), e.g. for the DMI.</summary>
        public event Action<string> SelectionChanged;
        /// <summary>The HUD canvas, for station-specific panels (NX panel, DMI).</summary>
        public RectTransform CanvasRoot { get { return _root; } }
        public Font HudFont { get { return F; } }

        /// <summary>An extra tool button at the top-left under the live list header (e.g. "แผง NX").</summary>
        public Button AddToolButton(string text, int slot, Action onClick)
        {
            var b = Button(_root, text, new Vector2(16 + slot * 150, -(92 + 4)), new Vector2(140, 44), Navy2, Color.white, 19, onClick);
            var rt = b.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(0, 0); rt.pivot = new Vector2(0, 0); rt.anchoredPosition = new Vector2(16 + slot * 150, 16);
            return b;
        }
        void OnAction()
        {
            var vm = _sel != null ? _a.ViewModel(_sel) : null; if (vm == null || !vm.actionEnabled) return;
            if (vm.actionKind == CardActionKind.OpenPlatformSheet) { _sheet = true; _sheetSig = ""; }
            else _a.Act(_sel, vm.actionKind);
            Refresh(true);
        }
        void OnChoose(int n) { if (_sel != null && _a.Choose(_sel, n)) { _sheet = false; _a.Preview(null, _sel); } Refresh(true); }
        void OnFollow() { if (_sel == null || _runner == null || _rig == null) return; string id = _sel; _rig.FollowTarget = () => { Vector3 p; return _runner.TryGetPosition(id, out p) ? p : (Vector3?)null; }; }

        void Update()
        {
            if (_a == null) return;
            if (_toastT > 0) { _toastT -= Time.unscaledDeltaTime; _toast.transform.parent.gameObject.SetActive(_toastT > 0); }
            _acc += Time.unscaledDeltaTime; if (_acc < 0.25f) return; _acc = 0;
            Refresh(false);
            RenderModal();
        }

        void Refresh(bool force)
        {
            if (_a == null || _root == null) return;
            StatusBar();
            var ids = _a.Items(_filter);
            var sb = new StringBuilder();
            foreach (var id in ids) { var vm = _a.ViewModel(id); sb.Append(id).Append(vm.alert).Append(vm.sub).Append(vm.phase).Append('|'); }
            sb.Append(_sel).Append(_filter);
            string sig = sb.ToString();
            if (force || sig != _listSig) { _listSig = sig; RenderList(ids); }
            RenderCard();
            RenderSheet();
        }

        void StatusBar()
        {
            var W = RailTrackWorld.Instance; if (_runner == null || !_runner.Running || W == null) return;
            var S = _runner.Status();
            _money.text = "฿" + W.money.ToString("N0");
            _clock.text = Clock.HM(S.now) + (W.Difficulty.IsRain(S.now) ? " · ฝน" : "") + (W.Difficulty.IsRush(S.now) ? " · เร่งด่วน" : "");
            _onTime.text = S.dep > 0 ? Mathf.RoundToInt(100f * S.onTime / S.dep) + "%" : "—";
            _inPlat.text = S.inPlatform + "/" + S.platforms; _held.text = S.held.ToString(); _held.color = S.held > 0 ? Hex(0xFF8A8F) : Color.white;
            _rev.text = "฿" + S.revenue.ToString("N0");
            if (W.Meta != null) _lvl.text = "Lv " + W.Meta.P.lv + " · " + W.Meta.P.xp + "/" + W.Meta.XpNeed(W.Meta.P.lv) + " · " + W.Meta.P.coins + " เหรียญ";
        }

        void RenderList(IReadOnlyList<string> ids)
        {
            for (int i = 0; i < _rows.Count; i++)
            {
                var r = _rows[i];
                if (i >= ids.Count) { r.go.SetActive(false); r.id = null; continue; }
                var vm = _a.ViewModel(ids[i]); r.id = vm.id; r.go.SetActive(true);
                r.bar.color = vm.alert ? Accent : vm.icon == TrainIcon.InPlatform ? Good : Line;
                r.bg.color = vm.id == _sel ? Hex(0xE3E9F3) : vm.alert ? Hex(0xFFF8E0) : Color.white;
                r.code.text = (vm.icon == TrainIcon.Arriving ? "▼ " : vm.icon == TrainIcon.Departing ? "▲ " : "● ") + vm.code + "  <color=#6B7A90><size=18>" + "ABCD"[vm.cls] + (vm.real ? " · จริง" : "") + "</size></color>";
                r.name.text = vm.label + (vm.inDelayMinutes > 0 ? "  <color=#C9353A>+" + vm.inDelayMinutes + "′</color>" : "");
                r.right.text = vm.sub + "\n<size=17><color=#6B7A90>" + vm.phase + "</color></size>";
            }
            for (int i = 0; i < 3; i++) _filterBtns[i].GetComponent<Image>().color = (int)_filter == i ? Navy2 : Hex(0xF4F6F9);
            for (int i = 0; i < 3; i++) _filterBtns[i].GetComponentInChildren<Text>().color = (int)_filter == i ? Color.white : Fg;
        }

        void RenderCard()
        {
            var vm = _sel != null ? _a.ViewModel(_sel) : null;
            if (vm == null) { if (_card.gameObject.activeSelf) _card.gameObject.SetActive(false); if (_sel != null) Select(null); return; }
            string sig = vm.name + vm.phase + vm.platform + vm.schedValue + vm.status + vm.actionLabel + vm.actionEnabled;
            _card.gameObject.SetActive(true);
            if (sig == _cardSig) return; _cardSig = sig;
            _cName.text = vm.name + "  <size=20><color=#6B7A90>" + vm.typeName + " · " + vm.op + "</color></size>";
            _cLabel.text = vm.label + (vm.lift ? "  · ♿" : "");
            _cPhase.text = vm.phase; _cPlat.text = vm.platform;
            _cSchedL.text = vm.schedLabel; _cSchedV.text = vm.schedValue; _cSchedV.color = vm.schedTone == Tone.Bad ? Bad : Good;
            _cStatus.text = vm.status;
            _cAction.text = vm.actionLabel; _cActionBtn.interactable = vm.actionEnabled;
            _cActionImg.color = !vm.actionEnabled ? Disabled : vm.actionKind == CardActionKind.Go ? Good : Accent;
            _cAction.color = !vm.actionEnabled ? Muted : vm.actionKind == CardActionKind.Go ? Color.white : Navy;
        }

        void RenderSheet()
        {
            var vm = _sel != null ? _a.ViewModel(_sel) : null;
            bool show = _sheet && vm != null && vm.sheetOpen;
            _sheetPanel.gameObject.SetActive(show); if (!show) { _sheetSig = ""; return; }
            var plats = _a.Platforms(_sel);
            var sb = new StringBuilder(); foreach (var p in plats) sb.Append(p.n).Append(p.ok).Append(p.why).Append(';');
            string sig = sb.ToString(); if (sig == _sheetSig) return; _sheetSig = sig;
            _sTitle.text = vm.sheetTitle; _sSub.text = vm.sheetSub;
            while (_plats.Count < plats.Count) _plats.Add(MakePlat(_sheetGrid));
            for (int i = 0; i < _plats.Count; i++)
            {
                var b = _plats[i];
                if (i >= plats.Count) { b.go.SetActive(false); continue; }
                var p = plats[i]; b.go.SetActive(true); b.n = p.n;
                b.btn.interactable = p.ok;
                b.img.color = p.planned ? Hex(0xE3E9F3) : p.ok ? GoodSoft : Hex(0xF1F3F6);
                b.label.text = "<b>ราง " + p.n + "</b>  <size=17>ขนาด " + "ABCD"[p.maxClass] + "</size>\n<size=18><color=" + (p.ok ? "#16834F" : "#C9353A") + ">" + p.why + "</color></size>";
            }
        }

        /// <summary>Top-right controls: pause / speed and a station switcher.</summary>
        public void AddControls(string[] stations, string current, Action<string> onSwitch)
        {
            float x = -16;
            for (int i = stations.Length - 1; i >= 0; i--)
            {
                string id = stations[i]; bool cur = id == current;
                var b = Button(_root, id, new Vector2(x - 84, -14), new Vector2(84, 48), cur ? Accent : Navy2, cur ? Navy : Color.white, 20, () => onSwitch(id));
                var rt = b.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0, 1);
                x -= 92;
            }
            x -= 24;
            var speeds = new[] { 0f, 1f, 2f, 4f }; var names = new[] { "II", "1×", "2×", "4×" };
            for (int i = speeds.Length - 1; i >= 0; i--)
            {
                float sp = speeds[i];
                var b = Button(_root, names[i], new Vector2(x - 64, -14), new Vector2(64, 48), Navy2, Color.white, 20, () => { if (_runner != null && _runner.Running) _runner.Speed = sp; });
                var rt = b.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(1, 1); rt.pivot = new Vector2(0, 1);
                x -= 70;
            }
        }

        // ---------- modal (control room, rewards, ground teams) ----------
        RectTransform _modal, _modalContent; Text _modalTitle; Func<List<ModalRow>> _modalRows; string _modalSig = "";
        public bool ModalOpen { get { return _modal != null && _modal.gameObject.activeSelf; } }
        /// <summary>Open a modal whose rows are rebuilt (when they change) while it stays open.</summary>
        public void ShowModal(string title, Func<List<ModalRow>> rows)
        {
            if (_modal == null) BuildModal();
            _modalTitle.text = title; _modalRows = rows; _modalSig = null; _modal.gameObject.SetActive(true); RenderModal();
        }
        public void CloseModal() { if (_modal != null) _modal.gameObject.SetActive(false); _modalRows = null; }
        void BuildModal()
        {
            var shade = Box(_root, "ModalShade", Vector2.zero, Vector2.one, new Vector2(0.5f, 0.5f), Vector2.zero, Vector2.zero, new Color(0.04f, 0.08f, 0.15f, 0.55f));
            _modal = shade;
            var shadeBtn = shade.gameObject.AddComponent<Button>(); shadeBtn.targetGraphic = shade.GetComponent<Image>(); shadeBtn.onClick.AddListener(CloseModal);
            var win = Box(shade, "Modal", new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), new Vector2(0.5f, 0.5f), Vector2.zero, new Vector2(1000, 780), Color.white);
            win.gameObject.AddComponent<Button>().targetGraphic = win.GetComponent<Image>();   // swallow clicks so the shade does not close it
            var head = Box(win, "Head", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(0, 72), Navy);
            _modalTitle = Label(head, "", 28, Color.white, TextAnchor.MiddleLeft, new Vector2(24, 0), new Vector2(800, 72)); _modalTitle.fontStyle = FontStyle.Bold;
            var close = Button(head, "✕", new Vector2(1000 - 64, -12), new Vector2(48, 48), Navy2, Color.white, 24, CloseModal);
            var view = Box(win, "View", new Vector2(0, 0), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -72), new Vector2(0, -72), new Color(0, 0, 0, 0));
            view.gameObject.AddComponent<RectMask2D>();
            _modalContent = Box(view, "Content", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(0, 0), new Color(0, 0, 0, 0));
            var sr = view.gameObject.AddComponent<ScrollRect>(); sr.content = _modalContent; sr.horizontal = false; sr.vertical = true; sr.movementType = ScrollRect.MovementType.Clamped; sr.scrollSensitivity = 30;
            shade.gameObject.SetActive(false);
        }
        void RenderModal()
        {
            if (_modalRows == null || !ModalOpen) return;
            var rows = _modalRows();
            var sb = new StringBuilder();
            foreach (var r in rows) { sb.Append(r.title).Append(r.sub).Append(r.badge).Append(r.highlight); foreach (var b in r.buttons) sb.Append(b.label).Append(b.enabled); sb.Append('|'); }
            string sig = sb.ToString(); if (sig == _modalSig) return; _modalSig = sig;
            for (int i = _modalContent.childCount - 1; i >= 0; i--) Destroy(_modalContent.GetChild(i).gameObject);
            float y = -12;
            foreach (var r in rows)
            {
                float h = string.IsNullOrEmpty(r.sub) ? 56 : 92;
                var row = Box(_modalContent, "Row", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, y), new Vector2(-32, h), r.highlight ? Hex(0xFFF8E0) : Hex(0xF4F6F9));
                var t = Label(row, r.title, 22, Fg, TextAnchor.UpperLeft, new Vector2(18, -10), new Vector2(560, 30)); t.fontStyle = FontStyle.Bold;
                if (!string.IsNullOrEmpty(r.sub)) Label(row, r.sub, 17, Muted, TextAnchor.UpperLeft, new Vector2(18, -42), new Vector2(600, 46));
                if (!string.IsNullOrEmpty(r.badge)) { var bd = Label(row, r.badge, 17, Good, TextAnchor.UpperRight, new Vector2(18, -12), new Vector2(920, 26)); }
                float bx = 968 - 32;
                for (int k = r.buttons.Count - 1; k >= 0; k--)
                {
                    var b = r.buttons[k]; float w = Mathf.Max(120, 16 + b.label.Length * 13);
                    bx -= w + 10;
                    var act = b.onClick;
                    var btn = Button(row, b.label, new Vector2(bx, -(h - 52)), new Vector2(w, 44), b.enabled ? (b.primary ? Accent : Navy2) : Disabled, b.enabled ? (b.primary ? Navy : Color.white) : Muted, 18, () => { if (act != null) act(); _modalSig = ""; RenderModal(); });
                    btn.interactable = b.enabled;
                }
                y -= h + 10;
            }
            _modalContent.sizeDelta = new Vector2(0, -y + 12);
        }

        public void Toast(string text)
        {
            if (_toast == null) return;
            _toast.text = text; _toastT = 3f; _toast.transform.parent.gameObject.SetActive(true);
        }

        // ---------- construction ----------
        Font F { get { if (font == null) font = BuiltinFont(); return font; } }
        static Font BuiltinFont()
        {
            Font f = null;
            try { f = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf"); } catch (Exception) { }
            if (f == null) try { f = Resources.GetBuiltinResource<Font>("Arial.ttf"); } catch (Exception) { }
            return f;
        }

        void BuildUi()
        {
            var canvasGo = new GameObject("StationHud", typeof(RectTransform));
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 10;
            var scaler = canvasGo.AddComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize; scaler.referenceResolution = referenceResolution; scaler.matchWidthOrHeight = 0.6f;
            canvasGo.AddComponent<GraphicRaycaster>();
            if (EventSystem.current == null) { var es = new GameObject("EventSystem"); es.AddComponent<EventSystem>(); es.AddComponent<StandaloneInputModule>(); }
            _root = canvasGo.GetComponent<RectTransform>();

            // status bar
            var bar = Box(_root, "StatusBar", new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), Vector2.zero, new Vector2(0, 76), Navy);
            var stats = new[] { "เงินทุน", "เวลาสถานี", "ออกตรงเวลา", "ในชานชาลา", "รอสัญญาณเข้า", "รายได้สถานี" };
            var vals = new Text[stats.Length];
            for (int i = 0; i < stats.Length; i++)
            {
                var cell = Box(bar, stats[i], new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 0.5f), new Vector2(24 + i * 250, 0), new Vector2(240, 0), new Color(0, 0, 0, 0));
                Label(cell, stats[i], 17, OnNavyMuted, TextAnchor.UpperLeft, new Vector2(0, -8), new Vector2(240, 24));
                vals[i] = Label(cell, "—", 28, Color.white, TextAnchor.LowerLeft, new Vector2(0, -38), new Vector2(240, 34)); vals[i].fontStyle = FontStyle.Bold;
            }
            _money = vals[0]; _clock = vals[1]; _onTime = vals[2]; _inPlat = vals[3]; _held = vals[4]; _rev = vals[5];
            var lv = Box(bar, "Level", new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 0.5f), new Vector2(24 + stats.Length * 250, 0), new Vector2(300, 0), new Color(0, 0, 0, 0));
            Label(lv, "ผู้เล่น", 17, OnNavyMuted, TextAnchor.UpperLeft, new Vector2(0, -8), new Vector2(300, 24));
            _lvl = Label(lv, "—", 24, Accent, TextAnchor.LowerLeft, new Vector2(0, -38), new Vector2(300, 34)); _lvl.fontStyle = FontStyle.Bold;

            // live list
            _list = Box(_root, "LiveList", new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 1), new Vector2(16, -92), new Vector2(430, -110), Panel);
            var head = Label(_list, "ขบวนรถ", 24, Fg, TextAnchor.MiddleLeft, new Vector2(16, -10), new Vector2(200, 40)); head.fontStyle = FontStyle.Bold;
            string[] fl = { "ทั้งหมด", "ขาเข้า", "ในชานชาลา" };
            for (int i = 0; i < 3; i++)
            {
                int k = i; var fb = Button(_list, fl[i], new Vector2(16 + i * 134, -56), new Vector2(126, 40), Hex(0xF4F6F9), Fg, 19, () => { _filter = (ListFilter)k; Refresh(true); });
                _filterBtns[i] = fb;
            }
            for (int i = 0; i < 14; i++) _rows.Add(MakeRow(_list, i));

            // train card
            _card = Box(_root, "TrainCard", new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(0.5f, 0), new Vector2(120, 16), new Vector2(900, 250), Panel);
            _cName = Label(_card, "", 30, Fg, TextAnchor.UpperLeft, new Vector2(24, -14), new Vector2(760, 40)); _cName.fontStyle = FontStyle.Bold;
            _cLabel = Label(_card, "", 21, Muted, TextAnchor.UpperLeft, new Vector2(24, -56), new Vector2(760, 30));
            Label(_card, "สถานะ", 17, Muted, TextAnchor.UpperLeft, new Vector2(24, -96), new Vector2(200, 24));
            _cPhase = Label(_card, "", 24, Fg, TextAnchor.UpperLeft, new Vector2(24, -118), new Vector2(260, 32));
            Label(_card, "ชานชาลา", 17, Muted, TextAnchor.UpperLeft, new Vector2(300, -96), new Vector2(200, 24));
            _cPlat = Label(_card, "", 24, Fg, TextAnchor.UpperLeft, new Vector2(300, -118), new Vector2(200, 32));
            _cSchedL = Label(_card, "", 17, Muted, TextAnchor.UpperLeft, new Vector2(520, -96), new Vector2(360, 24));
            _cSchedV = Label(_card, "", 24, Good, TextAnchor.UpperLeft, new Vector2(520, -118), new Vector2(360, 32));
            _cStatus = Label(_card, "", 20, Fg, TextAnchor.UpperLeft, new Vector2(24, -160), new Vector2(560, 60));
            _cActionBtn = Button(_card, "", new Vector2(600, -170), new Vector2(276, 64), Accent, Navy, 24, OnAction);
            _cAction = _cActionBtn.GetComponentInChildren<Text>(); _cActionImg = _cActionBtn.GetComponent<Image>();
            Button(_card, "✕", new Vector2(836, -12), new Vector2(48, 44), Hex(0xF4F6F9), Fg, 22, () => Select(null));
            Button(_card, "ติดตาม", new Vector2(720, -12), new Vector2(108, 44), Hex(0xF4F6F9), Fg, 19, OnFollow);
            _card.gameObject.SetActive(false);

            // platform sheet
            _sheetPanel = Box(_root, "PlatformSheet", new Vector2(1, 0), new Vector2(1, 1), new Vector2(1, 1), new Vector2(-16, -92), new Vector2(420, -110), Panel);
            _sTitle = Label(_sheetPanel, "เลือกชานชาลา", 26, Fg, TextAnchor.UpperLeft, new Vector2(20, -14), new Vector2(320, 36)); _sTitle.fontStyle = FontStyle.Bold;
            _sSub = Label(_sheetPanel, "", 18, Muted, TextAnchor.UpperLeft, new Vector2(20, -52), new Vector2(380, 28));
            Button(_sheetPanel, "✕", new Vector2(356, -12), new Vector2(48, 44), Hex(0xF4F6F9), Fg, 22, () => { _sheet = false; _a.Preview(null, _sel); Refresh(true); });
            _sheetGrid = Box(_sheetPanel, "Grid", new Vector2(0, 0), new Vector2(1, 1), new Vector2(0, 1), new Vector2(16, -92), new Vector2(-32, -108), new Color(0, 0, 0, 0));
            var gl = _sheetGrid.gameObject.AddComponent<GridLayoutGroup>(); gl.cellSize = new Vector2(186, 78); gl.spacing = new Vector2(10, 10);
            _sheetPanel.gameObject.SetActive(false);

            // toast
            var tb = Box(_root, "Toast", new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0.5f, 1), new Vector2(0, -96), new Vector2(760, 54), Hex(0x0F2240, 0.92f));
            _toast = Label(tb, "", 21, Color.white, TextAnchor.MiddleCenter, Vector2.zero, new Vector2(760, 54));
            tb.gameObject.SetActive(false);
        }

        Row MakeRow(RectTransform parent, int i)
        {
            var r = new Row();
            var rt = Box(parent, "Row" + i, new Vector2(0, 1), new Vector2(1, 1), new Vector2(0.5f, 1), new Vector2(0, -108 - i * 66), new Vector2(-24, 60), Color.white);
            r.go = rt.gameObject; r.bg = rt.GetComponent<Image>();
            r.bar = Box(rt, "Bar", new Vector2(0, 0), new Vector2(0, 1), new Vector2(0, 0.5f), Vector2.zero, new Vector2(6, 0), Line).GetComponent<Image>();
            r.code = Label(rt, "", 21, Fg, TextAnchor.UpperLeft, new Vector2(16, -4), new Vector2(250, 28)); r.code.fontStyle = FontStyle.Bold;
            r.name = Label(rt, "", 17, Muted, TextAnchor.UpperLeft, new Vector2(16, -32), new Vector2(260, 24));
            r.right = Label(rt, "", 20, Fg, TextAnchor.UpperRight, new Vector2(270, -6), new Vector2(120, 50));
            var btn = r.go.AddComponent<Button>(); btn.targetGraphic = r.bg;
            btn.onClick.AddListener(() => { if (r.id != null) Select(r.id == _sel ? null : r.id); });
            r.go.SetActive(false);
            return r;
        }

        PlatBtn MakePlat(RectTransform grid)
        {
            var p = new PlatBtn();
            var go = new GameObject("Platform", typeof(RectTransform)); go.transform.SetParent(grid, false);
            p.go = go; p.img = go.AddComponent<Image>(); p.btn = go.AddComponent<Button>(); p.btn.targetGraphic = p.img;
            p.label = Label(go.GetComponent<RectTransform>(), "", 21, Fg, TextAnchor.MiddleLeft, new Vector2(14, 0), new Vector2(170, 78));
            p.label.rectTransform.anchorMin = new Vector2(0, 0); p.label.rectTransform.anchorMax = new Vector2(1, 1); p.label.rectTransform.offsetMin = new Vector2(14, 0); p.label.rectTransform.offsetMax = new Vector2(-8, 0);
            p.btn.onClick.AddListener(() => OnChoose(p.n));
            var hover = go.AddComponent<EventTrigger>();
            var enter = new EventTrigger.Entry { eventID = EventTriggerType.PointerEnter }; enter.callback.AddListener(_ => _a.Preview(p.n, _sel)); hover.triggers.Add(enter);
            return p;
        }

        // anchored box: offset/size are anchoredPosition/sizeDelta
        RectTransform Box(RectTransform parent, string name, Vector2 aMin, Vector2 aMax, Vector2 pivot, Vector2 pos, Vector2 size, Color color)
        {
            var go = new GameObject(name, typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = aMin; rt.anchorMax = aMax; rt.pivot = pivot; rt.anchoredPosition = pos; rt.sizeDelta = size;
            var img = go.AddComponent<Image>(); img.color = color; img.raycastTarget = color.a > 0.01f;
            return rt;
        }
        Text Label(RectTransform parent, string text, int size, Color color, TextAnchor align, Vector2 pos, Vector2 box)
        {
            var go = new GameObject("Text", typeof(RectTransform)); go.transform.SetParent(parent, false);
            var rt = go.GetComponent<RectTransform>(); rt.anchorMin = rt.anchorMax = new Vector2(0, 1); rt.pivot = new Vector2(0, 1); rt.anchoredPosition = pos; rt.sizeDelta = box;
            var t = go.AddComponent<Text>(); t.font = F; t.text = text; t.fontSize = size; t.color = color; t.alignment = align; t.supportRichText = true;
            t.horizontalOverflow = HorizontalWrapMode.Wrap; t.verticalOverflow = VerticalWrapMode.Overflow; t.raycastTarget = false;
            return t;
        }
        Button Button(RectTransform parent, string text, Vector2 pos, Vector2 size, Color bg, Color fg, int fontSize, Action onClick)
        {
            var rt = Box(parent, "Button " + text, new Vector2(0, 1), new Vector2(0, 1), new Vector2(0, 1), pos, size, bg);
            var b = rt.gameObject.AddComponent<Button>(); b.targetGraphic = rt.GetComponent<Image>();
            var t = Label(rt, text, fontSize, fg, TextAnchor.MiddleCenter, Vector2.zero, size); t.fontStyle = FontStyle.Bold;
            b.onClick.AddListener(() => onClick());
            return b;
        }
    }
}
