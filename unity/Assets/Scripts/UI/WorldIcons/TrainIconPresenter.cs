using System;
using ThaiRail.GroundServices;
using ThaiRail.Stations;
using UnityEngine;

namespace ThaiRail.UI.WorldIcons
{
    /// <summary>
    /// Example binding between a StationController and the floating icons.
    /// Parked train shows one tappable icon per pending service (Refuel / Clean / Load), a progress ring
    /// while a vehicle works, then a single green check when it can depart. Taps go straight back into
    /// the station, so the core loop works without opening any panel.
    /// </summary>
    public sealed class TrainIconPresenter : MonoBehaviour
    {
        [SerializeField] private StationController station;

        [Tooltip("Off: tapping the green check raises DepartRequested so the HUD can show the yellow Depart button. " +
                 "On: departs immediately.")]
        [SerializeField] private bool departOnTap;

        /// <summary>Raised when the player taps a ready train. Show the yellow Depart button for this platform.</summary>
        public event Action<int> DepartRequested;

        private const int SlotRefuel = 0, SlotClean = 1, SlotLoad = 2;
        private WorldIconAnchor[] _anchors;
        private bool[] _anyInProgress;

        private void OnEnable()
        {
            int n = station.PlatformCount;
            _anchors = new WorldIconAnchor[n];
            _anyInProgress = new bool[n];
            station.PlatformChanged += Refresh;
            if (WorldIconCanvas.Instance != null) WorldIconCanvas.Instance.IconClicked += OnIconClicked;
            for (int i = 0; i < n; i++) Refresh(i);
        }

        private void OnDisable()
        {
            station.PlatformChanged -= Refresh;
            if (WorldIconCanvas.Instance != null) WorldIconCanvas.Instance.IconClicked -= OnIconClicked;
            if (_anchors == null) return;
            for (int i = 0; i < _anchors.Length; i++) if (_anchors[i] != null) _anchors[i].HideAll();
        }

        /// <summary>Called only when a platform's state changes (arrival, service start/finish, departure).</summary>
        private void Refresh(int platform)
        {
            var canvas = WorldIconCanvas.Instance;
            if (canvas == null) return;

            var p = station.GetPlatform(platform);
            var anchor = p.Train != null && p.Train.Cars.Count > 0 ? p.Train.Cars[0].GetComponent<WorldIconAnchor>() : null;

            // Train changed or left: clear the old anchor.
            if (_anchors[platform] != null && _anchors[platform] != anchor) _anchors[platform].HideAll();
            _anchors[platform] = anchor;
            _anyInProgress[platform] = false;
            if (anchor == null) return;
            anchor.UserId = platform;

            if (station.IsReadyToDepart(platform))
            {
                anchor.HideAll();
                canvas.Show(anchor, WorldIconType.ReadyToDepart, 0);
                return;
            }
            canvas.Hide(anchor, 0); // clears a previous ReadyToDepart if the state went back
            ShowService(canvas, anchor, platform, ServiceType.Refuel, SlotRefuel, WorldIconType.ServiceRefuel);
            ShowService(canvas, anchor, platform, ServiceType.Clean, SlotClean, WorldIconType.ServiceClean);
            ShowService(canvas, anchor, platform, ServiceType.LoadCargo, SlotLoad, WorldIconType.ServiceLoad);
        }

        private void ShowService(WorldIconCanvas canvas, WorldIconAnchor anchor, int platform, ServiceType type, int slot, WorldIconType actionIcon)
        {
            switch (station.GetServiceState(platform, type))
            {
                case StationController.ServiceState.NotNeeded:
                case StationController.ServiceState.Done:
                    canvas.Hide(anchor, slot);
                    break;
                case StationController.ServiceState.Pending:
                    canvas.Show(anchor, actionIcon, slot);
                    break;
                case StationController.ServiceState.InProgress:
                    canvas.Show(anchor, WorldIconType.ServiceInProgress, slot);
                    _anyInProgress[platform] = true;
                    break;
            }
        }

        private void Update()
        {
            // Only progress rings change every frame, and only on platforms with work in progress.
            var canvas = WorldIconCanvas.Instance;
            if (canvas == null) return;
            for (int i = 0; i < _anchors.Length; i++)
            {
                if (!_anyInProgress[i] || _anchors[i] == null) continue;
                canvas.SetProgress(_anchors[i], SlotRefuel, station.GetServiceProgress(i, ServiceType.Refuel));
                canvas.SetProgress(_anchors[i], SlotClean, station.GetServiceProgress(i, ServiceType.Clean));
                canvas.SetProgress(_anchors[i], SlotLoad, station.GetServiceProgress(i, ServiceType.LoadCargo));
            }
        }

        private void OnIconClicked(WorldIconAnchor anchor, WorldIconType type, int slot)
        {
            int platform = anchor.UserId;
            if ((uint)platform >= (uint)_anchors.Length || _anchors[platform] != anchor) return;
            switch (type)
            {
                case WorldIconType.ServiceRefuel: station.RequestService(platform, ServiceType.Refuel); break;
                case WorldIconType.ServiceClean: station.RequestService(platform, ServiceType.Clean); break;
                case WorldIconType.ServiceLoad: station.RequestService(platform, ServiceType.LoadCargo); break;
                case WorldIconType.ReadyToDepart:
                    if (departOnTap) station.Depart(platform);
                    else { var h = DepartRequested; if (h != null) h(platform); }
                    break;
            }
        }
    }
}
