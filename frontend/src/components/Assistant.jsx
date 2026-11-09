import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import Icon from "./Icon.jsx";

// Karar motoru ekrani: oneriler + otomatik karar ayarlari + karar gecmisi.
const LEVEL = { high: ["Acil", "st-cancel"], medium: ["Önemli", "st-pending"], low: ["Öneri", "st-ok"], info: ["Bilgi", "st-done"] };
const OUTCOME = { CONFIRM: ["Otomatik onaylandı", "st-ok"], REVIEW: ["Berber onayına düştü", "st-pending"], REJECT: ["Reddedildi", "st-cancel"], ASSIGN: ["Berber atandı", "st-done"] };

const MODES = [
  ["MANUAL", "Her randevuyu ben onaylayayım", "Online gelen her randevu “Bekliyor” olarak düşer."],
  ["TRUSTED", "Daha önce gelenleri otomatik onayla", "En az bir kez gelmiş, sorunsuz müşteri doğrudan onaylanır. Yeni ve riskli müşteriler sana sorulur."],
  ["ALL", "Hepsini otomatik onayla", "Riskli müşteriler (gelmeyen/iptal eden) yine sana sorulur."],
];

const time = (d) => new Date(d).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Assistant({ goTo }) {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [cards, setCards] = useState(null);
  const [settings, setSettings] = useState(null);
  const [log, setLog] = useState([]);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, s, l] = await Promise.all([
        api("/shop/decisions/insights"), api("/shop/decisions/settings"), api("/shop/decisions/log?limit=30"),
      ]);
      setCards(c);
      setSettings(s);
      setLog(l);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (patch) => {
    setMsg("");
    setError("");
    try {
      const saved = await api("/shop/decisions/settings", { method: "PATCH", body: patch });
      setSettings(saved);
      setMsg("Kaydedildi. Bundan sonraki randevular bu kurallarla karar verilecek.");
      api("/shop/decisions/insights").then(setCards).catch(() => {});
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <section>
      <div className="card">
        <h3 className="section-title"><Icon name="sparkles" />Öneriler</h3>
        <p className="tiny muted">Dükkanının verilerine bakıp ne yapabileceğini söyler. Kararı sen verirsin.</p>
        {cards === null && <p className="muted">Yükleniyor…</p>}
        {cards?.length === 0 && <p className="muted">Şu an önerim yok, her şey yolunda.</p>}
        <ul className="insight-list">
          {cards?.map((c) => (
            <li key={c.code} className={`insight lvl-${c.level}`}>
              <div className="insight-top">
                <strong>{c.title}</strong>
                <span className={`badge ${LEVEL[c.level][1]}`}>{LEVEL[c.level][0]}</span>
              </div>
              {c.detail && <div className="tiny muted">{c.detail}</div>}
              {c.action && c.action !== "asistan" && (
                <button className="btn btn-ghost btn-small" onClick={() => goTo(c.action)}>Aç<Icon name="chevronRight" /></button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {settings && (
        <div className="card form-grid">
          <h3 className="section-title"><Icon name="sliders" />Otomatik kurallar</h3>
          {!isOwner && <p className="tiny muted">Bu ayarları sadece dükkan sahibi değiştirebilir.</p>}
          <div className="mode-list">
            {MODES.map(([key, title, detail]) => (
              <label key={key} className={settings.confirmMode === key ? "mode active" : "mode"}>
                <input type="radio" name="confirmMode" checked={settings.confirmMode === key} disabled={!isOwner}
                  onChange={() => save({ confirmMode: key })} />
                <span><b>{title}</b><small className="muted block">{detail}</small></span>
              </label>
            ))}
          </div>
          <div className="row">
            <label>
              Kaç kez gelmeyen engellensin?
              <select value={settings.noShowLimit} disabled={!isOwner} onChange={(e) => save({ noShowLimit: Number(e.target.value) })}>
                {[1, 2, 3, 4, 5, 10].map((n) => <option key={n} value={n}>{n} kez</option>)}
              </select>
            </label>
            <label>
              Bir numaraya en fazla kaç bekleyen randevu?
              <select value={settings.maxActivePerPhone} disabled={!isOwner} onChange={(e) => save({ maxActivePerPhone: Number(e.target.value) })}>
                {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} randevu</option>)}
              </select>
            </label>
          </div>
          <p className="tiny muted">Engellenen müşteri online randevu alamaz ama seni arayabilir; sen panelden elle ekleyebilirsin.</p>
          <label>
            Sadakat programı
            <select value={settings.loyaltyEvery || 0} disabled={!isOwner} onChange={(e) => save({ loyaltyEvery: Number(e.target.value) })}>
              <option value={0}>Kapalı</option>
              {[5, 6, 8, 10, 12, 15].map((n) => <option key={n} value={n}>Her {n}. ziyaret hediye</option>)}
            </select>
          </label>
          <p className="tiny muted">Açıksa müşteri randevu alırken kaçıncı ziyareti olduğunu görür; hediye randevu ücretsiz yazılır ve kasaya 0 ₺ düşer.</p>
          {msg && <div className="notice">{msg}</div>}
        </div>
      )}

      {error && <div className="alert">{error}</div>}

      <div className="card">
        <h3 className="section-title"><Icon name="history" />Karar geçmişi</h3>
        <p className="tiny muted">Her online randevuda motorun ne karar verdiği ve neden.</p>
        {log.length === 0 && <p className="muted">Henüz karar yok. İlk online randevuda burada görünecek.</p>}
        <ul className="log-list">
          {log.map((d) => (
            <li key={d.id}>
              <div className="insight-top">
                <span className={`badge ${OUTCOME[d.outcome]?.[1] || ""}`}>{OUTCOME[d.outcome]?.[0] || d.outcome}</span>
                <small className="muted">{time(d.createdAt)} • {d.subject}</small>
              </div>
              <ul className="reason-list tiny">
                {d.reasons.map((r) => <li key={r.code}>{r.message}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
