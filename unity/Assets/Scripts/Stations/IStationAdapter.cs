using System.Collections.Generic;

namespace ThaiRail.Stations
{
    public enum TrainIcon { Arriving, InPlatform, Departing }
    public enum CardActionKind { None, OpenPlatformSheet, Go }
    public enum Tone { Neutral, Good, Bad }
    public enum ListFilter { All, Arrivals, InPlatform }

    /// <summary>
    /// Everything the shared train list / train card / platform sheet show for one service.
    /// Port of TrainViewModel in railway/src/station_view.js: the UI never reads simulation objects directly.
    /// </summary>
    public sealed class TrainViewModel
    {
        public string id, code, name, label, typeName, phase, platform, op, status, right, sub;
        public bool alert, lift, real, special;
        /// <summary>Consist length class 0..3 (A..D).</summary>
        public int cls;
        public TrainIcon icon;
        public int? revenue;
        /// <summary>Up to three model ids for the thumbnail (head, middle, tail).</summary>
        public string[] consist;
        public string schedLabel, schedValue; public Tone schedTone; public float schedProgress;
        public string contractTitle; public int contractN, contractUp, contractDown; public bool hasContract;
        public string actionLabel; public bool actionEnabled; public CardActionKind actionKind;
        public string sheetTitle, sheetSub; public bool sheetOpen;
        /// <summary>Delay inherited from upstream (shown, but not scored against the player).</summary>
        public int inDelayMinutes;
        public string fault;
    }

    public struct PlatformChoice { public int n; public bool ok, planned; public string why; public int maxClass; }

    /// <summary>
    /// One per playable station. Hua Lamphong (interlocking engine) and the timetable stations both implement it,
    /// so a single UI prefab serves every station. Port of the adapter contract in railway/src/station_view.js.
    /// </summary>
    public interface IStationAdapter
    {
        /// <summary>Services to list, most urgent first (alerts, then by time). At most 14.</summary>
        IReadOnlyList<string> Items(ListFilter filter);
        TrainViewModel ViewModel(string serviceId);
        IReadOnlyList<PlatformChoice> Platforms(string serviceId);
        /// <summary>Assign (train approaching) or plan (scheduled) a platform. Returns true when accepted.</summary>
        bool Choose(string serviceId, int platform);
        /// <summary>The card's main button, e.g. release / send to depot.</summary>
        void Act(string serviceId, CardActionKind kind);
        void Follow(string serviceId);
        void Select(string serviceIdOrNull);
        /// <summary>Highlight the route to a platform while the sheet is open (null clears it).</summary>
        void Preview(int? platform, string serviceId);
    }
}
