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
  averageOrderValue: number;
  orders: Order[];
};

type VendorOrdersResponse = {
  period: "day" | "week" | "month";
  periodLabel: string;
  batchDate: string;
  rangeStart?: string;
  rangeEnd?: string;
  stats: {
    totalOrders: number;
    totalAmount: number;
    averageOrderValue: number;
  };
  orders: Order[];
  companyGroups: CompanyGroup[];
};

const todayISO = DateTime.now().toISODate() ?? new Date().toISOString().slice(0, 10);
const monthISO = DateTime.now().toFormat("yyyy-MM");

export default function VendorOrdersPage() {
  const auth = useAuth();
  const [period, setPeriod] = useState<"day" | "week" | "month">("day");
  const [dateValue, setDateValue] = useState(todayISO);
  const [monthValue, setMonthValue] = useState(monthISO);
  const [data, setData] = useState<VendorOrdersResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const queryDate = useMemo(() => {
    if (period === "month") {
      return `${monthValue}-01`;
    }
    return dateValue;
  }, [period, dateValue, monthValue]);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const path = `/orders/vendor?period=${period}&date=${queryDate}`;
        const response = await apiFetch<VendorOrdersResponse>(path, {}, auth.token);
        setData(response);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token, period, queryDate]);

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Bestellungen</p>
            <h1>Bestellungen nach Firma</h1>
            <p className="dashboard-hero-copy">
              Firmenumsatz, Durchschnitt und Bestellungen nach Tag, Woche oder Monat.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Zeitraum</h2>
              <p>Auswertung nach Firma mit Umsatz und Mittelwert.</p>
            </div>

            <div className="dashboard-panel-actions">
              <button
                type="button"
                className={`dashboard-ghost-btn ${period === "day" ? "is-active" : ""}`}
                onClick={() => setPeriod("day")}
              >
                Tag
              </button>
              <button
                type="button"
                className={`dashboard-ghost-btn ${period === "week" ? "is-active" : ""}`}
                onClick={() => setPeriod("week")}
              >
                Woche
              </button>
              <button
                type="button"
                className={`dashboard-ghost-btn ${period === "month" ? "is-active" : ""}`}
                onClick={() => setPeriod("month")}
              >
                Monat
              </button>

              {period === "month" ? (
                <input
                  type="month"
                  value={monthValue}
                  onChange={(event) => setMonthValue(event.target.value)}
                  className="dashboard-date-input"
                />
              ) : (
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
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
                <span>Zeitraum: {data.periodLabel}</span>
                <span>Bestellungen: {data.stats.totalOrders}</span>
                <span>Umsatz: {data.stats.totalAmount.toFixed(2)} €</span>
                <span>Mittelwert: {data.stats.averageOrderValue.toFixed(2)} €</span>
              </div>

              {data.companyGroups.length === 0 ? (
                <p className="dashboard-empty">Keine Bestellungen gefunden.</p>
              ) : (
                <div className="dashboard-list">
                  {data.companyGroups.map((group) => (
                    <article key={group.companyId ?? "no-company"} className="dashboard-list-item">
                      <div className="dashboard-list-head">
                        <div>
                          <p className="dashboard-item-title">
                            Firma {group.companyName} hat {group.ordersCount} Bestellungen.
                          </p>
                          <p className="dashboard-item-subtitle">
                            Mittelwert: {group.averageOrderValue.toFixed(2)} € pro Bestellung
                          </p>
                        </div>
                        <div className="dashboard-list-meta">
                          <p>{group.totalAmount.toFixed(2)} €</p>
                          <span>Umsatz</span>
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
                              {order.user?.name ?? "Mitarbeiter"} · {DateTime.fromISO(order.createdAt).toFormat("dd.MM.yyyy HH:mm")} · Abholung {order.pickupWindow} · {orderTotal.toFixed(2)} € · {order.status}
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

