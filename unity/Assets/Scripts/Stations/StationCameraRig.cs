using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace ThaiRail.Stations
{
    /// <summary>
    /// Isometric orthographic camera for a station (port of camStn in railway/src/stations.js):
    /// drag to pan, wheel / pinch to zoom, right-drag / two-finger twist to rotate, tap to pick.
    /// Uses the legacy Input Manager (Project Settings > Player > Active Input Handling: "Both" or "Input Manager").
    /// </summary>
    [RequireComponent(typeof(Camera))]
    public sealed class StationCameraRig : MonoBehaviour
    {
        [Tooltip("Visible height in metres at zoom 1")] public float view = 360;
        public float zoom = 0.8f, zoomMin = 0.25f, zoomMax = 7;
        [Tooltip("Camera pitch above the horizon, degrees")] public float pitch = 35;
        [Tooltip("Yaw around the target, degrees (web build: 45°)")] public float yaw = 45;
        public Vector3 target;
        [Tooltip("Pan limits (world x/z)")] public Rect bounds = new Rect(-1000, -500, 2000, 1000);

        public event Action<Vector2> Tapped;
        public Func<Vector3?> FollowTarget;

        Camera _cam;
        float _yawTarget;
        Vector2 _downPos; bool _down, _moved; float _pinch, _twist;
        const float TapSlopPx = 12;

        void Awake()
        {
            _cam = GetComponent<Camera>(); _cam.orthographic = true; _cam.nearClipPlane = 1; _cam.farClipPlane = 4000; _yawTarget = yaw;
        }

        public void Home(Vector3 centre, float z = 0.8f) { target = centre; zoom = z; _yawTarget = yaw = 45; FollowTarget = null; }

        void LateUpdate()
        {
            HandleInput();
            if (FollowTarget != null) { var p = FollowTarget(); if (p.HasValue) target = Vector3.Lerp(target, p.Value, Mathf.Min(1, Time.deltaTime * 3)); else FollowTarget = null; }
            yaw = Mathf.LerpAngle(yaw, _yawTarget, Mathf.Min(1, Time.deltaTime * 6));
            target.x = Mathf.Clamp(target.x, bounds.xMin, bounds.xMax); target.z = Mathf.Clamp(target.z, bounds.yMin, bounds.yMax);
            var rot = Quaternion.Euler(pitch, yaw, 0);
            transform.rotation = rot; transform.position = target - rot * Vector3.forward * 1500;
            _cam.orthographicSize = view / zoom / 2;
        }

        bool OverUI(int pointerId = -1) { var es = EventSystem.current; return es != null && es.IsPointerOverGameObject(pointerId); }

        void HandleInput()
        {
            if (Input.touchCount >= 2)
            {
                Touch a = Input.GetTouch(0), b = Input.GetTouch(1);
                float d = Vector2.Distance(a.position, b.position), ang = Mathf.Atan2(b.position.y - a.position.y, b.position.x - a.position.x) * Mathf.Rad2Deg;
                if (a.phase == TouchPhase.Began || b.phase == TouchPhase.Began) { _pinch = d; _twist = ang; }
                else
                {
                    if (_pinch > 0) zoom = Mathf.Clamp(zoom * d / _pinch, zoomMin, zoomMax);
                    _yawTarget += Mathf.DeltaAngle(_twist, ang) * -1; yaw = _yawTarget;
                    _pinch = d; _twist = ang;
                }
                _moved = true; FollowTarget = null; return;
            }
            bool touch = Input.touchCount == 1;
            Vector2 pos = touch ? Input.GetTouch(0).position : (Vector2)Input.mousePosition;
            bool began = touch ? Input.GetTouch(0).phase == TouchPhase.Began : Input.GetMouseButtonDown(0) || Input.GetMouseButtonDown(1);
            bool held = touch ? Input.GetTouch(0).phase == TouchPhase.Moved || Input.GetTouch(0).phase == TouchPhase.Stationary : Input.GetMouseButton(0) || Input.GetMouseButton(1);
            bool ended = touch ? Input.GetTouch(0).phase == TouchPhase.Ended : Input.GetMouseButtonUp(0) || Input.GetMouseButtonUp(1);

            if (began && !OverUI(touch ? Input.GetTouch(0).fingerId : -1)) { _down = true; _moved = false; _downPos = pos; _last = pos; }
            if (_down && held)
            {
                Vector2 delta = pos - _last; _last = pos;
                if ((pos - _downPos).magnitude > TapSlopPx) _moved = true;
                if (_moved)
                {
                    if (!touch && Input.GetMouseButton(1)) { _yawTarget += delta.x * 0.3f; yaw = _yawTarget; }
                    else Pan(delta);
                    FollowTarget = null;
                }
            }
            if (_down && ended) { _down = false; if (!_moved && Tapped != null) Tapped(pos); }
            float wheel = Input.mouseScrollDelta.y;
            if (Mathf.Abs(wheel) > 0.01f && !OverUI()) zoom = Mathf.Clamp(zoom * Mathf.Pow(1.15f, wheel), zoomMin, zoomMax);
        }
        Vector2 _last;

        void Pan(Vector2 deltaPx)
        {
            float worldPerPx = _cam.orthographicSize * 2 / Mathf.Max(1, Screen.height);
            var right = Quaternion.Euler(0, yaw, 0) * Vector3.right; var fwd = Quaternion.Euler(0, yaw, 0) * Vector3.forward;
            // the view is tilted, so a screen-vertical pixel covers more ground than a horizontal one
            target -= (right * deltaPx.x + fwd * deltaPx.y / Mathf.Sin(pitch * Mathf.Deg2Rad)) * worldPerPx;
        }
    }
}
