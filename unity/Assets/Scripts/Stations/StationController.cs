using System;
using System.Collections.Generic;
using ThaiRail.GroundServices;
using ThaiRail.Pooling;
using ThaiRail.Trains;
using UnityEngine;

namespace ThaiRail.Stations
{
    /// <summary>
    /// Example station showing the full pooling round trip:
    ///  1. A train is assigned a platform: its cars are taken from the pools and laid out (TrainConsist.Build).
    ///  2. The player taps a service icon: a forklift / fuel truck / cleaning cart is taken from its pool,
    ///     drives to the train, works, drives back and returns itself to the pool.
    ///  3. The player presses the yellow Depart button: every car (and its containers) goes back to the pools.
    ///
    /// UI, input and the signal/route logic call the public methods; this class owns no UI.
    /// </summary>
    public sealed class StationController : MonoBehaviour, IServiceRequester
    {
        [Serializable]
        public sealed class Platform
        {
            public string label = "1";
            [Tooltip("Front of the train when stopped. Forward axis points toward the buffer stop.")]
            public Transform stopPoint;
            [Tooltip("Road waypoints from the service depot to the work spot beside this platform (last = work spot).")]
            public Transform[] serviceRoute = new Transform[0];

            [NonSerialized] public TrainConsist Train;
            [NonSerialized] public ServiceFlags Done;
            [NonSerialized] public ServiceFlags InProgress;
            public bool IsFree { get { return Train == null; } }
        }

        [Flags]
        public enum ServiceFlags : byte { None = 0, Refuel = 1, Clean = 2, LoadCargo = 4 }

        [SerializeField] private Platform[] platforms = new Platform[0];
        [SerializeField] private Transform serviceDepot;

        [Header("Upgrades (from the economy screen)")]
        [Tooltip("Multiplies service vehicle drive and work speed. 1 = base, 1.5 = first upgrade, etc.")]
        [SerializeField, Min(0.1f)] private float groundServiceSpeed = 1f;

        /// <summary>Raised when a platform's train state changes, so the UI can refresh its icons.</summary>
        public event Action<int> PlatformChanged;

        // Reused buffers: dispatching and building never allocate.
        private readonly Vector3[] _routeBuffer = new Vector3[GroundServiceVehicle.MaxWaypoints];
        private readonly List<GroundServiceVehicle> _activeVehicles = new List<GroundServiceVehicle>(16);
        private int _nextServiceNumber = 101;

        public int PlatformCount { get { return platforms.Length; } }
        public Platform GetPlatform(int i) { return platforms[i]; }
        public float GroundServiceSpeed { get { return groundServiceSpeed; } set { groundServiceSpeed = Mathf.Max(0.1f, value); } }

        // ------------------------------------------------------------------ 1. arrival

        /// <summary>
        /// Player clicked a waiting train and picked a free platform. Builds the train from pooled cars.
        /// (A real game would first animate it in from the signal; this spawns it at the stop point.)
        /// </summary>
        public bool AssignTrainToPlatform(TrainDefinition definition, int platformIndex, int middleCars = -1)
        {
            if (!IsValid(platformIndex)) return false;
            var p = platforms[platformIndex];
            if (!p.IsFree) return false;

            p.Train = TrainConsist.Build(definition, _nextServiceNumber++, p.stopPoint, middleCars);
            p.Done = ServiceFlags.None;
            p.InProgress = ServiceFlags.None;
            RaiseChanged(platformIndex);
            return true;
        }

        // ------------------------------------------------------------------ 2. ground services

        /// <summary>Player tapped a service icon above a parked train.</summary>
        public bool RequestService(int platformIndex, ServiceType type)
        {
            if (!IsValid(platformIndex)) return false;
            var p = platforms[platformIndex];
            var flag = ToFlag(type);
            if (p.Train == null || (p.Done & flag) != 0 || (p.InProgress & flag) != 0) return false;
            if (type == ServiceType.LoadCargo && !HasCargoWagons(p.Train)) return false;

            var poolId = VehicleFor(type);
            var vehicle = PoolManager.Instance.Spawn<GroundServiceVehicle>(poolId, serviceDepot.position, serviceDepot.rotation);
            if (vehicle == null) return false;

            int n = Mathf.Min(p.serviceRoute.Length, _routeBuffer.Length);
            for (int i = 0; i < n; i++) _routeBuffer[i] = p.serviceRoute[i].position;
            vehicle.Dispatch(this, platformIndex, _routeBuffer, n, groundServiceSpeed);

            p.InProgress |= flag;
            _activeVehicles.Add(vehicle);
            RaiseChanged(platformIndex);
            return true;
        }

        public void OnServiceCompleted(GroundServiceVehicle vehicle, int platformIndex, ServiceType type)
        {
            _activeVehicles.Remove(vehicle);
            if (!IsValid(platformIndex)) return;
            var p = platforms[platformIndex];
            if (p.Train == null) return; // train already left (e.g. forced departure)

            var flag = ToFlag(type);
            p.InProgress &= ~flag;
            p.Done |= flag;

            if (type == ServiceType.LoadCargo) LoadContainers(p.Train);
            RaiseChanged(platformIndex);
        }

