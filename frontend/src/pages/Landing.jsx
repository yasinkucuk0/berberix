import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, waLink } from "../lib/api";
import { useAuth } from "../lib/auth.jsx";
import { BRAND, PLANS } from "../config/brand.js";
import Icon, { Wordmark } from "../components/Icon.jsx";

const FEATURES = [
  ["calendar", "7/24 online randevu", "Müşterin boş saati görür, randevusunu kendisi alır. Telefon trafiği biter, iki randevu aynı saate düşmez."],
  ["scissors", "Her berbere ayrı takvim", "Müşteri berberini seçer ya da “fark etmez” der. Sistem işi en boş berbere verir, yük dengelenir."],
  ["sparkles", "Akıllı asistan", "Sürekli gelmeyeni durdurur, güvendiğin müşteriyi otomatik onaylar, bugün ne yapman gerektiğini söyler."],
  ["people", "Müşteri defteri", "Kim kaç kez geldi, ne harcadı, kim kayboldu. Kaybolana tek dokunuşla “seni özledik” mesajı."],
  ["wallet", "Kasa", "Randevuyu bitirdiğinde ücret kasaya kendiliğinden düşer. Nakit, kart, gider ve gün sonu tek ekranda."],
  ["palette", "Kendi markan", "Dükkan adın, logon, renklerin. Müşterin senin sayfanı görür, telefonuna uygulama gibi ekler."],
];

const FAQ = [
  ["Kurulum ne kadar sürer?", "İki dakika. Dükkan adını yazarsın, sayfan hazır olur. Hizmetler ve çalışma saatleri hazır gelir, sadece fiyatlarını düzeltirsin."],
  ["Müşterim uygulama indirmek zorunda mı?", "Hayır. Gönderdiğin bağlantıya dokunur ve randevusunu alır. İsterse telefonunun ana ekranına ekler."],
  ["Kredi kartı gerekiyor mu?", `Hayır. İlk ${BRAND.trialDays} gün tamamen ücretsiz, kart bilgisi istemiyoruz. Beğenirsen devam edersin.`],
  ["Verilerim güvende mi?", "Her dükkanın verisi ayrı tutulur, başka dükkan göremez. KVKK aydınlatma ve onay adımları hazır gelir."],
  ["Çalışanlarım kasayı görür mü?", "Hayır. Çalışanların kendi telefonlarından sadece kendi randevularını görür. Kasa ve müşteri listesi sende kalır."],
];

export default function Landing() {
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const [demoError, setDemoError] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);

  const tryDemo = async () => {
    setDemoError("");
    setDemoBusy(true);
    try {
      signIn(await api("/auth/demo", { method: "POST", auth: false }));
      navigate("/panel");
    } catch (err) {
      setDemoError(err.message);
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="landing">
      <header className="topbar">
        <Link to="/" className="brand"><Wordmark /></Link>
        <nav>
          <a className="link" href="#ozellikler">Özellikler</a>
          <a className="link" href="#fiyatlar">Fiyatlar</a>
          {user ? (
            <Link className="btn btn-small" to={user.role === "PLATFORM_ADMIN" ? "/yonetim" : "/panel"}>Panel</Link>
          ) : (
            <Link className="btn btn-ghost btn-small" to="/giris">Giriş</Link>
          )}
        </nav>
      </header>

      <section className="hero">
        <p className="eyebrow">Berberler için. Bir berber tarafından.</p>
        <h1>Dükkanın, <span className="gold">cebinde.</span></h1>
        <p className="lead">
          Online randevu, her berbere ayrı takvim, müşteri defteri ve kasa. Hepsi tek bir uygulamada, kendi markanla.
        </p>
        <div className="hero-actions">
          <Link className="btn" to="/kayit">Ücretsiz başla</Link>
          <button className="btn btn-ghost" onClick={tryDemo} disabled={demoBusy}>{demoBusy ? "Açılıyor…" : "Canlı demoyu aç"}</button>
        </div>
        {demoError && <p className="tiny err">{demoError}</p>}
        <p className="hero-note">{BRAND.trialDays} gün ücretsiz · Kart gerekmez · 2 dakikada kurulum</p>
      </section>

      <div className="showcase">
        <figure className="device tilt-l"><img src="/showcase/panel.jpg" alt="BERBERİX dükkan paneli" loading="eager" /></figure>
        <figure className="device tilt-r"><img src="/showcase/musteri.jpg" alt="Müşterinin randevu ekranı" loading="eager" /></figure>
      </div>

      <div className="trust">
        <span><Icon name="shield" />KVKK uyumlu</span>
        <span><Icon name="lock" />Her dükkanın verisi ayrı</span>
        <span><Icon name="checkCircle" />Taahhüt yok</span>
      </div>

      <section id="ozellikler" className="section">
        <h2>Dükkanın için gereken her şey.</h2>
        <p className="sub">Randevudan kasaya kadar. Kâğıt deftere, kaçan aramalara ve unutulan randevulara son.</p>
        <div className="features">
          {FEATURES.map(([icon, title, text]) => (
            <div key={title} className="feature">
              <span className="feature-icon"><Icon name={icon} /></span>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="fiyatlar" className="section">
        <h2>Sade fiyatlar.</h2>
        <p className="sub">İlk {BRAND.trialDays} gün hepsi ücretsiz. Kart yok, taahhüt yok, istediğin an bırak.</p>
        <div className="plans">
          {PLANS.map((p) => (
            <div key={p.key} className={p.highlight ? "plan highlight" : "plan"}>
              {p.highlight && <span className="badge st-gold">{p.note}</span>}
              <h3>{p.name}</h3>
              {!p.highlight ? <p className="plan-note">{p.note}</p> : <p className="plan-note">&nbsp;</p>}
              <div className="price"><b>{p.price.toLocaleString("tr-TR")} ₺</b><small> / ay</small></div>
              <ul>{p.features.map((f) => <li key={f}><Icon name="check" />{f}</li>)}</ul>
              <Link className={p.highlight ? "btn btn-block" : "btn btn-ghost btn-block"} to="/kayit">Ücretsiz dene</Link>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2>Sık sorulanlar.</h2>
        <div className="faq-list" style={{ marginTop: 32 }}>
          {FAQ.map(([q, a]) => (
            <details key={q}>
              <summary>{q}<Icon name="chevronRight" /></summary>
              <p>{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="cta">
        <h2>Bugün başla, yarın randevu al.</h2>
        <p>Kurulum iki dakika. İlk {BRAND.trialDays} gün bizden.</p>
        <div className="hero-actions">
          <Link className="btn" to="/kayit">Dükkanımı oluştur</Link>
          {BRAND.contactWhatsApp && (
            <a className="btn btn-ghost" href={waLink(BRAND.contactWhatsApp, `Merhaba, ${BRAND.name} hakkında bilgi almak istiyorum.`)} target="_blank" rel="noreferrer">
              <Icon name="message" />Bize yaz
            </a>
          )}
        </div>
      </section>

      <footer className="footer">
        <div className="footer-contact">
          {BRAND.contactWhatsApp && <span><Icon name="phone" />{BRAND.contactWhatsApp}</span>}
          {BRAND.address && <span><Icon name="pin" />{BRAND.address}</span>}
        </div>
        <div><Link className="link" to="/kvkk">KVKK Aydınlatma Metni</Link> · <Link className="link" to="/kosullar">Kullanım Koşulları</Link></div>
        <div>© {new Date().getFullYear()} {BRAND.name}. Berberler için, bir berber tarafından.</div>
      </footer>
    </div>
  );
}
