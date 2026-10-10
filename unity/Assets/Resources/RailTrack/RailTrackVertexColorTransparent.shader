// Transparent variant of RailTrack/VertexColorLit (glass vaults, canopies): alpha comes from the vertex colour.
// (Kept under Resources so Shader.Find also works in player builds.)
Shader "RailTrack/VertexColorTransparent"
{
    Properties { _Tint ("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" "IgnoreProjector"="True" }
        LOD 200
        ZWrite Off
        Cull Off
        CGPROGRAM
        #pragma surface surf Lambert alpha:fade
        #pragma target 3.0
        fixed4 _Tint;
        struct Input { float4 color : COLOR; };
        void surf (Input IN, inout SurfaceOutput o) { o.Albedo = IN.color.rgb * _Tint.rgb; o.Alpha = IN.color.a * _Tint.a; }
        ENDCG
    }
    FallBack "Transparent/VertexLit"
}
