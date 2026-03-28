import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { PageShell } from "../components/PageShell";
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
    const queryMode = router.query.mode;
    if (queryMode === "vendor") {
      setMode("VENDOR");
    }
    if (queryMode === "company") {
      setMode("COMPANY");
    }
  }, [router.isReady, router.query.mode]);

  const title = useMemo(
    () =>
      mode === "COMPANY"
        ? "Firma Login"
        : mode === "VENDOR"
          ? "Lieferant Login"
          : "",
    [mode]
  );

  const submit = async (event: React.FormEvent) => {
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
      } else {
        const data = await apiFetch<{ token: string; vendorId?: string | null }>("/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password })
        });
        auth.setAuth(data.token, data.vendorId ?? null);
        router.push("/vendor/dashboard");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Login" hideHeader>
      <div className="max-w-2xl space-y-6">
        <div className="card p-5">
          <p className="text-sm text-ink/70 mb-3">Bitte Bereich auswählen</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={`dashboard-primary-btn ${mode === "COMPANY" ? "is-active" : ""}`}
              onClick={() => {
                setMode("COMPANY");
                setError(null);
              }}
            >
              Firma - Login
            </button>
            <button
              type="button"
              className={`dashboard-ghost-btn ${mode === "VENDOR" ? "is-active" : ""}`}
              onClick={() => {
                setMode("VENDOR");
                setError(null);
              }}
            >
              Lieferant Login
            </button>
          </div>
        </div>

        {mode && (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <h2 className="text-2xl font-display text-ink">{title}</h2>

            <div>
              <label className="text-sm text-ink/70">E-Mail</label>
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-ink/70">Passwort</label>
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
              />
            </div>

            {mode === "COMPANY" && (
              <div>
                <label className="text-sm text-ink/70">Firmen-Code</label>
                <input
                  required
                  value={companyCode}
                  onChange={(event) => setCompanyCode(event.target.value)}
                  className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
                />
              </div>
            )}

            {error && <p className="text-sm text-brand-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-brand-500 px-6 py-3 text-paper font-semibold"
            >
              {loading ? "Bitte warten..." : "Einloggen"}
            </button>

            <p className="text-sm text-ink/60">
              Admin?{" "}
              <Link href="/login/admin" className="hover:text-brand-600">
                Hier einloggen
              </Link>
            </p>
          </form>
        )}
      </div>
    </PageShell>
  );
}
