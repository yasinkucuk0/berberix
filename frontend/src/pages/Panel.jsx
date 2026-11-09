import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { inkFor } from "../lib/api";
import Appointments from "../components/Appointments.jsx";
import Assistant from "../components/Assistant.jsx";
import Customers from "../components/Customers.jsx";
import Cash from "../components/Cash.jsx";
import Settings, { SETTINGS_TABS } from "../components/Settings.jsx";
import Account from "../components/Account.jsx";
import Icon from "../components/Icon.jsx";

const TABS = [
  ["randevu", "calendar", "Randevular", Appointments],
  ["musteri", "people", "Müşteriler", Customers],
  ["kasa", "wallet", "Kasa", Cash],
  ["asistan", "sparkles", "Asistan", Assistant],
  ["ayar", "gear", "Ayarlar", Settings],
];
// Calisan (STAFF) sadece kendi randevularini ve hesabini gorur
const STAFF_TABS = [
  ["randevu", "calendar", "Randevularım", Appointments],
  ["hesap", "person", "Hesabım", Account],
];
const SUB_KEYS = SETTINGS_TABS.map((t) => t[0]);

export default function Panel() {
  const { shop, user, signOut } = useAuth();
  const [params] = useSearchParams();
  const [tab, setTabRaw] = useState(params.get("hosgeldin") ? "ayar" : "randevu");
  const [sub, setSub] = useState(params.get("hosgeldin") ? "paylas" : "hizmet");
  // Asistan "Git" dugmesi alt sekmeye de (hizmet, marka, paylas...) gidebilir
  const setTab = (key) => {
    if (SUB_KEYS.includes(key)) {
      setSub(key);
      setTabRaw("ayar");
    } else setTabRaw(key);
    window.scrollTo(0, 0);
  };
  const tabs = user?.role === "STAFF" ? STAFF_TABS : TABS;
  const currentTab = tabs.find((t) => t[0] === tab) || tabs[0];
  const Current = currentTab[3];

  const trialDays = shop?.status === "TRIAL"
    ? Math.max(0, Math.ceil((new Date(shop.trialEndsAt) - Date.now()) / 86400000))
    : null;

  return (
    <div className="panel" style={{ "--brand": shop?.primaryColor || "#c9a24b", "--brand-ink": inkFor(shop?.primaryColor || "#c9a24b") }}>
      <header className="panel-head">
        <div className="panel-title">
          {shop?.logo ? <img src={shop.logo} alt="" className="logo-sm" /> : <span className="logo-sm logo-fallback"><Icon name="scissors" /></span>}
          <div>
            <strong>{shop?.name}</strong>
            <div className="tiny muted">{user?.name}</div>
          </div>
        </div>
        <button className="icon-btn" onClick={signOut} title="Çıkış yap" aria-label="Çıkış yap"><Icon name="logout" /></button>
      </header>

      {shop?.isDemo && (
        <div className="notice tiny">
          <Icon name="info" />
          <span>Bu bir <b>demo dükkan</b>, her şeyi gönül rahatlığıyla deneyebilirsin. Beğendiysen <a className="link" href="/kayit" onClick={signOut}>kendi dükkanını oluştur</a>, ilk 14 gün ücretsiz.</span>
        </div>
      )}
      {shop && !shop.acceptingBookings && (
        <div className="alert"><Icon name="warning" /><span>Online randevu kapalı: {shop.accessReason} Devam etmek için bizimle iletişime geç.</span></div>
      )}
      {trialDays !== null && shop?.acceptingBookings && user?.role === "OWNER" && (
        <div className="notice tiny"><Icon name="clock" /><span>Ücretsiz denemende {trialDays} gün kaldı.</span></div>
      )}

      <main className="panel-body">
        <h1 className="page-title">{currentTab[2]}</h1>
        <Current key={tab === "ayar" ? `ayar-${sub}` : tab} goTo={setTab} initial={sub} />
      </main>

      <nav className="tabbar">
        {tabs.map(([key, icon, label]) => (
          <button key={key} className={key === tab ? "active" : ""} onClick={() => setTab(key)}>
            <Icon name={icon} stroke={key === tab ? 1.9 : 1.6} />
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
