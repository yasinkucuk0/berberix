import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing.jsx";
import Register from "./pages/Register.jsx";
import Login from "./pages/Login.jsx";
import Panel from "./pages/Panel.jsx";
import Admin from "./pages/Admin.jsx";
import ShopPage from "./pages/ShopPage.jsx";
import { useAuth } from "./lib/auth.jsx";

function RequireShop({ children }) {
  const { loading, user } = useAuth();
  if (loading) return <div className="center muted">Yükleniyor…</div>;
  if (!user) return <Navigate to="/giris" replace />;
  if (user.role === "PLATFORM_ADMIN") return <Navigate to="/yonetim" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/kayit" element={<Register />} />
      <Route path="/giris" element={<Login />} />
      <Route path="/panel/*" element={<RequireShop><Panel /></RequireShop>} />
      <Route path="/yonetim" element={<Admin />} />
      <Route path="/:slug" element={<ShopPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
