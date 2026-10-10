// JsonUtility stand-in: reflection over public fields of [Serializable] types, like the real one (tools/check only).
using System; using System.Collections; using System.Collections.Generic; using System.Globalization; using System.Reflection; using System.Text;
namespace UnityEngine {
  public static class Application { public static string streamingAssetsPath = ""; }
  public static class JsonUtility {
    public static T FromJson<T>(string s) { int i = 0; var v = Parse(s, ref i); return (T)Map(v, typeof(T)); }
    static void Ws(string s, ref int i) { while (i < s.Length && char.IsWhiteSpace(s[i])) i++; }
    static object Parse(string s, ref int i) {
      Ws(s, ref i); char c = s[i];
      if (c == '{') { var d = new Dictionary<string, object>(); i++; Ws(s, ref i); if (s[i] == '}') { i++; return d; }
        for (;;) { Ws(s, ref i); var k = (string)Parse(s, ref i); Ws(s, ref i); i++; d[k] = Parse(s, ref i); Ws(s, ref i); if (s[i++] == '}') return d; } }
      if (c == '[') { var l = new List<object>(); i++; Ws(s, ref i); if (s[i] == ']') { i++; return l; }
        for (;;) { l.Add(Parse(s, ref i)); Ws(s, ref i); if (s[i++] == ']') return l; } }
      if (c == '"') { var sb = new StringBuilder(); i++; while (s[i] != '"') { if (s[i] == '\\') { i++; char e = s[i]; if (e == 'u') { sb.Append((char)Convert.ToInt32(s.Substring(i + 1, 4), 16)); i += 4; } else sb.Append(e == 'n' ? '\n' : e == 't' ? '\t' : e); } else sb.Append(s[i]); i++; } i++; return sb.ToString(); }
      if (s.Substring(i).StartsWith("true")) { i += 4; return true; } if (s.Substring(i).StartsWith("false")) { i += 5; return false; } if (s.Substring(i).StartsWith("null")) { i += 4; return null; }
      int st = i; while (i < s.Length && "+-0123456789.eE".IndexOf(s[i]) >= 0) i++; return double.Parse(s.Substring(st, i - st), CultureInfo.InvariantCulture);
    }
    static object Map(object v, Type t) {
      if (t == typeof(string)) return v as string;
      if (t == typeof(int)) return v == null ? 0 : Convert.ToInt32(v); if (t == typeof(float)) return v == null ? 0f : Convert.ToSingle(v); if (t == typeof(double)) return v == null ? 0.0 : Convert.ToDouble(v); if (t == typeof(bool)) return v != null && (bool)v;
      if (t.IsArray) { var l = v as List<object> ?? new List<object>(); var a = Array.CreateInstance(t.GetElementType(), l.Count); for (int i = 0; i < l.Count; i++) a.SetValue(Map(l[i], t.GetElementType()), i); return a; }
      if (t.IsGenericType && t.GetGenericTypeDefinition() == typeof(List<>)) { var l = v as List<object> ?? new List<object>(); var o = (IList)Activator.CreateInstance(t); foreach (var x in l) o.Add(Map(x, t.GetGenericArguments()[0])); return o; }
      if (v == null && !t.IsValueType) return null;
      if (!t.IsDefined(typeof(SerializableAttribute), false)) throw new Exception("not [Serializable]: " + t);
      var obj = Activator.CreateInstance(t); var d = v as Dictionary<string, object> ?? new Dictionary<string, object>();
      foreach (var f in t.GetFields(BindingFlags.Public | BindingFlags.Instance)) { if (f.IsNotSerialized) continue; object x; d.TryGetValue(f.Name, out x); f.SetValue(obj, Map(x, f.FieldType)); }
      return obj;
    }
  }
}
namespace UnityEngine.Networking {
  public class DownloadHandler { public string text; }
  public class UnityWebRequest : IDisposable { public enum Result { InProgress, Success, ConnectionError, ProtocolError, DataProcessingError }
    public Result result; public string error; public DownloadHandler downloadHandler; public static UnityWebRequest Get(string u) { return new UnityWebRequest(); } public object SendWebRequest() { return null; } public void Dispose() {} }
}
