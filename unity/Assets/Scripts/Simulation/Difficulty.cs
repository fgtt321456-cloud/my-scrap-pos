using System;
using ThaiRail.Data;

namespace ThaiRail.Simulation
{
    /// <summary>
    /// Port of railway/src/difficulty.js. Pure C#: tuning comes from difficulty.json, randomness from an injected
    /// System.Random so a test (or a replay) can seed it.
    /// </summary>
    public sealed class Difficulty
    {
        readonly DifficultyFile _d;
        readonly Random _rng;
        public int PlayerLevel = 1;

        public Difficulty(DifficultyFile data, Random rng) { _d = data; _rng = rng; }
        public DifficultyFile Data { get { return _d; } }

        float Chance(float p, float pLv, float pMax) { return Math.Min(pMax, p + pLv * (Math.Max(1, PlayerLevel) - 1)); }

        /// <summary>Headway factor at a world second: below 1 during the morning and evening peaks.</summary>
        public float RushFactor(double sec)
        {
            double h = (sec / 3600.0) % 24.0;
            foreach (var w in _d.rush) if (h >= w.from && h < w.to) return w.factor;
            return 1f;
        }
        public bool IsRush(double sec) { return RushFactor(sec) < 1f; }

        /// <summary>Same deterministic per-day weather as the web build, so every station sees the same sky.</summary>
        public bool IsRain(double sec)
        {
            double d = Math.Floor(sec / Clock.Day) + 1, x = Math.Sin(d * 127.1 + 311.7) * 43758.5453;
            return x - Math.Floor(x) < _d.rain.p;
        }

        /// <summary>Inbound delay in minutes for a train with no ledger entry (0 most of the time).</summary>
        public int RollDelay(double sec)
        {
            float p = Chance(_d.delay.p, _d.delay.pLv, _d.delay.pMax) + (IsRain(sec) ? _d.rain.delayP : 0f);
            if (_rng.NextDouble() >= p) return 0;
            double m = -Math.Log(1 - _rng.NextDouble()) * _d.delay.mean;
            return (int)Math.Min(_d.delay.max, Math.Max(2, Clock.JsRound(m)));
        }

        /// <summary>A dwell fault: true with its text and extra minutes.</summary>
        public bool RollFault(out string kind, out int minutes)
        {
            kind = null; minutes = 0;
            if (_rng.NextDouble() >= Chance(_d.fault.p, _d.fault.pLv, _d.fault.pMax)) return false;
            kind = _d.fault.kinds[_rng.Next(_d.fault.kinds.Length)];
            minutes = _rng.Next(_d.fault.min, _d.fault.max + 1);
            return true;
        }

        public int ArsReactSeconds() { return _rng.Next(_d.ars.reactArrMin, _d.ars.reactArrMax + 1); }
        public int ArsDepartureLagSeconds() { return _rng.Next(_d.ars.lagDepMin, _d.ars.lagDepMax + 1); }
        public bool ArsPicksWorse() { return _rng.NextDouble() < _d.ars.pickWrong; }
    }
}
