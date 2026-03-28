import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_URL } from "../../lib/api";

type CompanyGroup = {
  companyId: string | null;
  companyName: string;
  ordersCount: number;
  totalAmount: number;
  averageOrderValue: number;
};

type VendorOrdersResponse = {
  period: "day" | "week" | "month";
  periodLabel: string;
  stats: {
    totalOrders: number;
    totalAmount: number;
    averageOrderValue: number;
  };
  companyGroups: CompanyGroup[];
};

const monthISO = DateTime.now().toFormat("yyyy-MM");

export default function VendorInvoicesPage() {
  const auth = useAuth();
  const [monthValue, setMonthValue] = useState(monthISO);
  const [data, setData] = useState<VendorOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoadingCompanyId, setPdfLoadingCompanyId] = useState<string | null>(null);

  const queryDate = useMemo(() => `${monthValue}-01`, [monthValue]);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<VendorOrdersResponse>(
          `/orders/vendor?period=month&date=${queryDate}`,
          {},
          auth.token
        );
        setData(response);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token, queryDate]);

  const invoiceCompanies = useMemo(
    () => (data?.companyGroups ?? []).filter((group) => !!group.companyId),
    [data]
  );

  const exportCompanyPdf = async (companyId: string, companyName: string) => {
    if (!auth.token) return;

    setPdfLoadingCompanyId(companyId);
    setError(null);
    try {
      const response = await fetch(
        `${API_URL}/orders/vendor/invoices/export-pdf?date=${queryDate}&companyId=${companyId}`,
        {
          headers: { Authorization: `Bearer ${auth.token}` }
        }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF Erstellung fehlgeschlagen.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rechnung-${companyName}-${monthValue}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPdfLoadingCompanyId(null);
    }
  };

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Rechnung</p>
            <h1>Rechnung erstellen</h1>
            <p className="dashboard-hero-copy">
              Bäcker erstellt für jede Firma eine Monatsrechnung als professionelles PDF.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Monat wählen</h2>
              <p>Danach pro Firma PDF-Rechnung erzeugen.</p>
            </div>
            <div className="dashboard-panel-actions">
              <input
                type="month"
                value={monthValue}
                onChange={(event) => setMonthValue(event.target.value)}
                className="dashboard-date-input"
              />
            </div>
          </div>

          {error && <p className="text-sm text-brand-700">{error}</p>}
          {loading && <p className="dashboard-empty">Rechnungsdaten werden geladen...</p>}

          {!loading && data && (
            <>
              <div className="dashboard-stats-grid">
                <article className="dashboard-stat-card">
                  <p>Monat</p>
                  <strong>{data.periodLabel}</strong>
                </article>
                <article className="dashboard-stat-card">
                  <p>Bestellungen</p>
                  <strong>{data.stats.totalOrders}</strong>
                </article>
                <article className="dashboard-stat-card">
                  <p>Gesamtumsatz</p>
                  <strong>{data.stats.totalAmount.toFixed(2)} €</strong>
                </article>
              </div>

              {invoiceCompanies.length === 0 ? (
                <p className="dashboard-empty">Keine Firmen-Bestellungen für diesen Monat.</p>
              ) : (
                <div className="dashboard-list">
                  {invoiceCompanies.map((group) => (
                    <article key={group.companyId as string} className="dashboard-list-item">
                      <div className="dashboard-list-head">
                        <div>
                          <p className="dashboard-item-title">Firma {group.companyName}</p>
                          <p className="dashboard-item-subtitle">
                            {group.ordersCount} Bestellungen · Mittelwert {group.averageOrderValue.toFixed(2)} €
                          </p>
                        </div>
                        <div className="dashboard-list-meta">
                          <p>{group.totalAmount.toFixed(2)} €</p>
                          <span>Monatssumme</span>
                        </div>
                      </div>

                      <div className="dashboard-inline-actions">
                        <button
                          type="button"
                          className="dashboard-primary-btn"
                          onClick={() => exportCompanyPdf(group.companyId as string, group.companyName)}
                          disabled={pdfLoadingCompanyId === group.companyId}
                        >
                          {pdfLoadingCompanyId === group.companyId ? "PDF wird erstellt..." : "PDF Rechnung erstellen"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}

