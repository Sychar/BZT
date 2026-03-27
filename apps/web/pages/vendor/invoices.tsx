import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_URL } from "../../lib/api";

type OrderItem = {
  id: string;
  qty: number;
  unitPrice: string | number;
  product: { name: string };
};

type Order = {
  id: string;
  pickupWindow: string;
  status: string;
  createdAt: string;
  user: {
    name: string;
    company?: { name: string } | null;
  };
  items: OrderItem[];
};

type VendorOrdersResponse = {
  batchDate: string;
  orders: Order[];
};

const todayISO = DateTime.now().toISODate() ?? new Date().toISOString().slice(0, 10);

export default function VendorInvoicesPage() {
  const auth = useAuth();
  const [date, setDate] = useState(todayISO);
  const [data, setData] = useState<VendorOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch<VendorOrdersResponse>(`/orders/vendor?date=${date}`, {}, auth.token);
        setData(response);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token, date]);

  const invoiceRows = useMemo(() => {
    if (!data) return [];

    return data.orders.map((order) => {
      const orderTotal = order.items.reduce(
        (sum, item) => sum + item.qty * Number(item.unitPrice ?? 0),
        0
      );
      return {
        id: order.id,
        company: order.user?.company?.name ?? "Ohne Firma",
        customer: order.user?.name ?? "Mitarbeiter",
        status: order.status,
        pickupWindow: order.pickupWindow,
        createdAt: order.createdAt,
        positions: order.items.reduce((sum, item) => sum + item.qty, 0),
        total: orderTotal
      };
    });
  }, [data]);

  const summary = useMemo(() => {
    const totalAmount = invoiceRows.reduce((sum, row) => sum + row.total, 0);
    const totalPositions = invoiceRows.reduce((sum, row) => sum + row.positions, 0);
    return {
      invoices: invoiceRows.length,
      positions: totalPositions,
      totalAmount
    };
  }, [invoiceRows]);

  const exportCsv = () => {
    if (invoiceRows.length === 0) return;

    const header = [
      "Datum",
      "Bestell-ID",
      "Firma",
      "Mitarbeiter",
      "Status",
      "Abholfenster",
      "Positionen",
      "Gesamt EUR"
    ];
    const lines = invoiceRows.map((row) => [
      new Date(row.createdAt).toLocaleDateString("de-DE"),
      row.id,
      row.company,
      row.customer,
      row.status,
      row.pickupWindow,
      String(row.positions),
      row.total.toFixed(2)
    ]);

    const csv = [header, ...lines]
      .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rechnungen-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = async () => {
    if (!auth.token) return;

    setPdfLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/orders/vendor/invoices/export-pdf?date=${date}`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF Export fehlgeschlagen.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rechnungen-${date}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Rechnungen</p>
            <h1>Rechnungsübersicht</h1>
            <p className="dashboard-hero-copy">
              Tagesübersicht mit Summen und Export als CSV oder PDF.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Filter</h2>
              <p>Datum wählen und Rechnungsdaten exportieren.</p>
            </div>
            <div className="dashboard-panel-actions">
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="dashboard-date-input" />
              <button type="button" onClick={exportCsv} className="dashboard-primary-btn" disabled={invoiceRows.length === 0}>
                CSV Export
              </button>
              <button type="button" onClick={exportPdf} className="dashboard-ghost-btn" disabled={pdfLoading}>
                {pdfLoading ? "PDF läuft..." : "PDF Export"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-brand-700">{error}</p>}
          {loading && <p className="dashboard-empty">Rechnungen werden geladen...</p>}

          {!loading && (
            <>
              <div className="dashboard-stats-grid">
                <article className="dashboard-stat-card">
                  <p>Anzahl Rechnungen</p>
                  <strong>{summary.invoices}</strong>
                </article>
                <article className="dashboard-stat-card">
                  <p>Positionen</p>
                  <strong>{summary.positions}</strong>
                </article>
                <article className="dashboard-stat-card">
                  <p>Gesamtbetrag</p>
                  <strong>{summary.totalAmount.toFixed(2)} €</strong>
                </article>
              </div>

              {invoiceRows.length === 0 ? (
                <p className="dashboard-empty">Keine Rechnungsdaten für dieses Datum.</p>
              ) : (
                <div className="dashboard-list">
                  {invoiceRows.map((row) => (
                    <article key={row.id} className="dashboard-list-item">
                      <div className="dashboard-list-head">
                        <div>
                          <p className="dashboard-item-title">{row.company}</p>
                          <p className="dashboard-item-subtitle">{row.customer}</p>
                          <p className="dashboard-item-subtitle">
                            {new Date(row.createdAt).toLocaleString("de-DE")} · Abholung: {row.pickupWindow}
                          </p>
                        </div>
                        <div className="dashboard-list-meta">
                          <p>{row.total.toFixed(2)} €</p>
                          <span>{row.status}</span>
                        </div>
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
