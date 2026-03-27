import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type CompanyLink = {
  id: string;
  name: string;
  code: string;
  status: "PENDING" | "APPROVED";
  requestedAt?: string;
  approvedAt?: string | null;
};

type QrMap = Record<string, string>;

export default function VendorCompaniesPage() {
  const auth = useAuth();
  const [companies, setCompanies] = useState<CompanyLink[]>([]);
  const [companyCode, setCompanyCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [qrCodes, setQrCodes] = useState<QrMap>({});

  const loadCompanies = async () => {
    if (!auth.token) return;
    try {
      const data = await apiFetch<CompanyLink[]>("/vendor/companies", {}, auth.token);
      setCompanies(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    loadCompanies();
  }, [auth.token]);

  useEffect(() => {
    let cancelled = false;
    if (companies.length === 0) return;

    const buildQrCodes = async () => {
      try {
        const { toDataURL } = await import("qrcode");
        const entries = await Promise.all(
          companies.map(async (company) => {
            const dataUrl = await toDataURL(company.code, { width: 96, margin: 1 });
            return [company.id, dataUrl] as const;
          })
        );
        if (!cancelled) {
          setQrCodes((prev) => {
            const next = { ...prev };
            entries.forEach(([id, url]) => {
              next[id] = url;
            });
            return next;
          });
        }
      } catch {
        // QR Rendering optional
      }
    };

    buildQrCodes();
    return () => {
      cancelled = true;
    };
  }, [companies]);

  const handleAddCompany = async () => {
    const normalizedCode = companyCode.trim().toUpperCase();
    if (!auth.token || !normalizedCode) return;
    setError(null);
    try {
      const company = await apiFetch<CompanyLink>(
        "/vendor/companies",
        {
          method: "POST",
          body: JSON.stringify({ companyCode: normalizedCode })
        },
        auth.token
      );

      setCompanies((prev) => {
        const index = prev.findIndex((item) => item.id === company.id);
        if (index === -1) return [...prev, company];
        const next = [...prev];
        next[index] = company;
        return next;
      });
      setCompanyCode("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleRemoveCompany = async (companyId: string) => {
    if (!auth.token) return;
    setError(null);
    try {
      await apiFetch(`/vendor/companies/${companyId}`, { method: "DELETE" }, auth.token);
      setCompanies((prev) => prev.filter((item) => item.id !== companyId));
      setQrCodes((prev) => {
        const next = { ...prev };
        delete next[companyId];
        return next;
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const statusText = (status: CompanyLink["status"]) =>
    status === "APPROVED" ? "Aktiv" : "Wartet auf Bestätigung";

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Firmen</p>
            <h1>Verbundene Firmen</h1>
            <p className="dashboard-hero-copy">
              Hier siehst und verwaltest du alle Firmen, die mit deinem Anbieter verbunden sind.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Neue Firma verbinden</h2>
              <p>Firmen-Code eingeben und Anfrage senden.</p>
            </div>
          </div>

          <div className="dashboard-connect-row">
            <div className="dashboard-connect-field">
              <label>Firmen-Code</label>
              <input
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value)}
                className="dashboard-text-input"
                placeholder="FIRMA-XY"
              />
            </div>
            <button type="button" onClick={handleAddCompany} className="dashboard-primary-btn">
              Anfrage senden
            </button>
          </div>

          {error && <p className="text-sm text-brand-700">{error}</p>}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Alle Firmen</h2>
              <p>Übersicht über alle Verbindungen und deren Status.</p>
            </div>
          </div>

          {companies.length === 0 ? (
            <p className="dashboard-empty">Noch keine Firmen verbunden.</p>
          ) : (
            <ul className="dashboard-company-list">
              {companies.map((company) => (
                <li key={company.id}>
                  <div className="dashboard-company-main">
                    <div className="dashboard-qr-box">
                      {qrCodes[company.id] ? (
                        <img src={qrCodes[company.id]} alt={`QR ${company.code}`} className="h-full w-full object-contain" />
                      ) : (
                        <div className="h-full w-full rounded bg-neutral" />
                      )}
                    </div>

                    <div>
                      <p className="dashboard-item-title">{company.name}</p>
                      <p className="dashboard-item-subtitle">{company.code}</p>
                      <span className={`dashboard-status ${company.status === "APPROVED" ? "is-active" : "is-pending"}`}>
                        {statusText(company.status)}
                      </span>
                    </div>
                  </div>

                  <button type="button" onClick={() => handleRemoveCompany(company.id)} className="dashboard-ghost-btn">
                    Entfernen
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
}
