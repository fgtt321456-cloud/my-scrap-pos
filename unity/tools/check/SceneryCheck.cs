// Scenery checks: generated faces point outward (also after the left-handed conversion for Unity),
// every station and every train model builds within a mobile-friendly vertex budget.
// With a dump directory it also writes each station's Unity-space mesh as JSON for tools/check/render_scenery.js.
using System; using System.IO; using System.Linq; using System.Text;
using ThaiRail.Data; using ThaiRail.Scenery; using ThaiRail.Simulation;

static class SceneryCheck
{
    // every triangle of a closed convex shape must face away from its centre
    static bool Outward(MeshData m, V3 centre, bool leftHanded)
    {
        float[] p, n; int[] t;
        if (leftHanded) { m.ToLeftHanded(out p, out n, out t); centre = new V3(centre.x, centre.y, -centre.z); }
        else { p = m.pos.ToArray(); n = m.nor.ToArray(); t = m.idx.ToArray(); }
        Func<int, V3> P = i => new V3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
        for (int k = 0; k < t.Length; k += 3)
        {
            V3 a = P(t[k]), b = P(t[k + 1]), c = P(t[k + 2]), cr = V3.Cross(b - a, c - a), mid = (a + b + c) * (1.0 / 3);
            if (V3.Dot(cr, mid - centre) <= 0) return false;                                  // winding
            if (V3.Dot(new V3(n[t[k] * 3], n[t[k] * 3 + 1], n[t[k] * 3 + 2]), mid - centre) <= 0) return false;   // normal
        }
        return true;
    }

    public static void Run(RailTrackDatabase db, Action<string, bool, string> Check, string dumpDir)
    {
        var c = new V3(3, 2, -5); var red = new Rgba(0xff0000);
        Func<Action<MeshData>, MeshData> M = f => { var m = new MeshData(); f(m); return m; };
        var shapes = new[] {
            Tuple.Create("box", M(m => m.Box(c, 4, 2, 6, red, 0.7, true)), c),
            Tuple.Create("cylinder Y", M(m => m.Cylinder(c, 1, 1.5, 3, 12, red)), c),
            Tuple.Create("cylinder X", M(m => m.Cylinder(c, 1, 1, 3, 12, red, MeshData.Axis.X)), c),
            Tuple.Create("cylinder Z", M(m => m.Cylinder(c, 1, 1, 3, 12, red, MeshData.Axis.Z)), c),
            Tuple.Create("cone", M(m => m.Cylinder(c, 0, 2, 4, 9, red)), c + new V3(0, -1, 0)),
            Tuple.Create("blob", M(m => m.Blob(c, 2, 1, 3, red)), c),
        };
        // a gable has no bottom, so close it for the test with a downward quad
        var gm = M(m => { m.Gable(c, 10, 4, 3, red, 0.4); var X = new V3(5, 0, 0).Yaw(0.4); var Z = new V3(0, 0, 2).Yaw(0.4); m.Quad(c - X - Z, c + X - Z, c + X + Z, c - X + Z, new V3(0, -1, 0), red); });
        bool ok = shapes.All(s => Outward(s.Item2, s.Item3, false) && Outward(s.Item2, s.Item3, true)) && Outward(gm, c + new V3(0, 1, 0), false) && Outward(gm, c + new V3(0, 1, 0), true);
        Check("primitives face outward, also after the conversion to Unity", ok, string.Join(", ", shapes.Where(s => !Outward(s.Item2, s.Item3, false) || !Outward(s.Item2, s.Item3, true)).Select(s => s.Item1)));

        foreach (var d in db.stations.stations)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var model = new StationSceneModel(d);
            sw.Stop();
            int v = model.Opaque.VertexCount + model.Transparent.VertexCount;
            bool finite = model.Opaque.pos.All(x => !float.IsNaN(x) && !float.IsInfinity(x)) && model.Opaque.nor.All(x => !float.IsNaN(x));
            Check("scene " + d.id + " builds", finite && v > 1000 && v < 400000 && model.Labels.Count > 3,
                string.Format("{0:N0} verts ({1:N0} tris, {2:N0} transparent) · {3} labels · {4} lamps · {5} ms", v, model.Opaque.TriangleCount + model.Transparent.TriangleCount, model.Transparent.VertexCount, model.Labels.Count, model.Lamps.Count, sw.ElapsedMilliseconds));
            if (dumpDir != null) Dump(Path.Combine(dumpDir, "scene_" + d.id + ".json"), model, d);
        }
        if (db.hualamphongGraph != null)
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var hm = new HlpSceneModel(new ThaiRail.Simulation.Hlp.HlpGraph(db.hualamphongGraph)); sw.Stop();
            int v = hm.Opaque.VertexCount + hm.Transparent.VertexCount;
            Check("scene HLP builds", v > 1000 && v < 400000 && hm.Signals.Count == 15 && hm.Opaque.pos.All(x => !float.IsNaN(x)),
                string.Format("{0:N0} verts ({1:N0} transparent) · {2} labels · {3} signals · {4} ms", v, hm.Transparent.VertexCount, hm.Labels.Count, hm.Signals.Count, sw.ElapsedMilliseconds));
            if (dumpDir != null)
            {
                var sb = new StringBuilder("{\"opaque\":"); AppendMesh(sb, hm.Opaque); sb.Append(",\"transparent\":"); AppendMesh(sb, hm.Transparent);
                sb.Append(",\"centre\":[60,0,-42.75]}"); File.WriteAllText(Path.Combine(dumpDir, "scene_HLP.json"), sb.ToString());
            }
        }
        int worst = 0; string worstId = "";
        foreach (var m in db.rollingStock.models)
        {
            var mesh = TrainMeshModel.Build(m);
            if (mesh.VertexCount > worst) { worst = mesh.VertexCount; worstId = m.id; }
        }
        Check("placeholder train for every model", worst > 0 && worst < 1000, "largest " + worstId + " " + worst + " verts");
        if (dumpDir != null)
        {
            var sb = new StringBuilder("{");
            foreach (var m in db.rollingStock.models) { if (sb.Length > 1) sb.Append(','); sb.Append('"').Append(m.id).Append("\":"); AppendMesh(sb, TrainMeshModel.Build(m)); }
            File.WriteAllText(Path.Combine(dumpDir, "trains.json"), sb.Append('}').ToString());
        }
    }

    static void Dump(string path, StationSceneModel model, StationDef d)
    {
        var sb = new StringBuilder("{\"opaque\":"); AppendMesh(sb, model.Opaque);
        sb.Append(",\"transparent\":"); AppendMesh(sb, model.Transparent);
        sb.Append(",\"centre\":[").Append(model.CenterX).Append(',').Append(model.Deck).Append(',').Append(-d.tracks.Average(t => t.z)).Append("]}");
        File.WriteAllText(path, sb.ToString());
    }
    // Unity (left-handed) data, exactly what StationSceneBuilder uploads
    static void AppendMesh(StringBuilder sb, MeshData m)
    {
        float[] p, n; int[] t; m.ToLeftHanded(out p, out n, out t);
        var inv = System.Globalization.CultureInfo.InvariantCulture;
        sb.Append("{\"p\":[").Append(string.Join(",", p.Select(x => Math.Round(x, 3).ToString(inv)))).Append("],\"c\":[")
          .Append(string.Join(",", m.col.Select(x => Math.Round(x, 3).ToString(inv)))).Append("],\"i\":[").Append(string.Join(",", t)).Append("]}");
    }
}
