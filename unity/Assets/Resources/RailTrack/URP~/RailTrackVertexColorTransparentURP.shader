// URP version of RailTrack/VertexColorTransparent (glass vaults, canopies): alpha from the vertex colour, both sides.
Shader "RailTrack/URP/VertexColorTransparent"
{
    Properties { _Tint ("Tint", Color) = (1,1,1,1) }
    SubShader
    {
        Tags { "RenderType"="Transparent" "Queue"="Transparent" "RenderPipeline"="UniversalPipeline" "IgnoreProjector"="True" }
        Pass
        {
            Name "ForwardLit"
            Tags { "LightMode"="UniversalForward" }
            Blend SrcAlpha OneMinusSrcAlpha
            ZWrite Off
            Cull Off
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile _ _MAIN_LIGHT_SHADOWS _MAIN_LIGHT_SHADOWS_CASCADE _MAIN_LIGHT_SHADOWS_SCREEN
            #pragma multi_compile_fog
            #include "RailTrackURPCommon.hlsl"
            CBUFFER_START(UnityPerMaterial)
                half4 _Tint;
            CBUFFER_END
            struct Attributes { float4 positionOS : POSITION; float3 normalOS : NORMAL; half4 color : COLOR; };
            struct Varyings { float4 positionCS : SV_POSITION; float3 positionWS : TEXCOORD0; half3 normalWS : TEXCOORD1; half4 color : COLOR; half fog : TEXCOORD2; };
            Varyings vert (Attributes i)
            {
                Varyings o; VertexPositionInputs p = GetVertexPositionInputs(i.positionOS.xyz);
                o.positionCS = p.positionCS; o.positionWS = p.positionWS; o.normalWS = TransformObjectToWorldNormal(i.normalOS);
                o.color = i.color; o.fog = ComputeFogFactor(p.positionCS.z); return o;
            }
            half4 frag (Varyings i, bool front : SV_IsFrontFace) : SV_Target
            {
                half3 n = front ? i.normalWS : -i.normalWS;
                half3 c = RailTrackLight(i.color.rgb * _Tint.rgb, i.positionWS, n, 0.6h);
                return half4(MixFog(c, i.fog), i.color.a * _Tint.a);
            }
            ENDHLSL
        }
    }
}
