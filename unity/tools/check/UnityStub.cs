// Minimal UnityEngine stand-in so the scripts compile outside Unity (tools/check only; never shipped).
// Minimal compile-only stub of the UnityEngine API used by the pooling scripts. Not runnable.
using System;
using System.Collections;
namespace UnityEngine {
  public class Object { public string name; public int GetInstanceID() { return 0; }
    public static T Instantiate<T>(T original, Transform parent, bool worldPositionStays) where T : Object { return original; } public static T Instantiate<T>(T original, Transform parent) where T : Object { return original; }
    public static void Destroy(Object o) {} public static void DontDestroyOnLoad(Object o) {}
    public static implicit operator bool(Object o) { return !ReferenceEquals(o, null); } }
  public class Component : Object { public Transform transform; public GameObject gameObject;
    public T GetComponent<T>() { return default(T); } public T[] GetComponentsInChildren<T>(bool includeInactive) { return new T[0]; } }
  public class Behaviour : Component { public bool enabled; }
  public class MonoBehaviour : Behaviour { public Coroutine StartCoroutine(IEnumerator r) { return null; } }
  public class Coroutine {}
  public class ScriptableObject : Object {}
  public class GameObject : Object { public GameObject(string n) {} public Transform transform; public void SetActive(bool v) {}
    public T GetComponent<T>() { return default(T); } public T AddComponent<T>() where T : Component { return default(T); } }
  public class Transform : Component { public Vector3 position; public Quaternion rotation; public Vector3 forward, right;
    public void SetParent(Transform p, bool worldPositionStays) {} public void SetPositionAndRotation(Vector3 p, Quaternion r) {} }
  public class Renderer : Component { public void SetPropertyBlock(MaterialPropertyBlock b) {} }
  public class MaterialPropertyBlock { public void Clear() {} public void SetColor(int id, Color c) {} }
  public static class Shader { public static int PropertyToID(string n) { return 0; } }
  public struct Color { public float r, g, b, a; public static implicit operator Color(Color32 c) { return default(Color); } }
  public struct Color32 { public byte r, g, b, a; public Color32(byte r, byte g, byte b, byte a) { this.r = r; this.g = g; this.b = b; this.a = a; } }
  public struct Vector3 { public float x, y, z; public Vector3(float x, float y, float z) { this.x = x; this.y = y; this.z = z; }
    public static Vector3 up, zero; public static float Dot(Vector3 a, Vector3 b) { return 0; } public float magnitude { get { return 0; } }
    public static Vector3 operator -(Vector3 a, Vector3 b) { return a; } public static Vector3 operator +(Vector3 a, Vector3 b) { return a; }
    public static Vector3 operator *(Vector3 a, float d) { return a; } public float x0 { get { return x; } } public static Vector3 operator /(Vector3 a, float d) { return a; } }
  public struct Quaternion { public static Quaternion identity; public static bool operator ==(Quaternion a, Quaternion b) { return true; } public static bool operator !=(Quaternion a, Quaternion b) { return false; } public override bool Equals(object o) { return true; } public override int GetHashCode() { return 0; } public static Quaternion Euler(float x, float y, float z) { return default(Quaternion); }
    public static Quaternion LookRotation(Vector3 f, Vector3 u) { return default(Quaternion); }
    public static Quaternion RotateTowards(Quaternion a, Quaternion b, float d) { return a; }
    public static Quaternion operator *(Quaternion a, Quaternion b) { return a; } }
  public static class Mathf { public const float Deg2Rad = 0.0174f; public static float Tan(float a) { return a; } public static float Sin(float a) { return a; } public static float Abs(float a) { return a; } public static float Lerp(float a, float b, float t) { return a; } public static float Clamp(float v, float a, float b) { return v; } public static int Max(int a, int b) { return a; } public static float Max(float a, float b) { return a; } public static int Min(int a, int b) { return a; } public static float Min(float a, float b) { return a; } }
  public static class Debug { public static void Log(object m, Object c = null) {} public static void LogWarning(object m, Object c = null) {} public static void LogError(object m, Object c = null) {} }
  public static class Time { public static float time, deltaTime, unscaledTime; }
  public class SerializeField : Attribute {} public class DisallowMultipleComponent : Attribute {}
  public class MinAttribute : Attribute { public MinAttribute(float m) {} }
  public class TooltipAttribute : Attribute { public TooltipAttribute(string t) {} }
  public class HeaderAttribute : Attribute { public HeaderAttribute(string t) {} }
  public class ContextMenu : Attribute { public ContextMenu(string t) {} }
  public class RequireComponent : Attribute { public RequireComponent(Type t) {} }
  public class DefaultExecutionOrder : Attribute { public DefaultExecutionOrder(int o) {} }
  public class CreateAssetMenuAttribute : Attribute { public string menuName, fileName; }
}
namespace UnityEngine {
  public enum RenderMode { ScreenSpaceOverlay, ScreenSpaceCamera, WorldSpace }
  public class Canvas : Behaviour { public RenderMode renderMode; public Camera worldCamera; }
  public class Camera : Behaviour { public static Camera main; public bool orthographic; public float orthographicSize, fieldOfView; public int pixelHeight;
    public Vector3 WorldToViewportPoint(Vector3 p) { return p; } }
  public class RectTransform : Transform { public Quaternion localRotation; public Vector3 localScale; }
  public class Sprite : Object {}
  public class CanvasRenderer : Component { public bool cull; }
  public class RangeAttribute : Attribute { public RangeAttribute(float a, float b) {} }
}
namespace UnityEngine.UI {
  public class Graphic : Behaviour { public Color color; public bool raycastTarget; public CanvasRenderer canvasRenderer; }
  public class Image : Graphic { public enum Type { Simple, Sliced, Tiled, Filled } public enum FillMethod { Horizontal, Vertical, Radial90, Radial180, Radial360 }
    public Sprite sprite; public Type type; public FillMethod fillMethod; public float fillAmount; }
}
namespace UnityEngine.EventSystems {
  public class PointerEventData {} public interface IPointerClickHandler { void OnPointerClick(PointerEventData e); }
}
