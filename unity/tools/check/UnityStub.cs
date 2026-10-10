// Minimal UnityEngine stand-in so the scripts compile outside Unity (tools/check only; never shipped).
// Compile-only: members exist with the real signatures but do nothing. Add members here as scripts start using them.
using System;
using System.Collections;
using System.Collections.Generic;
namespace UnityEngine {
  public class Object { public string name; public int GetInstanceID() { return 0; }
    public static T Instantiate<T>(T original, Transform parent, bool worldPositionStays) where T : Object { return original; } public static T Instantiate<T>(T original, Transform parent) where T : Object { return original; }
    public static void Destroy(Object o) {} public static void DontDestroyOnLoad(Object o) {}
    public static T FindObjectOfType<T>() where T : Object { return null; } public static T[] FindObjectsOfType<T>() where T : Object { return new T[0]; }
    public static implicit operator bool(Object o) { return !ReferenceEquals(o, null); } }
  public class Component : Object { public Transform transform; public GameObject gameObject; public string tag;
    public T GetComponent<T>() { return default(T); } public T GetComponentInChildren<T>() { return default(T); } public T[] GetComponentsInChildren<T>(bool includeInactive) { return new T[0]; } }
  public class Behaviour : Component { public bool enabled; }
  public class MonoBehaviour : Behaviour { public Coroutine StartCoroutine(IEnumerator r) { return null; } }
  public class Coroutine {}
  public class ScriptableObject : Object {}
  public class GameObject : Object { public GameObject(string n) {} public GameObject(string n, params Type[] components) {} public Transform transform; public string tag; public bool isStatic; public bool activeSelf;
    public void SetActive(bool v) {} public T GetComponent<T>() { return default(T); } public T AddComponent<T>() where T : Component { return default(T); } }
  public class Transform : Component { public Vector3 position, localPosition; public Quaternion rotation, localRotation; public Vector3 forward, right, localScale; public Transform parent;
    public int childCount; public Transform GetChild(int i) { return null; }
    public void SetParent(Transform p) {} public void SetParent(Transform p, bool worldPositionStays) {} public void SetPositionAndRotation(Vector3 p, Quaternion r) {} }
  public class Renderer : Component { public Material sharedMaterial; public bool receiveShadows; public Rendering.ShadowCastingMode shadowCastingMode; public void SetPropertyBlock(MaterialPropertyBlock b) {} }
  public class MeshRenderer : Renderer {}
  public class MeshFilter : Component { public Mesh sharedMesh, mesh; }
  public class Mesh : Object { public Vector3[] vertices, normals; public Vector2[] uv; public Color32[] colors32; public int[] triangles; public Rendering.IndexFormat indexFormat;
    public void RecalculateBounds() {} public void RecalculateNormals() {} public void UploadMeshData(bool markNoLongerReadable) {} }
  public class Material : Object { public Material(Shader s) {} public Material(Material m) {} public bool enableInstancing; public Color color; public void SetTexture(string n, Texture t) {} public void SetFloat(string n, float v) {} public void SetColor(string n, Color c) {} }
  public class Texture : Object {} public class Texture2D : Texture {} public class TextAsset : Object { public string text; }
  public class Shader : Object { public static int PropertyToID(string n) { return 0; } public static Shader Find(string n) { return null; } public static void SetGlobalFloat(string n, float v) {} }
  public class Font : Object { public Material material; }
  public class TextMesh : Component { public string text; public bool richText; public TextAnchor anchor; public TextAlignment alignment; public int fontSize; public float characterSize; public Color color; public Font font; }
  public enum TextAnchor { UpperLeft, UpperCenter, UpperRight, MiddleLeft, MiddleCenter, MiddleRight, LowerLeft, LowerCenter, LowerRight }
  public enum TextAlignment { Left, Center, Right }
  public enum FontStyle { Normal, Bold, Italic, BoldAndItalic }
  public enum LightType { Spot, Directional, Point, Area }
  public enum LightShadows { None, Hard, Soft }
  public class Light : Behaviour { public LightType type; public LightShadows shadows; public float intensity; public Color color; }
  public enum CameraClearFlags { Skybox = 1, SolidColor = 2, Depth = 3, Nothing = 4 }
  public static class RenderSettings { public static Rendering.AmbientMode ambientMode; public static Color ambientSkyColor, ambientEquatorColor, ambientGroundColor; }
  public static class Resources { public static T GetBuiltinResource<T>(string path) where T : Object { return null; } public static T Load<T>(string path) where T : Object { return null; } }
  public static class Screen { public static int width, height; }
  public class MaterialPropertyBlock { public void Clear() {} public void SetColor(int id, Color c) {} }
  public struct Color { public float r, g, b, a; public Color(float r, float g, float b, float a = 1) { this.r = r; this.g = g; this.b = b; this.a = a; }
    public static Color white, black, clear; public static Color Lerp(Color a, Color b, float t) { return a; }
    public static implicit operator Color(Color32 c) { return default(Color); } }
  public struct Color32 { public byte r, g, b, a; public Color32(byte r, byte g, byte b, byte a) { this.r = r; this.g = g; this.b = b; this.a = a; } }
  public struct Vector2 { public float x, y; public Vector2(float x, float y) { this.x = x; this.y = y; } public static Vector2 zero, one; public float magnitude { get { return 0; } }
    public static float Distance(Vector2 a, Vector2 b) { return 0; }
    public static Vector2 operator -(Vector2 a, Vector2 b) { return a; } public static Vector2 operator +(Vector2 a, Vector2 b) { return a; } public static Vector2 operator *(Vector2 a, float d) { return a; }
    public static implicit operator Vector2(Vector3 v) { return default(Vector2); } public static implicit operator Vector3(Vector2 v) { return default(Vector3); } }
  public struct Vector3 { public float x, y, z; public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
    public static Vector3 up, zero, forward, right, one; public static float Dot(Vector3 a, Vector3 b) { return 0; } public float magnitude { get { return 0; } }
    public static Vector3 Lerp(Vector3 a, Vector3 b, float t) { return a; }
    public static Vector3 operator -(Vector3 a, Vector3 b) { return a; } public static Vector3 operator +(Vector3 a, Vector3 b) { return a; } public static Vector3 operator -(Vector3 a) { return a; }
    public static Vector3 operator *(Vector3 a, float d) { return a; } public static Vector3 operator *(float d, Vector3 a) { return a; } public float x0 { get { return x; } } public static Vector3 operator /(Vector3 a, float d) { return a; } }
  public struct Rect { public Rect(float x, float y, float w, float h) { xMin = x; yMin = y; xMax = x + w; yMax = y + h; } public float xMin, yMin, xMax, yMax;
    public static Rect MinMaxRect(float a, float b, float c, float d) { return default(Rect); } }
  public struct Quaternion { public static Quaternion identity; public static bool operator ==(Quaternion a, Quaternion b) { return true; } public static bool operator !=(Quaternion a, Quaternion b) { return false; } public override bool Equals(object o) { return true; } public override int GetHashCode() { return 0; } public static Quaternion Euler(float x, float y, float z) { return default(Quaternion); }
    public static Quaternion LookRotation(Vector3 f, Vector3 u) { return default(Quaternion); }
    public static Quaternion RotateTowards(Quaternion a, Quaternion b, float d) { return a; }
    public static Quaternion operator *(Quaternion a, Quaternion b) { return a; } public static Vector3 operator *(Quaternion a, Vector3 v) { return v; } }
  public static class Mathf { public const float Deg2Rad = 0.0174f, Rad2Deg = 57.29f, PI = 3.14159f; public static float Tan(float a) { return a; } public static float Sin(float a) { return a; } public static float Cos(float a) { return a; } public static int CeilToInt(float v) { return 0; } public static float Abs(float a) { return a; }
    public static float Lerp(float a, float b, float t) { return a; } public static float LerpAngle(float a, float b, float t) { return a; } public static float DeltaAngle(float a, float b) { return a; }
    public static float Clamp(float v, float a, float b) { return v; } public static float Clamp01(float v) { return v; } public static float Atan2(float y, float x) { return y; } public static float Pow(float a, float b) { return a; }
    public static int RoundToInt(float v) { return 0; } public static float Round(float v) { return v; } public static int Max(int a, int b) { return a; } public static float Max(float a, float b) { return a; } public static int Min(int a, int b) { return a; } public static float Min(float a, float b) { return a; } }
  public static class Debug { public static void Log(object m, Object c = null) {} public static void LogWarning(object m, Object c = null) {} public static void LogError(object m, Object c = null) {} }
  public static class Time { public static float time, deltaTime, unscaledTime, unscaledDeltaTime; }
  public enum TouchPhase { Began, Moved, Stationary, Ended, Canceled }
  public struct Touch { public Vector2 position; public TouchPhase phase; public int fingerId; }
  public static class Input { public static int touchCount; public static Vector3 mousePosition; public static Vector2 mouseScrollDelta; public static Touch GetTouch(int i) { return default(Touch); }
    public static bool GetMouseButton(int b) { return false; } public static bool GetMouseButtonDown(int b) { return false; } public static bool GetMouseButtonUp(int b) { return false; } }
  public class SerializeField : Attribute {} public class DisallowMultipleComponent : Attribute {}
  public class MinAttribute : Attribute { public MinAttribute(float m) {} }
  public class TooltipAttribute : Attribute { public TooltipAttribute(string t) {} }
  public class HeaderAttribute : Attribute { public HeaderAttribute(string t) {} }
  public class ContextMenu : Attribute { public ContextMenu(string t) {} }
  public class RequireComponent : Attribute { public RequireComponent(Type t) {} }
  public class DefaultExecutionOrder : Attribute { public DefaultExecutionOrder(int o) {} }
  public class CreateAssetMenuAttribute : Attribute { public string menuName, fileName; }
  public enum RenderMode { ScreenSpaceOverlay, ScreenSpaceCamera, WorldSpace }
  public class Canvas : Behaviour { public RenderMode renderMode; public Camera worldCamera; public int sortingOrder; }
  public class Camera : Behaviour { public static Camera main; public bool orthographic; public float orthographicSize, fieldOfView, nearClipPlane, farClipPlane; public int pixelHeight;
    public CameraClearFlags clearFlags; public Color backgroundColor;
    public Vector3 WorldToViewportPoint(Vector3 p) { return p; } public Vector3 WorldToScreenPoint(Vector3 p) { return p; } }
  public class RectTransform : Transform { public Rect rect; public Vector2 anchorMin, anchorMax, pivot, anchoredPosition, sizeDelta, offsetMin, offsetMax; }
  public class Sprite : Object {}
  public class CanvasRenderer : Component { public bool cull; }
  public class RangeAttribute : Attribute { public RangeAttribute(float a, float b) {} }
}
namespace UnityEngine {
  public struct UIVertex { public Vector3 position; public Color32 color; public static UIVertex simpleVert; }
}
namespace UnityEngine.Rendering {
  public enum ShadowCastingMode { Off, On, TwoSided, ShadowsOnly }
  public enum IndexFormat { UInt16, UInt32 }
  public enum AmbientMode { Skybox, Trilight, Flat, Custom }
  public class RenderPipelineAsset : Object {}
  public static class GraphicsSettings { public static RenderPipelineAsset currentRenderPipeline; }
}
namespace UnityEngine.Events {
  public class UnityEvent { public void AddListener(Action a) {} }
  public class UnityEvent<T> { public void AddListener(Action<T> a) {} }
}
namespace UnityEngine.UI {
  public class Graphic : Behaviour { public Color color; public bool raycastTarget; public CanvasRenderer canvasRenderer; public RectTransform rectTransform; }
  public class Image : Graphic { public enum Type { Simple, Sliced, Tiled, Filled } public enum FillMethod { Horizontal, Vertical, Radial90, Radial180, Radial360 }
    public Sprite sprite; public Type type; public FillMethod fillMethod; public float fillAmount; }
  public enum HorizontalWrapMode { Wrap, Overflow } public enum VerticalWrapMode { Truncate, Overflow }
  public class Text : Graphic { public string text; public Font font; public int fontSize; public FontStyle fontStyle; public TextAnchor alignment; public bool supportRichText; public HorizontalWrapMode horizontalOverflow; public VerticalWrapMode verticalOverflow; }
  public class Selectable : Behaviour { public Graphic targetGraphic; public bool interactable; }
  public class Button : Selectable { public class ButtonClickedEvent : UnityEngine.Events.UnityEvent {} public ButtonClickedEvent onClick = new ButtonClickedEvent(); }
  public class CanvasScaler : Behaviour { public enum ScaleMode { ConstantPixelSize, ScaleWithScreenSize, ConstantPhysicalSize } public ScaleMode uiScaleMode; public Vector2 referenceResolution; public float matchWidthOrHeight; }
  public class GraphicRaycaster : Behaviour {}
  public class RectMask2D : Behaviour {}
  public class ScrollRect : Behaviour { public enum MovementType { Unrestricted, Elastic, Clamped } public RectTransform content; public bool horizontal, vertical; public MovementType movementType; public float scrollSensitivity; }
  public class MaskableGraphic : Graphic { protected virtual void OnPopulateMesh(VertexHelper vh) {} public virtual void SetVerticesDirty() {} }
  public class VertexHelper { public void Clear() {} public void AddVert(UIVertex v) {} public void AddTriangle(int a, int b, int c) {} }
  public class GridLayoutGroup : Behaviour { public Vector2 cellSize, spacing; }
}
namespace UnityEngine.EventSystems {
  public class BaseEventData {} public class PointerEventData : BaseEventData {} public interface IPointerClickHandler { void OnPointerClick(PointerEventData e); }
  public class EventSystem : Behaviour { public static EventSystem current; public bool IsPointerOverGameObject() { return false; } public bool IsPointerOverGameObject(int id) { return false; } }
  public class StandaloneInputModule : Behaviour {}
  public enum EventTriggerType { PointerEnter, PointerExit, PointerDown, PointerUp, PointerClick }
  public class EventTrigger : Behaviour { public class TriggerEvent : UnityEngine.Events.UnityEvent<BaseEventData> {}
    public class Entry { public EventTriggerType eventID; public TriggerEvent callback = new TriggerEvent(); } public List<Entry> triggers = new List<Entry>(); }
}
