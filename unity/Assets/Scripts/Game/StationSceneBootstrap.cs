using System.Collections;
using System.Linq;
using ThaiRail.Data;
using ThaiRail.Scenery;
using ThaiRail.Simulation;
using ThaiRail.Stations;
using ThaiRail.Trains;
using ThaiRail.UI;
using UnityEngine;

namespace ThaiRail.Game
{
    /// <summary>
    /// One component that turns an empty scene into a playable timetable station: it adds the data loader and the
    /// world if they are missing, waits for the data, then builds the station from its real layout, starts the
    /// simulation, the camera and the HUD. Day and night follow the station clock (port of applyDayNight).
    /// Quick start: new scene → empty GameObject → add StationSceneBootstrap → Play.
    /// </summary>
    public sealed class StationSceneBootstrap : MonoBehaviour
    {
        [Tooltip("HLP (Hua Lamphong), CMI, NKI, UBN, HDY or KRT")] public string stationId = "CMI";
        [Tooltip("Optional real train prefabs (needs a PoolManager). Empty = generated placeholder trains")] public RollingStockCatalog catalog;
        [Tooltip("Thai-capable font for the HUD and signs (e.g. IBM Plex Sans Thai)")] public Font font;
        [Tooltip("Start with the approach and departure controllers (ARS) switched on")] public bool startWithArs;

        StationSceneBuilder _builder;
        IStationView _view;
        StationCameraRig _rig;
        StationHud _hud;
        Light _sun;
        GameObject _stationRoot;

        IEnumerator Start()
        {
            if (FindObjectOfType<RailTrackDataLoader>() == null) gameObject.AddComponent<RailTrackDataLoader>();
            if (RailTrackWorld.Instance == null) { var w = gameObject.AddComponent<RailTrackWorld>(); w.ctrlApp = w.ctrlDep = startWithArs; }
            while (RailTrackWorld.Instance == null || !RailTrackWorld.Instance.Ready) yield return null;
            SetupCameraAndLight();
            Open(stationId);
        }

        void SetupCameraAndLight()
        {
            var cam = Camera.main;
            if (cam == null) { var cgo = new GameObject("Main Camera"); cgo.tag = "MainCamera"; cam = cgo.AddComponent<Camera>(); }
            cam.clearFlags = CameraClearFlags.SolidColor;
            _rig = cam.GetComponent<StationCameraRig>(); if (_rig == null) _rig = cam.gameObject.AddComponent<StationCameraRig>();   // no ?? on Unity objects
            _sun = FindObjectsOfType<Light>().FirstOrDefault(l => l.type == LightType.Directional);
            if (_sun == null) { var lgo = new GameObject("Sun"); _sun = lgo.AddComponent<Light>(); _sun.type = LightType.Directional; }
            _sun.shadows = LightShadows.Soft;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
        }

        /// <summary>Tear down the current station (its state is kept by RailTrackWorld) and open another.</summary>
        public void Open(string id)
        {
            if (_stationRoot != null) Destroy(_stationRoot);
            stationId = id;
            _stationRoot = new GameObject("Station " + id);
            var trains = new GameObject("Trains").transform; trains.SetParent(_stationRoot.transform, false);
            _builder = _stationRoot.AddComponent<StationSceneBuilder>(); _builder.labelFont = font;
            string hint;
            if (id == "HLP")
            {
                var W = RailTrackWorld.Instance; var engine = W.HuaLamphong(); if (engine == null) return;
                var model = new HlpSceneModel(engine.G);
                var hr = _stationRoot.AddComponent<HlpStationRunner>(); hr.catalog = catalog; hr.trainRoot = trains;
                hr.Begin(model.Signals); if (!hr.Running) return;
                _builder.Build(model, "HLP");
                _rig.Home(StationSceneBuilder.ToUnity(150, 0, 42.75), 0.7f);
                _rig.bounds = Rect.MinMaxRect(-250, -500, 1000, 420);
                _view = hr;
                hint = engine.S.hinted ? null : "สถานีกรุงเทพ (หัวลำโพง): แตะขบวนที่รอสัญญาณ H แล้วเลือกชานชาลา · ขบวนหัวรถจักรต้องสับหลีกผ่านรางคู่ก่อนออก";
                engine.S.hinted = true;
            }
            else
            {
                var tr = _stationRoot.AddComponent<TimetableStationRunner>();
                tr.stationId = id; tr.catalog = catalog; tr.trainRoot = trains;
                tr.Begin(); if (!tr.Running) return;
                _builder.Build(tr.Sim.Def, tr.Sim.Geo);
                var d = tr.Sim.Def;
                double zm = d.tracks.Where(t => !t.siding).Average(t => t.z);
                _rig.Home(StationSceneBuilder.ToUnity((d.P0 + d.P1) / 2, d.deck, zm));
                _rig.bounds = Rect.MinMaxRect(d.P0 - 700, (float)-zm - 500, d.P1 + 700, (float)-zm + 500);
                _view = tr;
                hint = tr.Sim.State.hinted ? null : d.name + ": เลือกชานชาลาให้ขบวนที่มีแถบเหลือง แล้วปล่อยรถเมื่อพร้อม";
                tr.Sim.State.hinted = true;
            }

            _hud = _stationRoot.AddComponent<StationHud>(); _hud.font = font;
            _hud.Bind(_view.Adapter, _view, _rig);
            var ids = new[] { "HLP" }.Concat(RailTrackWorld.Instance.Db.stations.stations.Select(s => s.id)).ToArray();
            _hud.AddControls(ids, id, Open);
            if (hint != null) _hud.Toast(hint);
        }

        void Update()
        {
            if (_view == null || !_view.Running || _sun == null) return;
            float hour = (float)(_view.Status().now / 3600 % 24);
            DayNight(hour); TrainLibrary.SetNight(TrainLibrary.NightFactor(hour));
        }

        /// <summary>Sun arc and sky colours by hour (simplified port of applyDayNight in fx.js).</summary>
        void DayNight(float h)
        {
            float day = Mathf.Clamp01(Mathf.Sin((h - 6) / 12 * Mathf.PI));               // 0 at night, 1 at noon
            float dusk = Mathf.Clamp01(1 - Mathf.Abs(h - 18.2f) / 1.2f) + Mathf.Clamp01(1 - Mathf.Abs(h - 6.2f) / 1.2f);
            _sun.transform.rotation = Quaternion.Euler(Mathf.Lerp(8, 62, day), 135 + (h - 12) * 8, 0);
            _sun.intensity = Mathf.Lerp(0.08f, 1.05f, day);
            _sun.color = Color.Lerp(new Color(1f, 0.97f, 0.92f), new Color(1f, 0.62f, 0.38f), Mathf.Clamp01(dusk));
            Color sky = Color.Lerp(new Color(0.05f, 0.08f, 0.16f), new Color(0.80f, 0.88f, 0.95f), day);
            sky = Color.Lerp(sky, new Color(0.98f, 0.72f, 0.55f), Mathf.Clamp01(dusk) * 0.6f);
            Camera.main.backgroundColor = sky;
            RenderSettings.ambientSkyColor = Color.Lerp(new Color(0.16f, 0.2f, 0.32f), new Color(0.78f, 0.82f, 0.88f), day);
            RenderSettings.ambientEquatorColor = Color.Lerp(new Color(0.12f, 0.14f, 0.22f), new Color(0.66f, 0.68f, 0.7f), day);
            RenderSettings.ambientGroundColor = Color.Lerp(new Color(0.08f, 0.08f, 0.12f), new Color(0.55f, 0.5f, 0.44f), day);
        }
    }
}
