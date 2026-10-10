using System;
using System.Collections.Generic;
using System.Linq;
using ThaiRail.Data;

namespace ThaiRail.Meta
{
    /// <summary>The player profile (port of META in railway/src/meta.js); survives station and network resets.</summary>
    [Serializable]
    public sealed class MetaProfile
    {
        public int v = 1, xp, lv = 1, coins, cap, crew;
        public List<int> claimed = new List<int>();
        public List<string> liveries = new List<string> { "std" }, trial = new List<string>();
        /// <summary>Controller key → active until (Unix ms, real time).</summary>
        public List<ControllerRental> ctrl = new List<ControllerRental>();
        /// <summary>Local date of the last daily gift (yyyy-MM-dd).</summary>
        public string gift = "";
    }
    [Serializable] public struct ControllerRental { public string k; public long untilMs; }

    public enum PayWith { Trial, Coins, Baht }

    /// <summary>
    /// Levels, XP, coins, level rewards, the daily gift and the control-room controllers (rented in real minutes).
    /// Port of gainXP / claimReward / activateCtrl / ctrlOn / giftReady in meta.js. Pure C#: the clock and the
    /// money account are injected so it can be tested and saved.
    /// </summary>
    public sealed class MetaService
    {
        public MetaProfile P { get; private set; }
        readonly ProgressionFile _d;
        readonly Func<DateTime> _now;
        public event Action<int> LevelUp;
        public event Action<string> Message;

        public MetaService(ProgressionFile data, MetaProfile saved = null, Func<DateTime> utcNow = null)
        {
            _d = data; _now = utcNow ?? (() => DateTime.UtcNow);
            var c = data.constants;
            P = saved != null && saved.v == 1 ? saved : new MetaProfile { coins = c.startCoins, cap = c.startCap, crew = c.startCrew };
        }
        public MetaConstants C { get { return _d.constants; } }
        long NowMs { get { return (long)(_now() - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalMilliseconds; } }
        void Say(string m) { if (Message != null) Message(m); }

        // ---------- level / XP ----------
        /// <summary>XP needed to leave a level (60 × lv^1.45, rounded like the web build).</summary>
        public int XpNeed(int lv) { return lv >= 1 && lv <= _d.xpNeed.Length ? _d.xpNeed[lv - 1] : (int)Math.Floor(60 * Math.Pow(lv, 1.45) + 0.5); }
        public void GainXP(int n)
        {
            P.xp += n; int up = 0;
            while (P.xp >= XpNeed(P.lv)) { P.xp -= XpNeed(P.lv); P.lv++; P.coins += C.levelCoins; up++; }
            if (up > 0) { Say("เลเวลอัป! Lv " + P.lv + " · มีรางวัลรอรับ (+" + C.levelCoins * up + " เหรียญทอง)"); if (LevelUp != null) LevelUp(P.lv); }
        }
        public void AddCoins(int n) { P.coins += n; }
        public bool SpendCoins(int n) { if (P.coins < n) { Say("เหรียญทองไม่พอ ต้องใช้ " + n + " เหรียญ"); return false; } P.coins -= n; return true; }

        // ---------- rewards ----------
        public IEnumerable<Reward> Claimable { get { return _d.rewards.Where(r => r.lv <= P.lv && !P.claimed.Contains(r.lv)); } }
        public string RewardLabel(Reward r)
        {
            switch (r.kind)
            {
                case "money": return "฿" + int.Parse(r.value).ToString("N0");
                case "coins": return r.value + " เหรียญ";
                case "cap": return "+" + r.value + " ความจุสัญญา";
                case "crew": return "+" + r.value + " ลูกเรือ";
                case "liv": { var l = _d.liveries.FirstOrDefault(x => x.k == r.value); return "ลาย" + (l != null ? l.name : r.value); }
            }
            return r.kind;
        }
        /// <summary>Claim a level reward; money goes to <paramref name="earn"/>.</summary>
        public bool ClaimReward(int lv, Action<int> earn)
        {
            var r = _d.rewards.FirstOrDefault(x => x.lv == lv);
            if (r == null || P.claimed.Contains(lv) || P.lv < lv) return false;
            P.claimed.Add(lv);
            int v; int.TryParse(r.value, out v);
            switch (r.kind)
            {
                case "money": earn(v); break;
                case "coins": P.coins += v; break;
                case "cap": P.cap = Math.Min(C.capMax, P.cap + v); break;
                case "crew": P.crew = Math.Min(C.crewMax, P.crew + v); break;
                case "liv": if (!P.liveries.Contains(r.value)) P.liveries.Add(r.value); break;
            }
            Say("รับรางวัล Lv " + lv + ": " + RewardLabel(r));
            return true;
        }

        // ---------- daily gift ----------
        string GiftKey { get { return _now().ToLocalTime().ToString("yyyy-MM-dd"); } }
        public bool GiftReady { get { return P.gift != GiftKey; } }
        public bool ClaimGift() { if (!GiftReady) { Say("รับของขวัญวันนี้ไปแล้ว พรุ่งนี้มาใหม่"); return false; } P.gift = GiftKey; P.coins += C.giftCoins; Say("+" + C.giftCoins + " เหรียญทอง · ของขวัญรายวัน"); return true; }

        // ---------- controllers ----------
        int Ctrl(string k) { return P.ctrl.FindIndex(x => x.k == k); }
        public bool ControllerOn(string k) { int i = Ctrl(k); return i >= 0 && P.ctrl[i].untilMs > NowMs; }
        /// <summary>Seconds a controller still works (0 = off).</summary>
        public double ControllerRemaining(string k) { int i = Ctrl(k); return i < 0 ? 0 : Math.Max(0, (P.ctrl[i].untilMs - NowMs) / 1000.0); }
        public bool TrialAvailable(string k) { return !P.trial.Contains(k); }
        /// <summary>Start or extend a controller by ctrlMin minutes. Baht is charged through <paramref name="spendBaht"/>.</summary>
        public bool ActivateController(string k, PayWith pay, Func<int, bool> spendBaht)
        {
            if (pay == PayWith.Trial) { if (!TrialAvailable(k)) return false; P.trial.Add(k); }
            else if (pay == PayWith.Coins) { if (!SpendCoins(C.ctrlCoins)) return false; }
            else if (!spendBaht(C.ctrlBaht)) { Say("เงินทุนไม่พอ ต้องใช้ ฿" + C.ctrlBaht.ToString("N0")); return false; }
            int i = Ctrl(k); long from = Math.Max(NowMs, i >= 0 ? P.ctrl[i].untilMs : 0), until = from + C.ctrlMin * 60000L;
            var rent = new ControllerRental { k = k, untilMs = until };
            if (i >= 0) P.ctrl[i] = rent; else P.ctrl.Add(rent);
            var def = _d.controllers.FirstOrDefault(x => x.k == k); Say((def != null ? def.name : k) + " เริ่มทำงาน");
            return true;
        }
        public IEnumerable<ControllerDef> Controllers { get { return _d.controllers; } }
    }
}
