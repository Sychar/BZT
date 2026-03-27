import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthState = {
  token: string | null;
  name: string | null;
  vendorId: string | null;
  role: "CUSTOMER" | "VENDOR" | "COMPANY" | null;
  customerType: "EMPLOYEE" | "PRIVATE" | null;
  companyId: string | null;
  vendorType: "BAECKER" | "METZGER" | "RESTAURANT" | null;
};

type AuthContextValue = AuthState & {
  setAuth: (token: string, vendorId?: string | null) => void;
  clearAuth: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const decodeRole = (token: string): AuthState["role"] => {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    return decoded.role ?? null;
  } catch {
    return null;
  }
};

const decodeCustomer = (
  token: string
): {
  name: AuthState["name"];
  customerType: AuthState["customerType"];
  companyId: AuthState["companyId"];
  vendorType: AuthState["vendorType"];
} => {
  try {
    const [, payload] = token.split(".");
    const decoded = JSON.parse(atob(payload));
    return {
      name: decoded.name ?? null,
      customerType: decoded.customerType ?? null,
      companyId: decoded.companyId ?? null,
      vendorType: decoded.vendorType ?? null
    };
  } catch {
    return { name: null, customerType: null, companyId: null, vendorType: null };
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    token: null,
    name: null,
    vendorId: null,
    role: null,
    customerType: null,
    companyId: null,
    vendorType: null
  });

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    const vendorId = localStorage.getItem("auth_vendorId");
    if (token) {
      const decoded = decodeCustomer(token);
      setState({
        token,
        name: decoded.name,
        vendorId,
        role: decodeRole(token),
        customerType: decoded.customerType,
        companyId: decoded.companyId,
        vendorType: decoded.vendorType
      });
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      setAuth: (token, vendorId) => {
        localStorage.setItem("auth_token", token);
        if (vendorId) {
          localStorage.setItem("auth_vendorId", vendorId);
        } else {
          localStorage.removeItem("auth_vendorId");
        }
        const decoded = decodeCustomer(token);
        setState({
          token,
          name: decoded.name,
          vendorId: vendorId ?? null,
          role: decodeRole(token),
          customerType: decoded.customerType,
          companyId: decoded.companyId,
          vendorType: decoded.vendorType
        });
      },
      clearAuth: () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_vendorId");
        setState({
          token: null,
          name: null,
          vendorId: null,
          role: null,
          customerType: null,
          companyId: null,
          vendorType: null
        });
      }
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
