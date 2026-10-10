using UnityEngine;

namespace ThaiRail.Stations
{
    /// <summary>Numbers for the HUD status bar.</summary>
    public struct StationStatus { public double now; public int dep, onTime, inPlatform, platforms, held; public long revenue; }

    /// <summary>
    /// What the HUD, camera and bootstrap need from a running station scene, whichever engine drives it
    /// (TimetableStationRunner for CMI/NKI/UBN/HDY/KRT, HlpStationRunner for Hua Lamphong).
    /// </summary>
    public interface IStationView
    {
        bool Running { get; }
        IStationAdapter Adapter { get; }
        /// <summary>Simulation speed multiplier (0 = paused).</summary>
        float Speed { get; set; }
        StationStatus Status();
        /// <summary>The train under a screen point, or null.</summary>
        string Pick(Camera cam, Vector2 screen, float radiusPx = 40);
        /// <summary>World position of a service's train, false when it is not on screen.</summary>
        bool TryGetPosition(string serviceId, out Vector3 pos);
    }
}
