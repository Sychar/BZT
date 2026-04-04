import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type CompanySummary = {
  company: { id: string; name: string; code: string; internalCode: string | null; isActive: boolean };
};

export default function CompanyManagementPage() {
  const auth = useAuth();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalCodeLoading, setInternalCodeLoading] = useState(false);
  const [internalCodeError, setInternalCodeError] = useState<string | null>(null);

  const loadSummary = () => {
    if (!auth.token) return;
    apiFetch<CompanySummary>("/company/dashboard", {}, auth.token)
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  };

  useEffect(() => {
    loadSummary();
  }, [auth.token]);

  const generateInternalCode = async (regenerate: boolean) => {
    if (!auth.token) return;
    setInternalCodeLoading(true);
    setInternalCodeError(null);
    try {
      const endpoint = regenerate
        ? "/company/internal-code/regenerate"
        : "/company/internal-code/generate";
      const data = await apiFetch<{ internalCode: string }>(
        endpoint,
        { method: "POST" },
        auth.token
      );
      setSummary((prev) =>
        prev
          ? { ...prev, company: { ...prev.company, internalCode: data.internalCode } }
          : prev
      );
    } catch (err) {
      setInternalCodeError((err as Error).message);
    } finally {
      setInternalCodeLoading(false);
    }
  };

  return (
    <PageShell>
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && (
        <div className="settings-shell">
          <section className="dashboard-hero">
            <div>
              <p className="dashboard-eyebrow">Verwaltung</p>
              <h1>Firmenprofil & Basisdaten</h1>
              <p className="dashboard-hero-copy">
                Sicht auf Firmeninfos und Kontaktstruktur. Speichern folgt in der nächsten Ausbaustufe.
              </p>
            </div>
            <div className="dashboard-hero-actions">
              <Link href="/company/dashboard" className="dashboard-settings-btn">
                Zurück zum Dashboard
              </Link>
            </div>
          </section>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Firmendaten</h2>
                <p>Alle Felder sind in V1 als Struktur sichtbar.</p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-field">
                <label>Firmenname</label>
                <input className="dashboard-text-input" value={summary?.company.name ?? ""} readOnly />
              </div>
              <div className="settings-field">
                <label>Firmen-Code (extern)</label>
                <input className="dashboard-text-input" value={summary?.company.code ?? ""} readOnly />
              </div>
              <div className="settings-field">
                <label>Status</label>
                <input
                  className="dashboard-text-input"
                  value={summary ? (summary.company.isActive ? "Aktiv" : "Inaktiv") : ""}
                  readOnly
                />
              </div>
              <div className="settings-field">
                <label>Kontakt E-Mail</label>
                <input className="dashboard-text-input" placeholder="firma@beispiel.de" readOnly />
              </div>
              <div className="settings-field full-width">
                <label>Adresse</label>
                <input className="dashboard-text-input" placeholder="Hauptstraße 10, 10115 Berlin" readOnly />
              </div>
            </div>

            <div className="dashboard-inline-actions">
              <button type="button" className="dashboard-primary-btn" disabled>
                Speichern (kommt bald)
              </button>
              <Link href="/company/settings" className="dashboard-ghost-btn">
                Alte Einstellungsseite
              </Link>
            </div>
          </section>

          {/* Interner Firmencode */}
          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Interner Firmencode</h2>
                <p>Für den Mitarbeiter-Login und CSV-Import. Wird nicht öffentlich angezeigt.</p>
              </div>
            </div>

            {internalCodeError && <p className="text-sm text-brand-700">{internalCodeError}</p>}

            <div className="settings-grid">
              <div className="settings-field">
                <label>Aktueller interner Code</label>
                <input
                  className="dashboard-text-input"
                  value={summary?.company.internalCode ?? "Noch kein Code generiert"}
                  readOnly
                />
              </div>
            </div>

            <div className="dashboard-inline-actions">
              {!summary?.company.internalCode ? (
                <button
                  type="button"
                  className="dashboard-primary-btn"
                  onClick={() => generateInternalCode(false)}
                  disabled={internalCodeLoading}
                >
                  {internalCodeLoading ? "Generiere..." : "Code generieren"}
                </button>
              ) : (
                <button
                  type="button"
                  className="dashboard-ghost-btn"
                  onClick={() => generateInternalCode(true)}
                  disabled={internalCodeLoading}
                >
                  {internalCodeLoading ? "Generiere..." : "Code regenerieren"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </PageShell>
  );
}
