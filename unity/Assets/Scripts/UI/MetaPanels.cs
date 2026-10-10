using System;
using System.Collections.Generic;
using System.Linq;
using ThaiRail.Game;
using ThaiRail.Meta;
using ThaiRail.Simulation.Hlp;

namespace ThaiRail.UI
{
    /// <summary>
    /// Content of the meta screens as modal rows (port of renderCtrl / the rewards view / renderGS in meta.js):
    /// control room (controllers rented in real minutes: free trial, coins or baht), level rewards with the daily gift,
    /// and Hua Lamphong's ground-service teams.
    /// </summary>
    public static class MetaPanels
    {
        static string Mmss(double s) { return ((int)(s / 60)) + ":" + ((int)(s % 60)).ToString("00"); }

        public static List<ModalRow> ControlRoom(RailTrackWorld W)
        {
            var M = W.Meta; var C = M.C; var rows = new List<ModalRow>();
            foreach (var c in M.Controllers)
            {
                string k = c.k; bool on = M.ControllerOn(k);
                var r = new ModalRow { title = c.name + "  ·  " + c.en, sub = c.where + " · " + c.desc, highlight = on, badge = on ? "ทำงาน · เหลือ " + Mmss(M.ControllerRemaining(k)) : "" };
                if (on) r.Button("+" + C.ctrlMin + " นาที · " + C.ctrlCoins + " เหรียญ", M.P.coins >= C.ctrlCoins, () => M.ActivateController(k, PayWith.Coins, W.Spend));
                else if (M.TrialAvailable(k)) r.Button("ทดลองฟรี " + C.ctrlMin + " นาที", true, () => M.ActivateController(k, PayWith.Trial, W.Spend), true);
                else
                {
                    r.Button(C.ctrlCoins + " เหรียญ", M.P.coins >= C.ctrlCoins, () => M.ActivateController(k, PayWith.Coins, W.Spend), true);
                    r.Button("฿" + C.ctrlBaht.ToString("N0"), W.money >= C.ctrlBaht, () => M.ActivateController(k, PayWith.Baht, W.Spend));
                }
                rows.Add(r);
            }
            rows.Add(new ModalRow { title = "ผู้ควบคุมทำงานตามเวลาจริง", sub = "ARS บนแผง NX ของหัวลำโพงจะทำงานเมื่อผู้ควบคุมขาเข้า/ขาออกทำงานอยู่ · ผู้ควบคุมภาคพื้นและสับเปลี่ยนใช้ได้ทุกสถานี" });
            return rows;
        }

        public static List<ModalRow> Rewards(RailTrackWorld W, Action<int> earn)
        {
            var M = W.Meta; var rows = new List<ModalRow>();
            var gift = new ModalRow { title = "ของขวัญรายวัน", sub = "รับ " + M.C.giftCoins + " เหรียญทองทุกวัน", highlight = M.GiftReady };
            gift.Button(M.GiftReady ? "รับเลย" : "พรุ่งนี้มาใหม่", M.GiftReady, () => M.ClaimGift(), true);
            rows.Add(gift);
            rows.Add(new ModalRow { title = "เลเวล " + M.P.lv + " · XP " + M.P.xp + "/" + M.XpNeed(M.P.lv), sub = "เหรียญทอง " + M.P.coins + " · ความจุสัญญา " + M.P.cap + " · ลูกเรือ " + M.P.crew + " · ลายรถ " + M.P.liveries.Count + " แบบ" });
            foreach (var r in W.Db.progression.rewards)
            {
                int lv = r.lv; bool got = M.P.claimed.Contains(lv), can = !got && M.P.lv >= lv;
                var row = new ModalRow { title = "Lv " + lv + " · " + M.RewardLabel(r), sub = got ? "รับแล้ว" : can ? "พร้อมรับ" : "ปลดล็อกที่เลเวล " + lv, highlight = can };
                if (!got) row.Button(can ? "รับรางวัล" : "🔒", can, () => M.ClaimReward(lv, earn), true);
                rows.Add(row);
            }
            return rows;
        }

        public static List<ModalRow> GroundTeams(RailTrackWorld W, HlpEngine E, Action<string> say)
        {
            var rows = new List<ModalRow>(); var busy = E.Busy;
            foreach (var d in E.G.file.resources)
            {
                int i = E.ResIndex(d.k), have = E.S.res[i], b = busy != null && i < busy.Length ? busy[i] : 0, q = E.Queued(d.k); string k = d.k;
                var r = new ModalRow { title = d.name, sub = "ว่าง " + (have - b) + " · ทำงาน " + b + " · รอคิว " + q + " · มี " + have + "/" + d.max, highlight = q > 0, badge = q > 0 ? "งานรอทีม " + q : "" };
                Action<int> buy = n => { string m; E.BuyTeams(k, n, W.Spend, out m); if (m != null) say(m); };
                r.Button("+1 · ฿" + d.price.ToString("N0"), have < d.max && W.money >= d.price, () => buy(1), true);
                if (have + 3 <= d.max) r.Button("+3 · ฿" + (d.price * 3).ToString("N0"), W.money >= d.price * 3, () => buy(3));
                rows.Add(r);
            }
            return rows;
        }
    }
}
