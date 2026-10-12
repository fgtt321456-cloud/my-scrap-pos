using System.IO;
using System.Linq;
using NUnit.Framework;
using ThaiRail.Data;
using ThaiRail.Meta;
using ThaiRail.Scenery;
using ThaiRail.Simulation;
using ThaiRail.Simulation.Hlp;
using ThaiRail.Trains;
using UnityEditor;
using UnityEngine;

namespace ThaiRail.Tests
{
    /// <summary>
    /// Checks that only real Unity can do: the real JsonUtility reads every data file, every RailTrack shader compiles
    /// without errors, Resources hold the train models and atlases, and the simulations run on Unity's runtime.
    /// (Pure logic is also covered outside Unity by unity/tools/check/check.sh.)
    /// </summary>
    public class RailTrackEditModeTests
    {
        static RailTrackDatabase Db()
        {
            string dir = Path.Combine(Application.streamingAssetsPath, RailTrackDataLoader.Folder);
            System.Func<string, string> R = f => File.ReadAllText(Path.Combine(dir, f));
            return RailTrackDataLoader.Parse(R("stations.json"), R("timetable.json"), R("rolling_stock.json"), R("progression.json"), R("difficulty.json"), R("network.json"), R("hualamphong.json"));
        }

        [Test]
        public void DataLoadsWithUnityJsonUtility()
        {
            var db = Db();
            Assert.AreEqual(5, db.stations.stations.Length);
            Assert.AreEqual(14, db.stations.hualamphong.platformClass.Length);
            Assert.Greater(db.timetable.trains.Length, 20);
            Assert.AreEqual(83, db.hualamphongGraph.nodes.Length);
            Assert.AreEqual(104, db.hualamphongGraph.edges.Length);
            Assert.IsNotNull(db.Model("GEA"), "alias GEA → GEK");
            Assert.IsNotNull(db.progression.constants);
            Assert.Greater(db.network.stationPoints.Length, 10);
        }

        [Test]
        public void BuiltInShadersCompileWithoutErrors()
        {
            foreach (var name in new[] { "VertexColorLit", "VertexColorTransparent", "Train" })
            {
                var s = Shader.Find("RailTrack/" + name);
                Assert.IsNotNull(s, "RailTrack/" + name + " not found");
                Assert.IsFalse(ShaderUtil.ShaderHasError(s), "RailTrack/" + name + " has compile errors");
                Assert.IsTrue(s.isSupported, "RailTrack/" + name + " not supported on this graphics API");
            }
        }

        [Test]
        public void TrainModelsAndAtlasesAreInResources()
        {
            var db = Db();
            Assert.IsTrue(TrainLibrary.Available, "Resources/RailTrack/Trains/trains.json missing");
            foreach (var m in db.rollingStock.models)
            {
                var key = TrainLibrary.Resolve(m.id, db);
                Assert.AreEqual(m.id, key);
                var mesh = TrainLibrary.MeshFor(key);
                Assert.IsNotNull(mesh); Assert.Greater(mesh.vertexCount, 100, m.id);
                var mat = TrainLibrary.MaterialFor(key);
                Assert.IsNotNull(mat.GetTexture("_MainTex"), m.id + " livery atlas");
                Assert.IsNotNull(mat.GetTexture("_EmissionMap"), m.id + " night atlas");
            }
        }

        [Test]
        public void StationScenesBuildIntoMeshes()
        {
            var db = Db();
            foreach (var d in db.stations.stations)
            {
                var m = new StationSceneModel(d);
                Assert.Greater(m.Opaque.VertexCount, 1000, d.id);
            }
            var h = new HlpSceneModel(new HlpGraph(db.hualamphongGraph));
            Assert.AreEqual(15, h.Signals.Count);
        }

        sealed class Host : IStationHost
        {
            public long earned;
            public bool ControllerOn(string k) { return true; }
            public void Earn(int a, string c) { earned += a; }
            public void Pay(double a, string c) { }
            public void GainXP(int n) { }
            public void Notify(string t) { }
        }

        [Test]
        public void SimulationsRunOnUnityRuntime()
        {
            var db = Db(); var rng = new System.Random(1); var host = new Host();
            var g = new RailGraph(db); var diff = new Difficulty(db.difficulty, rng);
            var sim = new TimetableStationSim(db.Station("CMI"), db, g, diff, new WorldClock(), new DelayLedger(), host, rng);
            sim.Enter(); for (int i = 0; i < 12 * 7200; i++) sim.Step(0.5);
            Assert.Greater(sim.State.stats.dep, 5, "CMI 12 h departures");
            var e = new HlpEngine(db.hualamphongGraph, db.stations.hualamphong, diff, host, rng); e.S.arsArr = e.S.arsDep = true;
            for (int i = 0; i < 2 * 3600 * 4; i++) e.Step(0.25);
            Assert.Greater(e.S.stats.dep, 10, "Hua Lamphong 2 h departures");
            var json = JsonUtility.ToJson(e.S);   // the save game round-trips through the real JsonUtility
            var back = JsonUtility.FromJson<HlpState>(json);
            Assert.AreEqual(e.S.services.Count, back.services.Count);
            Assert.AreEqual(e.S.elock.Length, back.elock.Length);
            var running = TimetableTrains.Running(86400 + 23 * 3600, db, g, new DelayLedger());
            Assert.Greater(running.Count, 5, "real trains on the map at 23:00");
        }
    }
}
