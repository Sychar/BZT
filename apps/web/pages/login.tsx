import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type LoginMode = "COMPANY" | "VENDOR";

export default function LoginPage() {
  const [mode, setMode] = useState<LoginMode | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (!router.isReady) return;
    const queryMode = Array.isArray(router.query.mode)
      ? router.query.mode[0]
      : router.query.mode;

    if (queryMode === "vendor") {
      setMode("VENDOR");
    }

    if (queryMode === "company") {
      setMode("COMPANY");
    }
  }, [router.isReady, router.query.mode]);

  const title = useMemo(() => {
    if (mode === "COMPANY") return "Firma Login";
    if (mode === "VENDOR") return "Lieferant Login";
    return "";
  }, [mode]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mode) return;

    setError(null);
    setLoading(true);

    try {
      if (mode === "COMPANY") {
        const data = await apiFetch<{ token: string }>("/auth/company/login", {
          method: "POST",
          body: JSON.stringify({ email, password, companyCode })
        });
        auth.setAuth(data.token, null);
        router.push("/company/dashboard");
        return;
      }

      const data = await apiFetch<{ token: string; vendorId?: string | null }>(
        "/auth/login",
        {
          method: "POST",
          body: JSON.stringify({ email, password })
        }
      );
      auth.setAuth(data.token, data.vendorId ?? null);
      router.push("/vendor/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-screen">
      <main className="login-main">
        <section className="login-card" aria-label="Login Auswahl und Formular">
          <img
            src="/logo-bzt.svg"
            alt="BZT Logo"
            className="login-logo"
          />

          <h1 className="login-title">Login</h1>
          <p className="login-subtitle">Wähle deinen Zugang</p>

          <div className="login-mode-row" role="group" aria-label="Bereichsauswahl">
            <button
              type="button"
              className={`login-mode-btn ${mode === "COMPANY" ? "is-active" : ""}`}
              onClick={() => {
                setMode("COMPANY");
                setError(null);
              }}
            >
              Firma Login
            </button>

            <button
              type="button"
              className={`login-mode-btn ${mode === "VENDOR" ? "is-active" : ""}`}
              onClick={() => {
                setMode("VENDOR");
                setError(null);
              }}
            >
              Lieferant Login
            </button>
          </div>

          {mode && (
            <form onSubmit={handleSubmit} className="login-form login-form-enter">
              <h2 className="login-panel-title">{title}</h2>

              <label className="login-label">
                E-Mail
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="login-input"
                />
              </label>

              <label className="login-label">
                Passwort
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="login-input"
                />
              </label>

              {mode === "COMPANY" && (
                <label className="login-label">
                  Firmen-Code
                  <input
                    type="text"
                    required
                    value={companyCode}
                    onChange={(event) => setCompanyCode(event.target.value)}
                    className="login-input"
                  />
                </label>
              )}

              {error && <p className="login-error">{error}</p>}

              <button type="submit" disabled={loading} className="login-submit-btn">
                {loading ? "Bitte warten..." : "Einloggen"}
              </button>

              <a href="mailto:kontakt@biszumtisch.de" className="login-forgot-link">
                Passwort vergessen?
              </a>
            </form>
          )}
        </section>
      </main>

      <footer className="login-footer">
        BZT · Brotzeit & Mittag digital
      </footer>
    </div>
  );
}
