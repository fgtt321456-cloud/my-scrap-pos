// Shared lighting for the RailTrack URP shaders: main light with shadows + spherical-harmonics ambient + fog.
// Kept deliberately simple (Lambert + a little Blinn-Phong) to stay cheap on mobile GPUs.
#ifndef RAILTRACK_URP_COMMON
#define RAILTRACK_URP_COMMON
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"
#include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Lighting.hlsl"

half3 RailTrackLight(half3 albedo, float3 positionWS, half3 normalWS, half smoothness)
{
    float4 shadowCoord = TransformWorldToShadowCoord(positionWS);
    Light L = GetMainLight(shadowCoord);
    half3 n = normalize(normalWS);
    half ndl = saturate(dot(n, L.direction));
    half atten = L.shadowAttenuation * L.distanceAttenuation;
    half3 v = normalize(GetWorldSpaceViewDir(positionWS));
    half spec = pow(saturate(dot(n, normalize(L.direction + v))), lerp(8.0h, 96.0h, smoothness)) * smoothness * 0.35h;
    return albedo * (L.color * ndl * atten + SampleSH(n)) + L.color * spec * atten;
}
#endif
