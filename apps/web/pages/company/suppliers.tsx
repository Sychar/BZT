import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type SupplierLink = {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  status: "PENDING" | "APPROVED";
  requestedAt: string;
  approvedAt?: string | null;
};

export default function CompanySuppliersPage() {
  const auth = useAuth();
  const [suppliers, setSuppliers] = useState<SupplierLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<SupplierLink[]>("/company/suppliers", {}, auth.token);
        setSuppliers(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [auth.token]);

  return (
    <PageShell>
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && (
        <div className="settings-shell">
          <section className="dashboard-hero">
            <div>
              <p className="dashboard-eyebrow">Lieferanten</p>
              <h1>Lieferanten-Verbindungen</h1>
              <p className="dashboard-hero-copy">
                Statusübersicht aller Lieferanten, die mit deiner Firma verknüpft sind.
              </p>
            </div>
          </section>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Alle Verbindungen</h2>
                <p>Freigabe erfolgt weiterhin nur durch den neutralen Plattform-Admin.</p>
              </div>
            </div>

            {loading ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : suppliers.length === 0 ? (
              <p className="dashboard-empty">Noch keine Lieferanten-Verbindungen vorhanden.</p>
            ) : (
              <div className="dashboard-list">
                {suppliers.map((supplier) => (
                  <article key={`${supplier.vendorId}-${supplier.requestedAt}`} className="dashboard-list-item">
                    <div className="dashboard-list-head">
                      <div>
                        <p className="dashboard-item-title">{supplier.vendorName}</p>
                        <p className="dashboard-item-subtitle">Typ: {supplier.vendorType}</p>
                        <p className="dashboard-item-subtitle">
                          Angefragt: {new Date(supplier.requestedAt).toLocaleString("de-DE")}
                          {supplier.approvedAt ? ` · Freigegeben: ${new Date(supplier.approvedAt).toLocaleString("de-DE")}` : ""}
                        </p>
                      </div>
                      <span className={`dashboard-status ${supplier.status === "APPROVED" ? "is-active" : "is-pending"}`}>
                        {supplier.status === "APPROVED" ? "APPROVED" : "PENDING"}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}
