using System;
using System.Collections;
using System.IO;
using UnityEngine;
using UnityEngine.Networking;

namespace ThaiRail.Data
{
    /// <summary>
    /// Loads StreamingAssets/RailTrack/*.json once at boot. On Android StreamingAssets lives inside the APK,
    /// so files are read with UnityWebRequest; elsewhere File.ReadAllText is used directly.
    /// Usage: put on the bootstrap GameObject, wait for <see cref="Ready"/>, then read <see cref="Db"/>.
    /// </summary>
    [DefaultExecutionOrder(-1000)]
    public sealed class RailTrackDataLoader : MonoBehaviour
    {
        public const string Folder = "RailTrack";
        public static RailTrackDatabase Db { get; private set; }
        public static bool Ready { get { return Db != null; } }
        public static event Action<RailTrackDatabase> Loaded;

        void Awake() { if (!Ready) StartCoroutine(LoadAll()); }

        IEnumerator LoadAll()
        {
            var texts = new string[Files.Length];
            for (int i = 0; i < Files.Length; i++)
            {
                string path = Path.Combine(Application.streamingAssetsPath, Folder, Files[i]);
                if (path.Contains("://") || path.Contains(":///"))
                {
                    using (var req = UnityWebRequest.Get(path))
                    {
                        yield return req.SendWebRequest();
                        if (req.result != UnityWebRequest.Result.Success) { Debug.LogError("RailTrack data: " + Files[i] + " " + req.error); yield break; }
                        texts[i] = req.downloadHandler.text;
                    }
                }
                else texts[i] = File.ReadAllText(path);
            }
            Db = Parse(texts[0], texts[1], texts[2], texts[3], texts[4], texts[5]);
            if (Loaded != null) Loaded(Db);
        }

        static readonly string[] Files = { "stations.json", "timetable.json", "rolling_stock.json", "progression.json", "difficulty.json", "network.json" };

        /// <summary>Pure parse step (no file IO), also used by edit-mode tests.</summary>
        public static RailTrackDatabase Parse(string stations, string timetable, string rolling, string progression, string difficulty, string network)
        {
            var db = new RailTrackDatabase
            {
                stations = JsonUtility.FromJson<StationsFile>(stations),
                timetable = JsonUtility.FromJson<TimetableFile>(timetable),
                rollingStock = JsonUtility.FromJson<RollingStockFile>(rolling),
                progression = JsonUtility.FromJson<ProgressionFile>(progression),
                difficulty = JsonUtility.FromJson<DifficultyFile>(difficulty),
                network = JsonUtility.FromJson<NetworkFile>(network),
            };
            db.Index();
            return db;
        }
    }
}
