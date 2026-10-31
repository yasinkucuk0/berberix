import { Link } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";

const FEATURES = [
  ["Kendi markan", "Dükkan adın, logon, renklerin. Müşterin senin sayfanı görür."],
  ["7/24 online randevu", "Müşteri boş saati görür, randevuyu kendisi alır. Telefon trafiği biter."],
  ["Çakışma yok", "Aynı saate iki randevu düşmez; kapalı günler otomatik kapanır."],
  ["Cebinde panel", "Randevuları onayla, hizmet ve fiyatları güncelle, haftalık kazancını gör."],
];

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="topbar">
        <span className="brand">✂ Berberim</span>
        <nav>
          {user ? (
            <Link className="btn btn-small" to={user.role === "PLATFORM_ADMIN" ? "/yonetim" : "/panel"}>Panele git</Link>
          ) : (
            <Link className="link" to="/giris">Giriş</Link>
          )}
        </nav>
      </header>

      <section className="hero">
        <h1>Dükkanının online randevu sitesi, <span className="gold">2 dakikada</span> hazır.</h1>
        <p className="muted">
          Kendi markanla sayfanı oluştur, linkini müşterilerine gönder. Randevular
          telefonuna düşsün. 14 gün ücretsiz dene, kredi kartı gerekmez.
        </p>
        <div className="hero-actions">
          <Link className="btn" to="/kayit">Dükkanımı oluştur</Link>
          <Link className="btn btn-ghost" to="/giris">Hesabım var</Link>
        </div>
        <p className="tiny muted">Örnek adres: berberim.app/<b>ahmet-berber</b></p>
      </section>

      <section className="features">
        {FEATURES.map(([title, text]) => (
          <div key={title} className="card">
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <footer className="footer muted tiny">Berberim • Berberler için, bir berber tarafından.</footer>
    </div>
  );
}
