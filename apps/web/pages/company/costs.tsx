import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_URL } from "../../lib/api";

type VendorMonthlySummary = {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  ordersCount: number;
  positionsCount: number;
  totalAmount: number;
};

type CompanyInvoicesResponse = {
  month: string;
  rangeStart: string;
  rangeEnd: string;
  ordersCount: number;
  positionsCount: number;
  totalAmount: number;
  vendors: VendorMonthlySummary[];
};

type ReceivedInvoice = {
  id: string;
  vendorId: string;
  vendorName: string;
  companyName: string;
  month: string;
  invoiceNo: string;
  sentAt: string;
  totalAmount: number;
  ordersCount: number;
  positionsCount: number;
};

const currentMonth = new Date().toISOString().slice(0, 7);

export default function CompanyCostsPage() {
  const auth = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState<CompanyInvoicesResponse | null>(null);
  const [receivedInvoices, setReceivedInvoices] = useState<ReceivedInvoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [summary, received] = await Promise.all([
          apiFetch<CompanyInvoicesResponse>(`/company/invoices?month=${month}`, {}, auth.token),
          apiFetch<ReceivedInvoice[]>(`/company/invoices/received?month=${month}`, {}, auth.token)
        ]);
        setData(summary);
        setReceivedInvoices(received);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token, month]);

  const handleExport = async () => {
    if (!auth.token) return;

    setExporting(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/company/invoices/export?month=${month}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "Export fehlgeschlagen.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `company-invoices-${month}.csv`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const downloadInvoice = async (invoice: ReceivedInvoice) => {
    if (!auth.token) return;

    setDownloadingInvoiceId(invoice.id);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/company/invoices/received/${invoice.id}/download`, {
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
      anchor.download = `rechnung-${invoice.vendorName}-${invoice.month}.pdf`;
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
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && (
        <div className="settings-shell">
          <section className="dashboard-hero">
            <div>
              <p className="dashboard-eyebrow">Kosten/Rechnungen</p>
              <h1>Monatsübersicht</h1>
              <p className="dashboard-hero-copy">
                Summen und Lieferanten-Auswertung auf Monatsbasis inkl. CSV-Export und Rechnungsarchiv.
              </p>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Monat wählen</h2>
                <p>Zeigt alle Bestellungen und empfangenen Rechnungen im gewählten Monat.</p>
              </div>
              <div className="dashboard-panel-actions">
                <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="dashboard-date-input" />
                <button type="button" onClick={handleExport} className="dashboard-primary-btn" disabled={exporting}>
                  {exporting ? "Export läuft..." : "CSV Export"}
                </button>
              </div>
            </div>

            {error && <p className="text-sm text-brand-700">{error}</p>}
            {loading && <p className="dashboard-empty">Daten werden geladen...</p>}

            {!loading && data && (
              <>
                <div className="dashboard-stats-grid">
                  <article className="dashboard-stat-card">
                    <p>Bestellungen</p>
                    <strong>{data.ordersCount}</strong>
                  </article>
                  <article className="dashboard-stat-card">
                    <p>Positionen</p>
                    <strong>{data.positionsCount}</strong>
                  </article>
                  <article className="dashboard-stat-card">
                    <p>Gesamtbetrag</p>
                    <strong>{data.totalAmount.toFixed(2)} EUR</strong>
                  </article>
                </div>

                {data.vendors.length === 0 ? (
                  <p className="dashboard-empty">Keine Rechnungsdaten für diesen Monat.</p>
                ) : (
                  <div className="dashboard-table-wrap">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Lieferant</th>
                          <th>Typ</th>
                          <th>Bestellungen</th>
                          <th>Positionen</th>
                          <th>Summe</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.vendors.map((vendor) => (
                          <tr key={vendor.vendorId}>
                            <td>{vendor.vendorName}</td>
                            <td>{vendor.vendorType}</td>
                            <td>{vendor.ordersCount}</td>
                            <td>{vendor.positionsCount}</td>
                            <td>{vendor.totalAmount.toFixed(2)} EUR</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Empfangene Rechnungen</h2>
                <p>Rechnungsarchiv mit PDF-Download für den ausgewählten Monat.</p>
              </div>
            </div>

            {loading ? (
              <p className="dashboard-empty">Rechnungen werden geladen...</p>
            ) : receivedInvoices.length === 0 ? (
              <p className="dashboard-empty">Keine empfangenen Rechnungen für diesen Monat.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Monat</th>
                      <th>Lieferant</th>
                      <th>Rechnungsnr.</th>
                      <th>Gesendet am</th>
                      <th>Summe</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receivedInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.month}</td>
                        <td>{invoice.vendorName}</td>
                        <td>{invoice.invoiceNo}</td>
                        <td>{new Date(invoice.sentAt).toLocaleString("de-DE")}</td>
                        <td>{invoice.totalAmount.toFixed(2)} EUR</td>
                        <td>
                          <button
                            type="button"
                            className="dashboard-ghost-btn"
                            onClick={() => downloadInvoice(invoice)}
                            disabled={downloadingInvoiceId === invoice.id}
                          >
                            {downloadingInvoiceId === invoice.id ? "Download..." : "PDF"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
