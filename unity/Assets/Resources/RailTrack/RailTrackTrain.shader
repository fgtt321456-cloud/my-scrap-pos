// Train material for the detailed SRT models (Built-in render pipeline; kept under Resources so Shader.Find works in builds).
// _MainTex = painted livery atlas, _EmissionMap = lit windows and lamps, scaled by the global _RailTrackNight (0 day .. 1 night)
// that StationSceneBootstrap sets from the station clock, like trainsNight() in the web build.
// URP/HDRP: recreate as a Shader Graph (Lit) with Emission = EmissionMap × _RailTrackNight × 0.9.
Shader "RailTrack/Train"
{
    Properties
    {
        _MainTex ("Livery atlas", 2D) = "white" {}
        _EmissionMap ("Night emission atlas", 2D) = "black" {}
        _Glossiness ("Smoothness", Range(0,1)) = 0.45
        _Metallic ("Metallic", Range(0,1)) = 0.08
    }
    SubShader
    {
        Tags { "RenderType"="Opaque" }
        LOD 200
        CGPROGRAM
        #pragma surface surf Standard fullforwardshadows
        #pragma target 3.0
        sampler2D _MainTex, _EmissionMap;
        half _Glossiness, _Metallic;
        float _RailTrackNight;
        struct Input { float2 uv_MainTex; };
        void surf (Input IN, inout SurfaceOutputStandard o)
        {
            o.Albedo = tex2D(_MainTex, IN.uv_MainTex).rgb;
            o.Emission = tex2D(_EmissionMap, IN.uv_MainTex).rgb * _RailTrackNight * 0.9;
            o.Metallic = _Metallic; o.Smoothness = _Glossiness; o.Alpha = 1;
        }
        ENDCG
    }
    FallBack "Diffuse"
}
