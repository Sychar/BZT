import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type AdminCompany = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  createdAt: string;
  admins: Array<{ id: string; name: string; email: string }>;
};

type AdminVendor = {
  id: string;
  name: string;
  type: string;
  address: string;
  createdAt: string;
};

type AdminVendorLink = {
  vendorId: string;
  vendorName: string;
  vendorType: string;
  companyId: string;
  companyName: string;
  companyCode: string;
  status: "PENDING" | "APPROVED";
  requestedAt: string;
  approvedAt?: string | null;
};

type AdminDashboardPayload = {
  companies: AdminCompany[];
  vendors: AdminVendor[];
  links: AdminVendorLink[];
};

type CreateCompanyForm = {
  companyName: string;
  companyCode: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

const initialCompanyForm: CreateCompanyForm = {
  companyName: "",
  companyCode: "",
  adminName: "",
  adminEmail: "",
  adminPassword: ""
};

export default function AdminDashboardPage() {
  const auth = useAuth();
  const [dashboard, setDashboard] = useState<AdminDashboardPayload | null>(null);
  const [requests, setRequests] = useState<AdminVendorLink[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [companyForm, setCompanyForm] = useState<CreateCompanyForm>(initialCompanyForm);
  const [selectedVendorId, setSelectedVendorId] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");

  const isNeutralAdmin = auth.role === "COMPANY" && !auth.companyId;

  const load = async () => {
    if (!auth.token || !isNeutralAdmin) return;

    setLoading(true);
    setError(null);
    try {
      const [dashboardData, requestData] = await Promise.all([
        apiFetch<AdminDashboardPayload>("/admin/dashboard", {}, auth.token),
        apiFetch<AdminVendorLink[]>("/admin/vendor-requests", {}, auth.token)
      ]);

      setDashboard(dashboardData);
      setRequests(requestData);

      if (!selectedCompanyId && dashboardData.companies[0]) {
        setSelectedCompanyId(dashboardData.companies[0].id);
      }
      if (!selectedVendorId && dashboardData.vendors[0]) {
        setSelectedVendorId(dashboardData.vendors[0].id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth.token, isNeutralAdmin]);

  const companyOptions = useMemo(() => dashboard?.companies ?? [], [dashboard]);
  const vendorOptions = useMemo(() => dashboard?.vendors ?? [], [dashboard]);
  const links = dashboard?.links ?? [];

  const createCompany = async () => {
    if (!auth.token) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(
        "/admin/companies",
        {
          method: "POST",
          body: JSON.stringify({
            companyName: companyForm.companyName,
            companyCode: companyForm.companyCode.trim() || undefined,
            adminName: companyForm.adminName,
            adminEmail: companyForm.adminEmail,
            adminPassword: companyForm.adminPassword
          })
        },
        auth.token
      );
      setCompanyForm(initialCompanyForm);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const regenerateCode = async (companyId: string) => {
    if (!auth.token) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/admin/companies/${companyId}/regenerate-code`, { method: "POST" }, auth.token);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const createLink = async () => {
    if (!auth.token || !selectedCompanyId || !selectedVendorId) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(
        "/admin/links",
        {
          method: "POST",
          body: JSON.stringify({
            companyId: selectedCompanyId,
            vendorId: selectedVendorId
          })
        },
        auth.token
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const removeLink = async (vendorId: string, companyId: string) => {
    if (!auth.token) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/admin/links/${vendorId}/${companyId}`, { method: "DELETE" }, auth.token);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const approve = async (vendorId: string, companyId: string) => {
    if (!auth.token) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/admin/vendor-requests/${vendorId}/${companyId}/approve`, { method: "POST" }, auth.token);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const reject = async (vendorId: string, companyId: string) => {
    if (!auth.token) return;

    setSubmitting(true);
    setError(null);
    try {
      await apiFetch(`/admin/vendor-requests/${vendorId}/${companyId}`, { method: "DELETE" }, auth.token);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell>
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && !isNeutralAdmin && (
        <p className="text-brand-700">Nur neutraler Admin darf diese Seite nutzen.</p>
      )}

      {auth.token && isNeutralAdmin && (
        <div className="settings-shell">
          <section className="dashboard-hero">
            <div>
              <p className="dashboard-eyebrow">Zentrale Verwaltung</p>
              <h1>Admin-Dashboard</h1>
              <p className="dashboard-hero-copy">
                Firmen, Lieferanten, Codes und Verbindungen zentral steuern.
              </p>
            </div>
            <div className="dashboard-hero-actions">
              <button type="button" onClick={load} className="dashboard-settings-btn" disabled={loading || submitting}>
                {loading ? "Lädt..." : "Aktualisieren"}
              </button>
            </div>
          </section>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Firma registrieren</h2>
                <p>Firma inkl. Firmen-Admin erstellen und Firmen-Code vergeben.</p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-field">
                <label>Firmenname</label>
                <input
                  className="dashboard-text-input"
                  value={companyForm.companyName}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, companyName: event.target.value }))
                  }
                />
              </div>
              <div className="settings-field">
                <label>Firmen-Code (optional)</label>
                <input
                  className="dashboard-text-input"
                  value={companyForm.companyCode}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, companyCode: event.target.value }))
                  }
                  placeholder="z.B. FIRMA-HH"
                />
              </div>
              <div className="settings-field">
                <label>Admin Name</label>
                <input
                  className="dashboard-text-input"
                  value={companyForm.adminName}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, adminName: event.target.value }))
                  }
                />
              </div>
              <div className="settings-field">
                <label>Admin E-Mail</label>
                <input
                  type="email"
                  className="dashboard-text-input"
                  value={companyForm.adminEmail}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, adminEmail: event.target.value }))
                  }
                />
              </div>
              <div className="settings-field full-width">
                <label>Admin Passwort</label>
                <input
                  type="password"
                  className="dashboard-text-input"
                  value={companyForm.adminPassword}
                  onChange={(event) =>
                    setCompanyForm((prev) => ({ ...prev, adminPassword: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="dashboard-inline-actions">
              <button
                type="button"
                onClick={createCompany}
                className="dashboard-primary-btn"
                disabled={submitting}
              >
                Firma erstellen
              </button>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Firma mit Lieferant verbinden</h2>
                <p>Admin setzt die Verbindung direkt auf freigegeben.</p>
              </div>
            </div>

            <div className="dashboard-connect-row">
              <div className="dashboard-connect-field">
                <label>Firma</label>
                <select
                  className="dashboard-text-input"
                  value={selectedCompanyId}
                  onChange={(event) => setSelectedCompanyId(event.target.value)}
                >
                  {companyOptions.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} ({company.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="dashboard-connect-field">
                <label>Lieferant</label>
                <select
                  className="dashboard-text-input"
                  value={selectedVendorId}
                  onChange={(event) => setSelectedVendorId(event.target.value)}
                >
                  {vendorOptions.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} ({vendor.type})
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={createLink}
                className="dashboard-primary-btn"
                disabled={submitting || !selectedCompanyId || !selectedVendorId}
              >
                Verbindung anlegen
              </button>
            </div>

            {links.length === 0 ? (
              <p className="dashboard-empty">Noch keine Verbindungen vorhanden.</p>
            ) : (
              <div className="dashboard-list">
                {links.map((link) => (
                  <article key={`${link.vendorId}-${link.companyId}`} className="dashboard-list-item">
                    <div className="dashboard-list-head">
                      <div>
                        <p className="dashboard-item-title">
                          {link.companyName} ({link.companyCode})
                        </p>
                        <p className="dashboard-item-subtitle">
                          {link.vendorName} ({link.vendorType})
                        </p>
                        <p className="dashboard-item-subtitle">
                          Angefragt: {new Date(link.requestedAt).toLocaleString("de-DE")}
                          {link.approvedAt
                            ? ` · Freigegeben: ${new Date(link.approvedAt).toLocaleString("de-DE")}`
                            : ""}
                        </p>
                      </div>
                      <div className="dashboard-inline-actions">
                        <span
                          className={`dashboard-status ${
                            link.status === "APPROVED" ? "is-active" : "is-pending"
                          }`}
                        >
                          {link.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLink(link.vendorId, link.companyId)}
                          className="dashboard-ghost-btn"
                          disabled={submitting}
                        >
                          Trennen
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Offene Lieferanten-Anfragen</h2>
                <p>Neutraler Admin bestätigt oder lehnt Anfragen ab.</p>
              </div>
            </div>

            {requests.length === 0 ? (
              <p className="dashboard-empty">Keine offenen Anfragen.</p>
            ) : (
              <div className="dashboard-list">
                {requests.map((request) => (
                  <article
                    key={`${request.vendorId}-${request.companyId}`}
                    className="dashboard-list-item"
                  >
                    <div className="dashboard-list-head">
                      <div>
                        <p className="dashboard-item-title">
                          {request.vendorName} ({request.vendorType})
                        </p>
                        <p className="dashboard-item-subtitle">
                          Firma: {request.companyName} ({request.companyCode})
                        </p>
                      </div>
                      <div className="dashboard-inline-actions">
                        <button
                          type="button"
                          className="dashboard-primary-btn"
                          onClick={() => approve(request.vendorId, request.companyId)}
                          disabled={submitting}
                        >
                          Bestätigen
                        </button>
                        <button
                          type="button"
                          className="dashboard-ghost-btn"
                          onClick={() => reject(request.vendorId, request.companyId)}
                          disabled={submitting}
                        >
                          Ablehnen
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Firmen</h2>
                <p>Alle registrierten Firmen mit Code und Admin.</p>
              </div>
            </div>

            {companyOptions.length === 0 ? (
              <p className="dashboard-empty">Keine Firmen vorhanden.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Firma</th>
                      <th>Code</th>
                      <th>Status</th>
                      <th>Admin</th>
                      <th>Aktion</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyOptions.map((company) => (
                      <tr key={company.id}>
                        <td>{company.name}</td>
                        <td>{company.code}</td>
                        <td>{company.isActive ? "Aktiv" : "Inaktiv"}</td>
                        <td>{company.admins[0]?.email ?? "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="dashboard-ghost-btn"
                            onClick={() => regenerateCode(company.id)}
                            disabled={submitting}
                          >
                            Neuer Code
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Lieferanten</h2>
                <p>Alle Bäckereien und Metzgereien auf der Plattform.</p>
              </div>
            </div>

            {vendorOptions.length === 0 ? (
              <p className="dashboard-empty">Keine Lieferanten vorhanden.</p>
            ) : (
              <div className="dashboard-table-wrap">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Typ</th>
                      <th>Adresse</th>
                      <th>Registriert</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendorOptions.map((vendor) => (
                      <tr key={vendor.id}>
                        <td>{vendor.name}</td>
                        <td>{vendor.type}</td>
                        <td>{vendor.address}</td>
                        <td>{new Date(vendor.createdAt).toLocaleDateString("de-DE")}</td>
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
