// Backend adresi: .env'de VITE_API_URL yoksa ayni bilgisayarin 5100 portu
// (telefondan acildiginda da bilgisayarin IP'sini kullanir).
export const API_URL =
  import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:5100/api`;

const TOKEN_KEY = "berberim_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* gizli mod: oturum bellekte kalir */
  }
}

export async function api(path, { method = "GET", body, auth = true, full = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = auth ? getToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;
  let res;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error("Sunucuya ulaşılamadı. İnternet bağlantını kontrol et.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    setToken(null);
    window.dispatchEvent(new Event("berberim:logout"));
  }
  if (!res.ok || data.success === false) throw new Error(data.message || "İşlem başarısız oldu.");
  return full ? data : data.data;
}

export const money = (n) => `${Number(n || 0).toLocaleString("tr-TR")} ₺`;

export function todayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  return d.toLocaleDateString("tr-TR", { weekday: "short", day: "numeric", month: "short" });
}

export function waLink(phone, text) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `90${digits.slice(1)}`;
  if (digits.length === 10) digits = `90${digits}`;
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

// Marka renginin uzerindeki yazi rengi (koyu renkte beyaz, acik renkte siyah)
export function inkFor(hex) {
  const m = /^#([0-9a-f]{6})$/i.exec(String(hex || ""));
  if (!m) return "#111";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111" : "#fff";
}
