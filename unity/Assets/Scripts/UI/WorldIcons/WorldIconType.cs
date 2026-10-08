namespace ThaiRail.UI.WorldIcons
{
    /// <summary>
    /// What a floating icon means. Order is serialized in the style set: only append.
    /// Yellow is reserved for icons that need the player NOW (see WorldIconStyleSet defaults).
    /// </summary>
    public enum WorldIconType : byte
    {
        None = 0,

        // Needs the player (yellow, pulsing, tappable)
        NeedsPlatform = 1,   // train held at the home signal: tap to assign a platform
        ServiceRefuel = 2,   // tap to dispatch the fuel truck
        ServiceClean = 3,    // tap to dispatch the cleaning cart
        ServiceLoad = 4,     // tap to dispatch the forklift
        NeedsRepair = 5,     // breakdown / low condition: tap to send repair

        // Positive state (green, tappable)
        ReadyToDepart = 10,  // all services done: tap to open the yellow Depart action

        // Informational (muted navy/grey, not tappable)
        ServiceInProgress = 20, // shows a progress ring
        WaitingForTrack = 21,   // blocked by another route
        Locked = 22,            // station not unlocked yet
        Overcrowded = 23        // passengers piling up at a station
    }
}
