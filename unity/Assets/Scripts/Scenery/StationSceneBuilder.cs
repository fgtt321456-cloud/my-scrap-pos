using System.Collections.Generic;
using ThaiRail.Data;
using ThaiRail.Simulation;
using UnityEngine;
using UnityEngine.Rendering;

namespace ThaiRail.Scenery
{
    /// <summary>
    /// Turns a <see cref="StationSceneModel"/> into Unity objects: one opaque and one transparent mesh (2 draw calls),
    /// plus world-space labels that face the camera. Coordinates: the web build is right-handed, Unity left-handed,
    /// so every point goes through <see cref="ToUnity"/> (z → −z). The simulation uses the same conversion.
    /// </summary>
    public sealed class StationSceneBuilder : MonoBehaviour
    {
        [Tooltip("Vertex-colour lit material (RailTrack/VertexColorLit). Left empty: created from the bundled shader.")] public Material opaqueMaterial;
        [Tooltip("Vertex-colour transparent material (RailTrack/VertexColorTransparent).")] public Material transparentMaterial;
        [Tooltip("Font for station signs and labels (a Thai-capable font, e.g. IBM Plex Sans Thai). Left empty: Unity's built-in font.")] public Font labelFont;
        public Color labelColor = new Color(0.12f, 0.16f, 0.24f, 1);

        public SceneModel Model { get; private set; }
        public GameObject Root { get; private set; }
        readonly List<GameObject> _made = new List<GameObject>();

        public static Vector3 ToUnity(double x, double y, double z) { return new Vector3((float)x, (float)y, (float)-z); }
        public static Vector3 ToUnity(V3 p) { return ToUnity(p.x, p.y, p.z); }
        public static Vector3 ToUnity(P3 p) { return ToUnity(p.x, p.y, p.z); }

        public GameObject Build(StationDef def, StationGeometry geo) { return Build(new StationSceneModel(def, geo), def.id); }

        public GameObject Build(SceneModel model, string name)
        {
            Clear();
            Model = model;
            Root = new GameObject("Station " + name); Root.transform.SetParent(transform, false); _made.Add(Root);
            AddMesh("Opaque", Model.Opaque, opaqueMaterial != null ? opaqueMaterial : Mat("RailTrack/VertexColorLit"), true);
            AddMesh("Transparent", Model.Transparent, transparentMaterial != null ? transparentMaterial : Mat("RailTrack/VertexColorTransparent"), false);
            var labels = new GameObject("Labels"); labels.transform.SetParent(Root.transform, false);
            foreach (var l in Model.Labels) AddLabel(labels.transform, l);
            return Root;
        }

        public void Clear() { foreach (var g in _made) if (g != null) Destroy(g); _made.Clear(); Root = null; }

        static Material Mat(string shader)
        {
            var s = RailTrackShaders.Find(shader.Replace("RailTrack/", ""));
            return new Material(s) { enableInstancing = true };
        }

        void AddMesh(string name, MeshData data, Material mat, bool shadows)
        {
            if (data.VertexCount == 0) return;
            float[] p, n; int[] t; data.ToLeftHanded(out p, out n, out t);
            int vc = p.Length / 3; var verts = new Vector3[vc]; var norms = new Vector3[vc]; var cols = new Color32[vc];
            for (int i = 0; i < vc; i++)
            {
                verts[i] = new Vector3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]);
                norms[i] = new Vector3(n[i * 3], n[i * 3 + 1], n[i * 3 + 2]);
                cols[i] = new Color32((byte)(data.col[i * 4] * 255), (byte)(data.col[i * 4 + 1] * 255), (byte)(data.col[i * 4 + 2] * 255), (byte)(data.col[i * 4 + 3] * 255));
            }
            var mesh = new Mesh { name = name };
            if (vc > 65000) mesh.indexFormat = IndexFormat.UInt32;
            mesh.vertices = verts; mesh.normals = norms; mesh.colors32 = cols; mesh.triangles = t;
            mesh.RecalculateBounds(); mesh.UploadMeshData(true);   // static: free the CPU copy on device
            var go = new GameObject(name); go.transform.SetParent(Root.transform, false); go.isStatic = true;
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>(); mr.sharedMaterial = mat;
            mr.shadowCastingMode = shadows ? ShadowCastingMode.On : ShadowCastingMode.Off; mr.receiveShadows = true;
        }

        void AddLabel(Transform parent, SceneLabel l)
        {
            var go = new GameObject("Label " + l.title); go.transform.SetParent(parent, false);
            go.transform.position = ToUnity(l.at);
            var tm = go.AddComponent<TextMesh>();
            tm.text = string.IsNullOrEmpty(l.sub) ? l.title : l.title + "\n<size=" + 22 + ">" + l.sub + "</size>";
            tm.richText = true; tm.anchor = TextAnchor.MiddleCenter; tm.alignment = TextAlignment.Center;
            tm.fontSize = 40; tm.characterSize = l.width * 0.03f;   // title ≈ 12% of the label width, like the web sprites tm.color = labelColor;
            if (labelFont != null) { tm.font = labelFont; go.GetComponent<MeshRenderer>().sharedMaterial = labelFont.material; }
            go.AddComponent<Billboard>();
        }
    }

    /// <summary>Keeps a label turned to the camera (the web build draws labels as sprites).</summary>
    public sealed class Billboard : MonoBehaviour
    {
        Camera _cam;
        void LateUpdate()
        {
            if (_cam == null) _cam = Camera.main; if (_cam == null) return;
            transform.rotation = _cam.transform.rotation;
        }
    }
}
