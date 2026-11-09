import { useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

const PRESETS = [
  ["#c9a24b", "#111111"], ["#b5272d", "#14110f"], ["#2f6fdd", "#0d1b2a"],
  ["#1f9d6b", "#0f1a14"], ["#e07a2e", "#1b130c"], ["#8e5bd6", "#120f1a"],
];

// Logo: telefondan secilen resmi 256px'e kucultup kaydeder.
function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Resim okunamadı."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Bu dosya bir resim değil."));
      img.onload = () => {
        const size = 256;
        const scale = Math.min(1, size / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export default function Brand() {
  const { shop, setShop } = useAuth();
  const [form, setForm] = useState({
    name: shop.name, about: shop.about, phone: shop.phone, whatsapp: shop.whatsapp,
    address: shop.address, city: shop.city, primaryColor: shop.primaryColor,
    accentColor: shop.accentColor, logo: shop.logo, slotMinutes: shop.slotMinutes,
  });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const pickLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setForm({ ...form, logo: await resizeImage(file) });
    } catch (err) {
      setError(err.message);
    }
  };

  const save = async (e) => {
    e.preventDefault();
    setError("");
    setMsg("");
    try {
      const updated = await api("/shop", { method: "PATCH", body: { ...form, slotMinutes: Number(form.slotMinutes) } });
      setShop(updated);
      setMsg("Markan kaydedildi. Sayfan güncellendi.");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card form-grid" onSubmit={save}>
      <h3>Markan</h3>

      <div className="brand-preview" style={{ background: form.accentColor, borderColor: form.primaryColor }}>
        {form.logo ? <img src={form.logo} alt="logo" /> : <span className="logo-fallback big" style={{ width: 56, height: 56, borderRadius: 14 }}><Icon name="scissors" /></span>}
        <strong style={{ color: form.primaryColor }}>{form.name || "Dükkan adı"}</strong>
      </div>

      <label>Logo<input type="file" accept="image/*" onChange={pickLogo} /></label>
      {form.logo && <button type="button" className="btn btn-ghost btn-small" onClick={() => setForm({ ...form, logo: "" })}>Logoyu kaldır</button>}

      <label>Dükkan adı<input value={form.name} onChange={set("name")} required /></label>
      <label>Hakkında<textarea rows={3} value={form.about} onChange={set("about")} placeholder="Ör. 15 yıllık tecrübe, klasik ve modern kesimler." /></label>

      <div className="tiny muted">Renkler</div>
      <div className="presets">
        {PRESETS.map(([p, a]) => (
          <button type="button" key={p} className="preset" style={{ background: a, borderColor: p }}
            onClick={() => setForm({ ...form, primaryColor: p, accentColor: a })} aria-label="renk">
            <span style={{ background: p }} />
          </button>
        ))}
      </div>
      <div className="row">
        <label>Ana renk<input type="color" value={form.primaryColor} onChange={set("primaryColor")} /></label>
        <label>Zemin rengi<input type="color" value={form.accentColor} onChange={set("accentColor")} /></label>
      </div>

      <div className="row">
        <label>Telefon<input value={form.phone} onChange={set("phone")} inputMode="tel" /></label>
        <label>WhatsApp<input value={form.whatsapp} onChange={set("whatsapp")} inputMode="tel" /></label>
      </div>
      <label>Adres<input value={form.address} onChange={set("address")} /></label>
      <label>Şehir<input value={form.city} onChange={set("city")} /></label>
      <label>
        Randevu aralığı
        <select value={form.slotMinutes} onChange={set("slotMinutes")}>
          {[10, 15, 20, 30, 45, 60].map((m) => <option key={m} value={m}>{m} dakika</option>)}
        </select>
      </label>

      {error && <div className="alert">{error}</div>}
      {msg && <div className="notice">{msg}</div>}
      <button className="btn btn-block">Kaydet</button>
    </form>
  );
}
