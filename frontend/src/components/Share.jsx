import { useState } from "react";
import { useAuth } from "../lib/auth.jsx";

export default function Share() {
  const { shop } = useAuth();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/${shop.slug}`;
  const text = `${shop.name} için artık online randevu alabilirsiniz: ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Linki kopyala:", url);
    }
  };

  const share = () => {
    if (navigator.share) navigator.share({ title: shop.name, text, url }).catch(() => {});
    else copy();
  };

  return (
    <section className="card share">
      <h3>Dükkan sayfan hazır 🎉</h3>
      <p className="muted">Bu linki müşterilerine gönder, Instagram profiline ve Google işletme sayfana ekle.</p>
      <div className="share-url">{url}</div>
      <div className="row">
        <button className="btn" onClick={copy}>{copied ? "Kopyalandı ✓" : "Linki kopyala"}</button>
        <button className="btn btn-ghost" onClick={share}>Paylaş</button>
        <a className="btn btn-ghost" href={`/${shop.slug}`} target="_blank" rel="noreferrer">Sayfamı aç</a>
      </div>
      <a className="btn btn-block wa" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
        WhatsApp'ta paylaş
      </a>
      <h4>Telefona uygulama olarak ekle</h4>
      <ol className="tiny muted">
        <li>Bu paneli telefonun tarayıcısında aç.</li>
        <li>Android (Chrome): menü ⋮ → <b>Ana ekrana ekle / Uygulamayı yükle</b>.</li>
        <li>iPhone (Safari): Paylaş ⬆ → <b>Ana Ekrana Ekle</b>.</li>
      </ol>
    </section>
  );
}
