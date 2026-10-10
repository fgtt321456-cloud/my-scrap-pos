// Vertex-coloured lit shaders for the generated station scenery and procedural trains (Built-in render pipeline).
// (Kept under Resources so Shader.Find also works in player builds.)
// Opaque: Lambert + shadows. Transparent: glass roofs and canopies (alpha from the vertex colour).
// URP/HDRP: replace with a Shader Graph that multiplies Base Color by the Vertex Color node (same names keep working).
Shader "RailTrack/VertexColorLit"
{
    Properties { _Tint ("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Lambert addshadow fullforwardshadows
        #pragma target 3.0
        fixed4 _Tint;
        struct Input { float4 color : COLOR; };
        void surf (Input IN, inout SurfaceOutput o) { o.Albedo = IN.color.rgb * _Tint.rgb; o.Alpha = 1; }
        ENDCG
    }
    FallBack "Diffuse"
}
