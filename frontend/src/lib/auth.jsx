import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: Boolean(getToken()), user: null, shop: null });

  const refresh = useCallback(async () => {
    if (!getToken()) return setState({ loading: false, user: null, shop: null });
    try {
      const data = await api("/auth/me");
      setState({ loading: false, user: data.user, shop: data.shop });
    } catch {
      setState({ loading: false, user: null, shop: null });
    }
  }, []);

  useEffect(() => {
    refresh();
    const onLogout = () => setState({ loading: false, user: null, shop: null });
    window.addEventListener("berberim:logout", onLogout);
    return () => window.removeEventListener("berberim:logout", onLogout);
  }, [refresh]);

  const signIn = (data) => {
    setToken(data.token);
    setState({ loading: false, user: data.user, shop: data.shop || null });
  };
  const signOut = () => {
    setToken(null);
    setState({ loading: false, user: null, shop: null });
  };
  const setShop = (shop) => setState((s) => ({ ...s, shop }));

  return (
    <AuthContext.Provider value={{ ...state, signIn, signOut, setShop, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
