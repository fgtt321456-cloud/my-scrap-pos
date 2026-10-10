// Detailed train model checks (Resources/RailTrack/Trains): every rolling_stock model resolves to a mesh, triangles
// keep facing along their normals after the left-handed conversion, UVs stay inside the atlas, every livery has
// both atlas PNGs. With a dump directory it writes the Unity-space meshes for render_scenery.js.
using System; using System.IO; using System.Linq; using System.Text;
using ThaiRail.Data; using ThaiRail.Trains;

static class TrainCheck
{
    public static void Run(RailTrackDatabase db, string unityDir, Action<string, bool, string> Check, string dumpDir)
    {
        string dir = Path.Combine(unityDir, "Assets/Resources/RailTrack/Trains");
        TrainLibrary.Init(File.ReadAllText(Path.Combine(dir, "trains.json")));
        var missing = db.rollingStock.models.Where(m => TrainLibrary.Resolve(m.id, db) != m.id).Select(m => m.id).ToArray();
        Check("every rolling-stock model has a detailed mesh", missing.Length == 0, missing.Length > 0 ? "missing " + string.Join(",", missing) : db.rollingStock.models.Length + " models");
        int bad = 0, total = 0, uvOut = 0; string worst = "";
        var sb = new StringBuilder("{");
        foreach (var m in db.rollingStock.models)
        {
            var d = TrainLibrary.Data(m.id);
            UnityEngine.Vector3[] v, n; UnityEngine.Vector2[] uv; int[] t; TrainLibrary.ToLeftHanded(d, out v, out n, out uv, out t);
            int b = 0;
            for (int k = 0; k < t.Length; k += 3)
            {
                var a = v[t[k]]; var e1 = Sub(v[t[k + 1]], a); var e2 = Sub(v[t[k + 2]], a);
                double cx = e1[1] * e2[2] - e1[2] * e2[1], cy = e1[2] * e2[0] - e1[0] * e2[2], cz = e1[0] * e2[1] - e1[1] * e2[0];
                if (Math.Sqrt(cx * cx + cy * cy + cz * cz) < 1e-6) continue;   // degenerate (caps of thin parts)
                total++; var nn = n[t[k]]; if (cx * nn.x + cy * nn.y + cz * nn.z <= 0) b++;
            }
            if (b > 0) { bad += b; worst = m.id; }
            uvOut += uv.Count(q => q.x < -1e-4 || q.x > 1.0001 || q.y < -1e-4 || q.y > 1.0001);
            if (dumpDir != null)
            {
                var inv = System.Globalization.CultureInfo.InvariantCulture;
                if (sb.Length > 1) sb.Append(',');
                sb.Append('"').Append(m.id).Append("\":{\"family\":\"").Append(d.family).Append("\",\"p\":[")
                  .Append(string.Join(",", v.Select(q => q.x.ToString(inv) + "," + q.y.ToString(inv) + "," + q.z.ToString(inv)))).Append("],\"uv\":[")
                  .Append(string.Join(",", uv.Select(q => q.x.ToString(inv) + "," + q.y.ToString(inv)))).Append("],\"i\":[").Append(string.Join(",", t)).Append("]}");
            }
        }
        Check("detailed trains face outward after conversion", bad == 0, bad > 0 ? bad + "/" + total + " triangles flipped, e.g. " + worst : total + " triangles");
        Check("detailed train UVs inside the atlas", uvOut == 0, uvOut + " outside");
        var fams = TrainLibraryFamilies(dir);
        var noAtlas = fams.Where(f => !File.Exists(Path.Combine(dir, "atlas_" + f + ".png")) || !File.Exists(Path.Combine(dir, "atlas_" + f + "_em.png"))).ToArray();
        Check("every livery has its atlas and night atlas", noAtlas.Length == 0, noAtlas.Length > 0 ? string.Join(",", noAtlas) : fams.Length + " liveries");
        if (dumpDir != null) File.WriteAllText(Path.Combine(dumpDir, "trains_detailed.json"), sb.Append('}').ToString());
        // every shader RailTrackShaders asks for exists for both pipelines (URP ones live in the ignored URP~ folder)
        string res = Path.Combine(unityDir, "Assets/Resources/RailTrack");
        string all = string.Join("\n", Directory.GetFiles(res, "*.shader", SearchOption.AllDirectories).Select(File.ReadAllText));
        var missingShaders = new[] { "VertexColorLit", "VertexColorTransparent", "Train" }.SelectMany(n => new[] { "RailTrack/" + n, "RailTrack/URP/" + n })
            .Where(n => !all.Contains("Shader \"" + n + "\"")).ToArray();
        bool urpTagged = Directory.GetFiles(Path.Combine(res, "URP~"), "*.shader").All(f => File.ReadAllText(f).Contains("\"RenderPipeline\"=\"UniversalPipeline\"") && File.ReadAllText(f).Contains("UniversalForward"));
        Check("shaders for Built-in and URP exist under the names the code uses", missingShaders.Length == 0 && urpTagged, missingShaders.Length > 0 ? "missing " + string.Join(", ", missingShaders) : "3 × 2 shaders");
    }
    static double[] Sub(UnityEngine.Vector3 a, UnityEngine.Vector3 b) { return new double[] { a.x - b.x, a.y - b.y, a.z - b.z }; }
    static string[] TrainLibraryFamilies(string dir)
    {
        var f = UnityEngine.JsonUtility.FromJson<TrainModelsFile>(File.ReadAllText(Path.Combine(dir, "trains.json")));
        return f.families.Select(x => x.family).ToArray();
    }
}