        /// <summary>True when everything this train needs is done. Drives the yellow Depart button state.</summary>
        public bool IsReadyToDepart(int platformIndex)
        {
            if (!IsValid(platformIndex)) return false;
            var p = platforms[platformIndex];
            if (p.Train == null || p.InProgress != ServiceFlags.None) return false;
            var needed = ServiceFlags.Refuel | ServiceFlags.Clean;
            if (HasCargoWagons(p.Train)) needed |= ServiceFlags.LoadCargo;
            if ((p.Done & needed) != needed) return false;
            // Loco-hauled trains are ready only once the locomotive leads toward the exit (after run-around).
            if (p.Train.Definition.requiresRunAround)
            {
                var cars = p.Train.Cars;
                if (cars.Count == 0 || !cars[cars.Count - 1].IsLocomotive) return false;
            }
            return true;
        }

        public enum ServiceState : byte { NotNeeded, Pending, InProgress, Done }

        /// <summary>What the floating icon above a parked train should show for one service.</summary>
        public ServiceState GetServiceState(int platformIndex, ServiceType type)
        {
            if (!IsValid(platformIndex)) return ServiceState.NotNeeded;
            var p = platforms[platformIndex];
            if (p.Train == null) return ServiceState.NotNeeded;
            if (type == ServiceType.LoadCargo && !HasCargoWagons(p.Train)) return ServiceState.NotNeeded;
            var flag = ToFlag(type);
            if ((p.Done & flag) != 0) return ServiceState.Done;
            if ((p.InProgress & flag) != 0) return ServiceState.InProgress;
            return ServiceState.Pending;
        }

        /// <summary>0..1 work progress of the vehicle serving this platform, or -1 if none is working.</summary>
        public float GetServiceProgress(int platformIndex, ServiceType type)
        {
            for (int i = 0; i < _activeVehicles.Count; i++)
            {
                var v = _activeVehicles[i];
                if (v.PlatformIndex == platformIndex && v.Type == type) return v.WorkProgress01;
            }
            return -1f;
        }

        // ------------------------------------------------------------------ 3. departure

        /// <summary>
        /// Player pressed the yellow Depart button and the exit route is clear.
        /// Returns every car and container to the pools.
        /// </summary>
        public bool Depart(int platformIndex)
        {
            if (!IsReadyToDepart(platformIndex)) return false;
            var p = platforms[platformIndex];
            p.Train.Despawn();
            p.Train = null;
            p.Done = p.InProgress = ServiceFlags.None;
            RaiseChanged(platformIndex);
            return true;
        }

        /// <summary>End of shift: clear the station before showing the thermal receipt.</summary>
        public void ClearStation()
        {
            for (int i = 0; i < platforms.Length; i++)
            {
                var p = platforms[i];
                if (p.Train == null) continue;
                p.Train.Despawn();
                p.Train = null;
                p.Done = p.InProgress = ServiceFlags.None;
                RaiseChanged(i);
            }
            // Vehicles still driving: send them straight back to their pools.
            var pm = PoolManager.Instance;
            for (int i = _activeVehicles.Count - 1; i >= 0; i--)
            {
                var v = _activeVehicles[i];
                if (v != null) pm.Release(v);
            }
            _activeVehicles.Clear();
        }

        private void OnDisable()
        {
            // Leaving the station scene: return everything so the pools stay balanced.
            if (PoolManager.Instance != null) ClearStation();
        }

        // ------------------------------------------------------------------ helpers

        private static void LoadContainers(TrainConsist train)
        {
            var id = train.Definition.cargoContainer;
            var cars = train.Cars;
            for (int i = 0; i < cars.Count; i++)
            {
                var car = cars[i];
                if (car.Role != CarRole.CargoWagon) continue;
                while (car.TryLoadContainer(id)) { }
            }
        }

        private static bool HasCargoWagons(TrainConsist train)
        {
            var cars = train.Cars;
            for (int i = 0; i < cars.Count; i++) if (cars[i].Role == CarRole.CargoWagon) return true;
            return false;
        }

        private static PoolId VehicleFor(ServiceType type)
        {
            switch (type)
            {
                case ServiceType.Refuel: return PoolId.FuelTruck;
                case ServiceType.Clean: return PoolId.CleaningCart;
                default: return PoolId.Forklift;
            }
        }

        private static ServiceFlags ToFlag(ServiceType type)
        {
            switch (type)
            {
                case ServiceType.Refuel: return ServiceFlags.Refuel;
                case ServiceType.Clean: return ServiceFlags.Clean;
                default: return ServiceFlags.LoadCargo;
            }
        }

        private bool IsValid(int i) { return i >= 0 && i < platforms.Length; }

        private void RaiseChanged(int i)
        {
            var h = PlatformChanged;
            if (h != null) h(i);
        }
    }
}
