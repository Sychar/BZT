import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

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
    companyId?: string | null;
    company?: { name: string } | null;
  };
  items: OrderItem[];
};

type CompanyGroup = {
  companyId: string | null;
  companyName: string;
  ordersCount: number;
  totalAmount: number;
  orders: Order[];
};

type VendorOrdersResponse = {
  batchDate: string;
  rangeStart?: string;
  rangeEnd?: string;
  orders: Order[];
  companyGroups?: CompanyGroup[];
};

const todayISO = DateTime.now().toISODate() ?? new Date().toISOString().slice(0, 10);

export default function VendorOrdersPage() {
  const auth = useAuth();
  const [mode, setMode] = useState<"AKTUELL" | "HISTORIE">("AKTUELL");
  const [historyDate, setHistoryDate] = useState(todayISO);
  const [data, setData] = useState<VendorOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const path = mode === "AKTUELL" ? "/orders/vendor" : `/orders/vendor?date=${historyDate}`;
        const response = await apiFetch<VendorOrdersResponse>(path, {}, auth.token);
        setData(response);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token, mode, historyDate]);

  const totals = useMemo(() => {
    if (!data) return { orders: 0, amount: 0 };

    if (data.companyGroups && data.companyGroups.length > 0) {
      const amount = data.companyGroups.reduce((sum, group) => sum + group.totalAmount, 0);
      const orders = data.companyGroups.reduce((sum, group) => sum + group.ordersCount, 0);
      return { orders, amount };
    }

    const amount = data.orders.reduce((sum, order) => {
      const orderTotal = order.items.reduce(
        (inner, item) => inner + item.qty * Number(item.unitPrice ?? 0),
        0
      );
      return sum + orderTotal;
    }, 0);
    return { orders: data.orders.length, amount };
  }, [data]);

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Bestellungen</p>
            <h1>Bestellungen nach Firma</h1>
            <p className="dashboard-hero-copy">
              Aktuelle Bestellungen und Historie, sauber nach Firmen gruppiert.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Ansicht</h2>
              <p>Aktuell zeigt den laufenden Batch. Historie zeigt ein gewähltes Datum.</p>
            </div>

            <div className="dashboard-panel-actions">
              <button
                type="button"
                className={`dashboard-ghost-btn ${mode === "AKTUELL" ? "is-active" : ""}`}
                onClick={() => setMode("AKTUELL")}
              >
                Aktuell
              </button>
              <button
                type="button"
                className={`dashboard-ghost-btn ${mode === "HISTORIE" ? "is-active" : ""}`}
                onClick={() => setMode("HISTORIE")}
              >
                Historie
              </button>
              {mode === "HISTORIE" && (
                <input
                  type="date"
                  value={historyDate}
                  onChange={(event) => setHistoryDate(event.target.value)}
                  className="dashboard-date-input"
                />
              )}
            </div>
          </div>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          {loading && <p className="dashboard-empty">Bestellungen werden geladen...</p>}

          {!loading && data && (
            <>
              <div className="dashboard-inline-stats">
                <span>Batch-Datum: {data.batchDate}</span>
                <span>Bestellungen: {totals.orders}</span>
                <span>Gesamt: {totals.amount.toFixed(2)} €</span>
              </div>

              {(!data.companyGroups || data.companyGroups.length === 0) && data.orders.length === 0 ? (
                <p className="dashboard-empty">Keine Bestellungen gefunden.</p>
              ) : (
                <div className="dashboard-list">
                  {(data.companyGroups && data.companyGroups.length > 0
                    ? data.companyGroups
                    : [
                        {
                          companyId: null,
                          companyName: "Ohne Firma",
                          ordersCount: data.orders.length,
                          totalAmount: totals.amount,
                          orders: data.orders
                        }
                      ]
                  ).map((group) => (
                    <article key={group.companyId ?? "no-company"} className="dashboard-list-item">
                      <div className="dashboard-list-head">
                        <div>
                          <p className="dashboard-item-title">{group.companyName}</p>
                          <p className="dashboard-item-subtitle">
                            {group.ordersCount} Bestellungen
                          </p>
                        </div>
                        <div className="dashboard-list-meta">
                          <p>{group.totalAmount.toFixed(2)} €</p>
                          <span>Gruppensumme</span>
                        </div>
                      </div>

                      <ul className="dashboard-item-lines">
                        {group.orders.map((order) => {
                          const orderTotal = order.items.reduce(
                            (sum, item) => sum + item.qty * Number(item.unitPrice ?? 0),
                            0
                          );

                          return (
                            <li key={order.id}>
                              {order.user?.name ?? "Mitarbeiter"} · Abholung {order.pickupWindow} · {orderTotal.toFixed(2)} € · {order.status}
                            </li>
                          );
                        })}
                      </ul>
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
