import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../lib/auth.jsx";
import { inkFor } from "../lib/api";
import Appointments from "../components/Appointments.jsx";
import Services from "../components/Services.jsx";
import Hours from "../components/Hours.jsx";
import Brand from "../components/Brand.jsx";
import Share from "../components/Share.jsx";

const TABS = [
  ["randevu", "📅", "Randevular", Appointments],
  ["hizmet", "✂", "Hizmetler", Services],
  ["saat", "🕘", "Saatler", Hours],
  ["marka", "🎨", "Marka", Brand],
  ["paylas", "🔗", "Paylaş", Share],
];

export default function Panel() {
  const { shop, user, signOut } = useAuth();
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get("hosgeldin") ? "paylas" : "randevu");
  const Current = TABS.find((t) => t[0] === tab)[3];

  const trialDays = shop?.status === "TRIAL"
    ? Math.max(0, Math.ceil((new Date(shop.trialEndsAt) - Date.now()) / 86400000))
    : null;

  return (
    <div className="panel" style={{ "--brand": shop?.primaryColor || "#c9a24b", "--brand-ink": inkFor(shop?.primaryColor || "#c9a24b") }}>
      <header className="panel-head">
        <div className="panel-title">
          {shop?.logo ? <img src={shop.logo} alt="" className="logo-sm" /> : <span className="logo-sm logo-fallback">✂</span>}
          <div>
            <strong>{shop?.name}</strong>
            <div className="tiny muted">{user?.name}</div>
          </div>
        </div>
        <button className="btn btn-ghost btn-small" onClick={signOut}>Çıkış</button>
      </header>

      {shop && !shop.acceptingBookings && (
        <div className="alert">Online randevu kapalı: {shop.accessReason} Devam etmek için bizimle iletişime geç.</div>
      )}
      {trialDays !== null && shop?.acceptingBookings && (
        <div className="notice tiny">Ücretsiz deneme: {trialDays} gün kaldı.</div>
      )}

      <main className="panel-body">
        <Current />
      </main>

      <nav className="tabbar">
        {TABS.map(([key, icon, label]) => (
          <button key={key} className={key === tab ? "active" : ""} onClick={() => setTab(key)}>
            <span>{icon}</span>
            <small>{label}</small>
          </button>
        ))}
      </nav>
    </div>
  );
}
