using System.Collections;
using NUnit.Framework;
using ThaiRail.Game;
using UnityEngine;
using UnityEngine.TestTools;

namespace ThaiRail.Tests
{
    /// <summary>
    /// Boots the game like a player would: main menu first, then every station in turn. Any error or exception logged
    /// during these frames fails the test (Unity Test Framework default), so this catches runtime breakage in real Unity.
    /// </summary>
    public class RailTrackPlayModeTests
    {
        static readonly string[] Stations = { "HLP", "CMI", "NKI", "UBN", "HDY", "KRT" };

        [UnityTest]
        public IEnumerator MenuThenEveryStationRuns()
        {
            var go = new GameObject("RailTrackTest");
            var boot = go.AddComponent<StationSceneBootstrap>();
            boot.startInMenu = true;

            float t0 = Time.realtimeSinceStartup;
            while ((RailTrackWorld.Instance == null || !RailTrackWorld.Instance.Ready) && Time.realtimeSinceStartup - t0 < 30) yield return null;
            Assert.IsNotNull(RailTrackWorld.Instance, "RailTrackWorld not created");
            Assert.IsTrue(RailTrackWorld.Instance.Ready, "data did not load within 30 s");
            for (int i = 0; i < 10 && !boot.MenuOpen; i++) yield return null;
            Assert.IsTrue(boot.MenuOpen, "main menu should open first");

            foreach (var id in Stations)
            {
                boot.Open(id);
                for (int i = 0; i < 60; i++) yield return null;
                Assert.IsNotNull(boot.View, id + ": no view");
                Assert.IsTrue(boot.View.Running, id + ": simulation not running");
                boot.View.Speed = 60;
                for (int i = 0; i < 60; i++) yield return null;
            }
            boot.ShowMenu();
            yield return null;
            Assert.IsTrue(boot.MenuOpen, "menu button should return to the menu");
            Object.Destroy(go);
        }
    }
}
