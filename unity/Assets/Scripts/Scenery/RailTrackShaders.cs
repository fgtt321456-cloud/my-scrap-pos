using UnityEngine;
using UnityEngine.Rendering;

namespace ThaiRail.Scenery
{
    /// <summary>
    /// Picks the RailTrack shader that matches the active render pipeline: "RailTrack/URP/{name}" when a URP asset is
    /// active (the Resources/RailTrack/URP~ folder must be renamed to URP in such a project), else the Built-in
    /// "RailTrack/{name}". Falls back to the pipeline's default lit shader so nothing renders pink.
    /// name: VertexColorLit | VertexColorTransparent | Train
    /// </summary>
    public static class RailTrackShaders
    {
        public static bool Urp { get { return GraphicsSettings.currentRenderPipeline != null; } }
        public static Shader Find(string name)
        {
            Shader s = null;
            if (Urp)
            {
                s = Shader.Find("RailTrack/URP/" + name);
                if (s == null) { Debug.LogWarning("RailTrack: URP is active but RailTrack/URP/" + name + " is missing. Rename Assets/Resources/RailTrack/URP~ to URP."); s = Shader.Find("Universal Render Pipeline/Lit"); }
            }
            else s = Shader.Find("RailTrack/" + name);
            return s != null ? s : Shader.Find("Standard");
        }
    }
}
