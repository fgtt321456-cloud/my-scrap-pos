using ThaiRail.Pooling;
using UnityEngine;

namespace ThaiRail.GroundServices
{
    public enum ServiceType : byte { Refuel, Clean, LoadCargo }

    /// <summary>
    /// Implemented by whoever dispatches a vehicle (the StationController). Using an interface instead
    /// of a lambda means dispatching never allocates a closure.
    /// </summary>
    public interface IServiceRequester
    {
        /// <summary>Called once when the vehicle finishes working at the train (before it drives back).</summary>
        void OnServiceCompleted(GroundServiceVehicle vehicle, int platformIndex, ServiceType type);
    }

    /// <summary>
    /// Pooled forklift / fuel truck / cleaning cart. Drives a short waypoint route to the train, works for
    /// a while, drives back and returns itself to the pool. Only spawned vehicles are active, so idle
    /// vehicles in the pool cost no Update calls.
    /// </summary>
    [RequireComponent(typeof(PooledObject))]
    public sealed class GroundServiceVehicle : MonoBehaviour, IPoolable
    {
        public const int MaxWaypoints = 8;

        [SerializeField] private ServiceType serviceType = ServiceType.Refuel;
        [SerializeField, Min(0.1f)] private float driveSpeed = 6f;      // m/s
        [SerializeField, Min(1f)] private float turnSpeed = 360f;       // deg/s
        [SerializeField, Min(0.1f)] private float baseWorkSeconds = 8f;

        private enum State : byte { Idle, DrivingIn, Working, DrivingOut }

        // Fixed-size route buffer: copying waypoints in avoids keeping a reference to the caller's array.
        private readonly Vector3[] _route = new Vector3[MaxWaypoints];
        private int _routeLength;
        private int _waypoint;

        private State _state;
        private float _workLeft, _workTotal, _speedMultiplier = 1f;
        private int _platformIndex;
        private IServiceRequester _requester;
        private Transform _t;
        private PooledObject _pooled;

        public ServiceType Type { get { return serviceType; } }
        public int PlatformIndex { get { return _platformIndex; } }
        public bool IsBusy { get { return _state != State.Idle; } }

        /// <summary>0..1 while working: drives the progress ring above the train icon.</summary>
        public float WorkProgress01 { get { return _workTotal > 0f ? 1f - _workLeft / _workTotal : 0f; } }

        private void Awake()
        {
            _t = transform;
            _pooled = GetComponent<PooledObject>();
        }

        public void OnSpawned()
        {
            _state = State.Idle;
            _routeLength = 0;
            _waypoint = 0;
        }

        public void OnDespawned()
        {
            _state = State.Idle;
            _requester = null; // never keep a station alive from the pool
        }

        /// <summary>
        /// Sends the vehicle along <paramref name="route"/> (depot to the train, last point = work spot).
        /// <paramref name="speedMultiplier"/> comes from the player's ground-service upgrades.
        /// </summary>
        public void Dispatch(IServiceRequester requester, int platformIndex, Vector3[] route, int routeLength, float speedMultiplier)
        {
            _requester = requester;
            _platformIndex = platformIndex;
            _speedMultiplier = Mathf.Max(0.1f, speedMultiplier);
            _routeLength = Mathf.Min(routeLength, MaxWaypoints);
            for (int i = 0; i < _routeLength; i++) _route[i] = route[i];
            _waypoint = 0;
            _state = _routeLength > 0 ? State.DrivingIn : State.Working;
            _workTotal = _workLeft = baseWorkSeconds / _speedMultiplier;
        }

        private void Update()
        {
            float dt = Time.deltaTime;
            switch (_state)
            {
                case State.DrivingIn:
                    if (DriveTowards(_route[_waypoint], dt) && ++_waypoint >= _routeLength) _state = State.Working;
                    break;

                case State.Working:
                    _workLeft -= dt;
                    if (_workLeft <= 0f)
                    {
                        _workLeft = 0f;
                        var req = _requester;
                        if (req != null) req.OnServiceCompleted(this, _platformIndex, serviceType);
                        _waypoint = _routeLength - 2; // drive the route backwards to the depot
                        _state = _waypoint >= 0 ? State.DrivingOut : State.Idle;
                        if (_state == State.Idle) _pooled.Release();
                    }
                    break;

                case State.DrivingOut:
                    if (DriveTowards(_route[_waypoint], dt) && --_waypoint < 0)
                    {
                        _state = State.Idle;
                        _pooled.Release();
                    }
                    break;
            }
        }

        /// <summary>Moves and turns toward a point. Returns true on arrival.</summary>
        private bool DriveTowards(Vector3 target, float dt)
        {
            Vector3 pos = _t.position;
            Vector3 to = target - pos;
            to.y = 0f;
            float dist = to.magnitude;
            float step = driveSpeed * _speedMultiplier * dt;
            if (dist <= step)
            {
                _t.position = new Vector3(target.x, pos.y, target.z);
                return true;
            }
            Vector3 dir = to / dist;
            _t.SetPositionAndRotation(
                pos + dir * step,
                Quaternion.RotateTowards(_t.rotation, Quaternion.LookRotation(dir, Vector3.up), turnSpeed * dt));
            return false;
        }
    }
}
