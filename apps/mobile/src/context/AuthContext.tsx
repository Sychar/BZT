import React, { createContext, useContext, useMemo, useState } from "react";

type AuthState = {
  token: string | null;
  vendorId: string | null;
  role: "CUSTOMER" | "VENDOR" | null;
};

type AuthContextValue = AuthState & {
  setAuth: (token: string, vendorId?: string | null, role?: AuthState["role"]) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    token: null,
    vendorId: null,
    role: null
  });

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setAuth: (token, vendorId, role) => {
        setState({ token, vendorId: vendorId ?? null, role: role ?? "CUSTOMER" });
      },
      clearAuth: () => setState({ token: null, vendorId: null, role: null })
    }),
    [state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
