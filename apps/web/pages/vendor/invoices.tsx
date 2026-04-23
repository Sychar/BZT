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

type SentInvoice = {
  id: string;
  companyId: string;
  companyName: string;
  invoiceNo: string;
  month: string;
  sentAt: string;
  totalAmount: number;
  ordersCount: number;
  positionsCount: number;
};

const monthISO = DateTime.now().toFormat("yyyy-MM");

export default function VendorInvoicesPage() {
  const auth = useAuth();
  const [monthValue, setMonthValue] = useState(monthISO);
  const [data, setData] = useState<VendorOrdersResponse | null>(null);
  const [sentByCompany, setSentByCompany] = useState<Record<string, SentInvoice>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendingCompanyId, setSendingCompanyId] = useState<string | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  const queryDate = useMemo(() => `${monthValue}-01`, [monthValue]);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersData, sentData] = await Promise.all([
          apiFetch<VendorOrdersResponse>(`/orders/vendor?period=month&date=${queryDate}`, {}, auth.token),
          apiFetch<SentInvoice[]>(`/orders/vendor/invoices/sent?month=${monthValue}`, {}, auth.token)
        ]);

        setData(ordersData);
        const nextMap: Record<string, SentInvoice> = {};
        sentData.forEach((invoice) => {
          nextMap[invoice.companyId] = invoice;
        });
        setSentByCompany(nextMap);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token, queryDate, monthValue]);

  const invoiceCompanies = useMemo(
    () => (data?.companyGroups ?? []).filter((group) => !!group.companyId),
    [data]
  );

  const sendInvoice = async (companyId: string) => {
    if (!auth.token) return;

    setSendingCompanyId(companyId);
    setError(null);
    try {
      const created = await apiFetch<SentInvoice>(
        "/orders/vendor/invoices/send",
        {
          method: "POST",
          body: JSON.stringify({ month: monthValue, companyId })
        },
        auth.token
      );

      setSentByCompany((prev) => ({
        ...prev,
        [companyId]: created
      }));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSendingCompanyId(null);
    }
  };

  const downloadInvoice = async (invoice: SentInvoice) => {
    if (!auth.token) return;

    setDownloadingInvoiceId(invoice.id);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/orders/vendor/invoices/${invoice.id}/download`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Download fehlgeschlagen.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rechnung-${invoice.companyName}-${monthValue}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Rechnung</p>
            <h1>Firmenrechnung senden</h1>
            <p className="dashboard-hero-copy">
              Erzeuge pro Firma eine Monatsrechnung und sende sie direkt ins Firmenportal.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Monat wählen</h2>
              <p>Danach pro Firma Rechnung senden oder bereits gesendete Rechnung herunterladen.</p>
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
                  <strong>{data.stats.totalAmount.toFixed(2)} EUR</strong>
                </article>
              </div>

              {invoiceCompanies.length === 0 ? (
                <p className="dashboard-empty">Keine Firmen-Bestellungen für diesen Monat.</p>
              ) : (
                <div className="dashboard-list">
                  {invoiceCompanies.map((group) => {
                    const sentInvoice = group.companyId ? sentByCompany[group.companyId] : undefined;
                    return (
                      <article key={group.companyId as string} className="dashboard-list-item">
                        <div className="dashboard-list-head">
                          <div>
                            <p className="dashboard-item-title">Firma {group.companyName}</p>
                            <p className="dashboard-item-subtitle">
                              {group.ordersCount} Bestellungen · Mittelwert {group.averageOrderValue.toFixed(2)} EUR
                            </p>
                            {sentInvoice && (
                              <p className="dashboard-item-subtitle">
                                {sentInvoice.invoiceNo} · gesendet am {new Date(sentInvoice.sentAt).toLocaleString("de-DE")}
                              </p>
                            )}
                          </div>
                          <div className="dashboard-list-meta">
                            <p>{group.totalAmount.toFixed(2)} EUR</p>
                            <span>Monatssumme</span>
                          </div>
                        </div>

                        <div className="dashboard-inline-actions">
                          {sentInvoice ? (
                            <>
                              <span className="dashboard-status is-active">Gesendet</span>
                              <button
                                type="button"
                                className="dashboard-primary-btn"
                                onClick={() => downloadInvoice(sentInvoice)}
                                disabled={downloadingInvoiceId === sentInvoice.id}
                              >
                                {downloadingInvoiceId === sentInvoice.id ? "Download läuft..." : "PDF herunterladen"}
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="dashboard-primary-btn"
                              onClick={() => sendInvoice(group.companyId as string)}
                              disabled={sendingCompanyId === group.companyId}
                            >
                              {sendingCompanyId === group.companyId ? "Wird gesendet..." : "Rechnung senden"}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
