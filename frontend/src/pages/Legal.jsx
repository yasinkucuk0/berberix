import { Link, useLocation } from "react-router-dom";
import { BRAND } from "../config/brand.js";
import { Wordmark } from "../components/Icon.jsx";

// KVKK Aydinlatma Metni ve Kullanim Kosullari.
// NOT: Genel bir taslaktir; satisa baslamadan once bir avukata/mali musavire okutulmasi onerilir.
const UPDATED = "9 Kasım 2026";

function contactLine() {
  if (BRAND.legalEmail) return <>e-posta: <b>{BRAND.legalEmail}</b></>;
  if (BRAND.contactWhatsApp) {
    return <>WhatsApp: <b>{BRAND.contactWhatsApp}</b>{BRAND.address && <> ya da yazılı olarak <b>{BRAND.address}</b></>}</>;
  }
  return <>randevu aldığın dükkanın telefonu ya da bu sitedeki iletişim kanalları</>;
}

function Kvkk() {
  return (
    <>
      <h1>KVKK Aydınlatma Metni</h1>
      <p className="tiny muted">Son güncelleme: {UPDATED}</p>
      <p>
        6698 sayılı Kişisel Verilerin Korunması Kanunu (“KVKK”) uyarınca, {BRAND.name} üzerinden işlenen kişisel verilerin
        hakkında seni bilgilendirmek isteriz.
      </p>

      <h3>1. Kimdir veri sorumlusu?</h3>
      <ul>
        <li>
          <b>Online randevu alan müşteriler için:</b> randevu aldığın <b>berber/kuaför dükkanı</b> veri sorumlusudur.
          {` ${BRAND.name}`}, dükkan adına verileri barındıran <b>veri işleyen</b> konumundadır.
        </li>
        <li><b>Dükkan sahipleri ve çalışanlar için:</b> {BRAND.legalName} veri sorumlusudur{BRAND.address ? ` (adres: ${BRAND.address})` : ""}.</li>
      </ul>

      <h3>2. Hangi verileri işliyoruz?</h3>
      <ul>
        <li><b>Müşteriler:</b> ad soyad, telefon numarası, randevu tarihi/saati, seçilen hizmet ve berber, varsa randevu notu, randevuya gelip gelmeme ve ödeme bilgisi (tutar ve yöntem; kart numarası tutulmaz).</li>
        <li><b>Dükkan sahipleri:</b> ad soyad, e-posta, telefon, dükkan bilgileri, şifrenin geri döndürülemez özeti (şifrenin kendisi saklanmaz).</li>
        <li>Güvenlik için teknik kayıtlar (IP adresi, istek zamanı).</li>
      </ul>

      <h3>3. Neden işliyoruz? (amaç ve hukuki sebep)</h3>
      <ul>
        <li>Randevunu oluşturmak, berbere iletmek, değişiklik/iptal için seninle iletişim kurmak: <i>sözleşmenin kurulması ve ifası</i> (KVKK m.5/2-c).</li>
        <li>Sahte ve kötüye kullanılan randevuları önlemek (örneğin sürekli gelmeyen numaralar): <i>meşru menfaat</i> (m.5/2-f).</li>
        <li>Gelir-gider ve yasal saklama yükümlülükleri: <i>hukuki yükümlülük</i> (m.5/2-ç).</li>
        <li>Kampanya ve “seni özledik” gibi tanıtım mesajları: <b>yalnızca açık rızan varsa</b> (m.5/1). Rıza vermesen de randevu alabilirsin ve rızanı istediğin zaman geri alabilirsin.</li>
      </ul>

      <h3>4. Kimlerle paylaşıyoruz?</h3>
      <p>
        Verilerin yalnızca randevu aldığın dükkanla paylaşılır; başka dükkanlar göremez. Hizmeti sunmak için kullandığımız
        barındırma ve veritabanı sağlayıcıları (yurt dışında sunucu bulunabilir) veri işleyen olarak hizmet verir.
        Yasal zorunluluk dışında üçüncü kişilere satılmaz veya aktarılmaz.
      </p>

      <h3>5. Ne kadar saklıyoruz?</h3>
      <p>Randevu ve kasa kayıtları, ilgili mevzuattaki saklama süreleri boyunca; dükkan hesabı kapatıldığında yasal süreler sonunda silinir ya da anonim hale getirilir.</p>

      <h3>6. Hakların (KVKK m.11)</h3>
      <p>
        Verilerinin işlenip işlenmediğini öğrenme, bilgi isteme, düzeltilmesini veya silinmesini isteme, aktarıldığı kişileri
        öğrenme, itiraz etme ve zararın giderilmesini talep etme haklarına sahipsin. Başvuru için: {contactLine()}.
      </p>
    </>
  );
}

function Terms() {
  return (
    <>
      <h1>Kullanım Koşulları</h1>
      <p className="tiny muted">Son güncelleme: {UPDATED}</p>
      <h3>1. Hizmet</h3>
      <p>{BRAND.name}, berber ve kuaförlere online randevu, müşteri, kasa ve çalışan yönetimi yazılımı sunar. Dükkan sahibi (“Kullanıcı”) hesabını oluşturarak bu koşulları kabul eder.</p>
      <h3>2. Deneme ve ücret</h3>
      <p>Yeni hesaplar {BRAND.trialDays} gün ücretsizdir; kredi kartı istenmez. Deneme sonunda devam etmek için seçilen paketin ücreti ödenir. Ödeme yapılmazsa online randevu alma durdurulur, veriler silinmez.</p>
      <h3>3. Kullanıcının sorumlulukları</h3>
      <ul>
        <li>Hesap bilgilerini gizli tutmak ve doğru bilgi vermek.</li>
        <li>Müşterilerine karşı veri sorumlusu olarak KVKK yükümlülüklerine uymak; müşteriye kampanya mesajını yalnızca açık rızası varsa göndermek (ticari ileti mevzuatı ve İYS kuralları dahil).</li>
        <li>Sistemi hukuka aykırı amaçla kullanmamak.</li>
      </ul>
      <h3>4. Hizmetin sürekliliği</h3>
      <p>Hizmetin kesintisiz olması için çaba gösterilir; bakım ve altyapı sağlayıcılarından kaynaklı kısa kesintiler olabilir. Doğrudan veya dolaylı kâr kaybından {BRAND.name} sorumlu tutulamaz.</p>
      <h3>5. Fesih</h3>
      <p>Kullanıcı aboneliğini dilediği an sonlandırabilir. Koşulları ihlal eden hesaplar askıya alınabilir.</p>
      <h3>6. Değişiklikler</h3>
      <p>Koşullar güncellenebilir; önemli değişiklikler panelden duyurulur.</p>
      <p>Ayrıca bkz. <Link className="link" to="/kvkk">KVKK Aydınlatma Metni</Link>.</p>
    </>
  );
}

export default function Legal() {
  const { pathname } = useLocation();
  return (
    <div className="legal">
      <header className="topbar"><Link className="brand" to="/"><Wordmark /></Link></header>
      <article className="card legal-body">{pathname.startsWith("/kosullar") ? <Terms /> : <Kvkk />}</article>
      <p className="tiny muted center">
        <Link className="link" to="/kvkk">KVKK</Link> • <Link className="link" to="/kosullar">Kullanım Koşulları</Link>
      </p>
    </div>
  );
}
