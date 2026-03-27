import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_URL } from "../../lib/api";

type Employee = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

type CreatedEmployee = Employee & {
  companyCode: string;
};

type Invite = {
  id: string;
  code: string;
  createdAt: string;
  usedAt?: string | null;
  expiresAt?: string | null;
};

export default function CompanyEmployeesPage() {
  const auth = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [creatingEmployee, setCreatingEmployee] = useState(false);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [employeeForm, setEmployeeForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [passwordByEmployeeId, setPasswordByEmployeeId] = useState<Record<string, string>>({});

  const load = async () => {
    if (!auth.token) return;

    setLoading(true);
    setError(null);
    try {
      const [employeesData, invitesData] = await Promise.all([
        apiFetch<Employee[]>("/company/employees", {}, auth.token),
        apiFetch<Invite[]>("/company/invites", {}, auth.token)
      ]);
      setEmployees(employeesData);
      setInvites(invitesData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [auth.token]);

  const createInvite = async () => {
    if (!auth.token) return;

    setCreatingInvite(true);
    setError(null);
    try {
      const invite = await apiFetch<Invite>(
        "/company/invites",
        {
          method: "POST"
        },
        auth.token
      );
      setInvites((prev) => [invite, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const downloadCredentialsPdf = async (
    employeeId: string,
    password: string,
    employeeName: string
  ) => {
    if (!auth.token || !password.trim()) return;

    setPdfLoadingId(employeeId);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/company/employees/credentials-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ employeeId, password })
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF konnte nicht erstellt werden.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const fileName = employeeName
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-_]/g, "");
      anchor.href = url;
      anchor.download = `zugangsdaten-${fileName || "mitarbeiter"}.pdf`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const createEmployee = async () => {
    if (!auth.token) return;

    setCreatingEmployee(true);
    setError(null);
    try {
      const created = await apiFetch<CreatedEmployee>(
        "/company/employees",
        {
          method: "POST",
          body: JSON.stringify(employeeForm)
        },
        auth.token
      );

      setEmployees((prev) => [created, ...prev]);
      setPasswordByEmployeeId((prev) => ({
        ...prev,
        [created.id]: employeeForm.password
      }));

      const usedPassword = employeeForm.password;
      setEmployeeForm({ name: "", email: "", password: "" });

      await downloadCredentialsPdf(created.id, usedPassword, created.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingEmployee(false);
    }
  };

  return (
    <PageShell>
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && (
        <div className="settings-shell">
          <section className="dashboard-hero">
            <div>
              <p className="dashboard-eyebrow">Mitarbeiter</p>
              <h1>Mitarbeiter & Zugangsdaten</h1>
              <p className="dashboard-hero-copy">
                Mitarbeiter anlegen, Passwort vergeben und Zugangsdaten als PDF erzeugen.
              </p>
            </div>
          </section>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Neuen Mitarbeiter erstellen</h2>
                <p>E-Mail + Passwort + Firmen-Code als Zugangsdaten.</p>
              </div>
            </div>

            <div className="settings-grid">
              <div className="settings-field">
                <label>Name</label>
                <input
                  className="dashboard-text-input"
                  value={employeeForm.name}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="settings-field">
                <label>E-Mail</label>
                <input
                  type="email"
                  className="dashboard-text-input"
                  value={employeeForm.email}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                />
              </div>
              <div className="settings-field full-width">
                <label>Passwort</label>
                <input
                  type="password"
                  className="dashboard-text-input"
                  value={employeeForm.password}
                  onChange={(event) =>
                    setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="dashboard-inline-actions">
              <button
                type="button"
                onClick={createEmployee}
                className="dashboard-primary-btn"
                disabled={creatingEmployee}
              >
                {creatingEmployee ? "Speichert..." : "Mitarbeiter anlegen"}
              </button>
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Invite-Codes</h2>
                <p>Optionaler Registrierungsweg für neue Mitarbeiter.</p>
              </div>
              <button type="button" onClick={createInvite} className="dashboard-primary-btn" disabled={creatingInvite}>
                {creatingInvite ? "Erzeuge..." : "Neuen Code erstellen"}
              </button>
            </div>

            {loading ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : invites.length === 0 ? (
              <p className="dashboard-empty">Noch keine Invite-Codes vorhanden.</p>
            ) : (
              <ul className="dashboard-compact-list">
                {invites.map((invite) => (
                  <li key={invite.id}>
                    <div>
                      <p className="dashboard-item-title">{invite.code}</p>
                      <p className="dashboard-item-subtitle">
                        Erstellt: {new Date(invite.createdAt).toLocaleString("de-DE")}
                      </p>
                    </div>
                    <span className={`dashboard-status ${invite.usedAt ? "is-inactive" : "is-active"}`}>
                      {invite.usedAt ? "Verwendet" : "Offen"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Mitarbeiterliste</h2>
                <p>PDF-Zugangsdaten können je Mitarbeiter neu erzeugt werden.</p>
              </div>
            </div>

            {loading ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : employees.length === 0 ? (
              <p className="dashboard-empty">Noch keine Mitarbeiter registriert.</p>
            ) : (
              <div className="dashboard-list">
                {employees.map((employee) => (
                  <article key={employee.id} className="dashboard-list-item">
                    <div className="dashboard-list-head">
                      <div>
                        <p className="dashboard-item-title">{employee.name}</p>
                        <p className="dashboard-item-subtitle">{employee.email}</p>
                        <p className="dashboard-item-subtitle">
                          Registriert am {new Date(employee.createdAt).toLocaleString("de-DE")}
                        </p>
                      </div>
                    </div>

                    <div className="dashboard-connect-row">
                      <div className="dashboard-connect-field">
                        <label>Passwort für PDF</label>
                        <input
                          type="password"
                          className="dashboard-text-input"
                          value={passwordByEmployeeId[employee.id] ?? ""}
                          onChange={(event) =>
                            setPasswordByEmployeeId((prev) => ({
                              ...prev,
                              [employee.id]: event.target.value
                            }))
                          }
                          placeholder="Passwort eingeben"
                        />
                      </div>
                      <button
                        type="button"
                        className="dashboard-ghost-btn"
                        onClick={() =>
                          downloadCredentialsPdf(
                            employee.id,
                            passwordByEmployeeId[employee.id] ?? "",
                            employee.name
                          )
                        }
                        disabled={pdfLoadingId === employee.id || !(passwordByEmployeeId[employee.id] ?? "").trim()}
                      >
                        {pdfLoadingId === employee.id ? "Erzeuge PDF..." : "Zugangsdaten-PDF"}
                      </button>
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
