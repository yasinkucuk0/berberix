import { useState } from "react";
import Services from "./Services.jsx";
import Hours from "./Hours.jsx";
import Brand from "./Brand.jsx";
import Share from "./Share.jsx";
import Staff from "./Staff.jsx";
import Account from "./Account.jsx";

// Ayarlar: dukkanin kurulum ekranlari tek sekmede.
export const SETTINGS_TABS = [
  ["hizmet", "Hizmetler", Services],
  ["calisan", "Çalışanlar", Staff],
  ["saat", "Saatler", Hours],
  ["marka", "Marka", Brand],
  ["paylas", "Paylaş", Share],
  ["hesap", "Hesabım", Account],
];

export default function Settings({ initial = "hizmet" }) {
  const [sub, setSub] = useState(initial);
  const Current = (SETTINGS_TABS.find((t) => t[0] === sub) || SETTINGS_TABS[0])[2];
  return (
    <section>
      <div className="day-strip">
        {SETTINGS_TABS.map(([key, label]) => (
          <button key={key} className={key === sub ? "chip active" : "chip"} onClick={() => setSub(key)}>{label}</button>
        ))}
      </div>
      <Current />
    </section>
  );
}
