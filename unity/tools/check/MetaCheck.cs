// Meta layer checks: levels and level-up coins, rewards claimed once, daily gift per day, controllers rented in
// real minutes (trial once, coins, baht, extending), ground-service teams bought within their limits.
using System; using System.IO; using System.Linq;
using ThaiRail.Data; using ThaiRail.Meta; using ThaiRail.Simulation; using ThaiRail.Simulation.Hlp;

static class MetaCheck
{
    public static void Run(RailTrackDatabase db, string dataDir, Action<string, bool, string> Check)
    {
        var now = new DateTime(2026, 10, 10, 3, 0, 0, DateTimeKind.Utc);
        var M = new MetaService(db.progression, null, () => now);
        int start = M.P.coins;
        M.GainXP(M.XpNeed(1) + 5);
        Check("meta: level up gives coins and keeps leftover XP", M.P.lv == 2 && M.P.xp == 5 && M.P.coins == start + db.progression.constants.levelCoins && M.XpNeed(2) == 164, "Lv " + M.P.lv + " XP " + M.P.xp + " coins " + M.P.coins);

        int earned = 0;
        bool first = M.ClaimReward(2, n => earned += n), again = M.ClaimReward(2, n => earned += n), locked = M.ClaimReward(3, n => earned += n);
        Check("meta: a level reward is claimed once, locked ones not at all", first && !again && !locked && earned == 20000 && M.Claimable.Count() == 0, "earned ฿" + earned);

        int c0 = M.P.coins; bool g1 = M.ClaimGift(), g2 = M.ClaimGift(); now = now.AddDays(1); bool g3 = M.GiftReady;
        Check("meta: daily gift once per day", g1 && !g2 && g3 && M.P.coins == c0 + db.progression.constants.giftCoins, "coins " + c0 + " → " + M.P.coins);

        bool trial = M.ActivateController("app", PayWith.Trial, n => false), on = M.ControllerOn("app"), rem = Math.Abs(M.ControllerRemaining("app") - 900) < 1;
        bool trialAgain = M.ActivateController("app", PayWith.Trial, n => false);
        int coins = M.P.coins; bool extend = M.ActivateController("app", PayWith.Coins, n => false);
        bool extended = Math.Abs(M.ControllerRemaining("app") - 1800) < 1 && M.P.coins == coins - db.progression.constants.ctrlCoins;
        now = now.AddMinutes(31); bool off = !M.ControllerOn("app");
        bool noMoney = !M.ActivateController("dep", PayWith.Baht, n => false); int paid = 0; bool baht = M.ActivateController("dep", PayWith.Baht, n => { paid = n; return true; });
        Check("meta: controllers run for real minutes (trial once, extend with coins, pay baht)", trial && on && rem && !trialAgain && extend && extended && off && noMoney && baht && paid == 30000 && M.ControllerOn("dep"), "app " + (on ? "on" : "off") + " → off after 31 min, dep paid ฿" + paid);

        var file = UnityEngine.JsonUtility.FromJson<HlpFile>(File.ReadAllText(Path.Combine(dataDir, "hualamphong.json")));
        var rng = new Random(3); var E = new HlpEngine(file, db.stations.hualamphong, new Difficulty(db.difficulty, rng), new TestHost(), rng);
        long wallet = 100000; Func<int, bool> spend = n => { if (wallet < n) return false; wallet -= n; return true; };
        string msg; int staff = E.S.res[E.ResIndex("staff")];
        bool bought = E.BuyTeams("staff", 2, spend, out msg) && E.S.res[E.ResIndex("staff")] == staff + 2 && wallet == 100000 - 24000;
        bool capped = !E.BuyTeams("lift", 50, spend, out msg) && msg.Contains("สูงสุด");
        bool broke = !E.BuyTeams("truck", 3, spend, out msg) && msg.Contains("ไม่พอ");
        Check("ground teams: hire within limits and funds", bought && capped && broke, "wallet ฿" + wallet);
    }
}
