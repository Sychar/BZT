import { useEffect, useRef, useState } from "react";
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

type EditForm = {
  name: string;
  email: string;
  password: string;
};

type ImportedEmployee = {
  name: string;
  username: string;
  password: string;
  internalCode: string | null;
};

type ImportResult = {
  created: ImportedEmployee[];
  skipped: string[];
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
  const [bulkPdfLoading, setBulkPdfLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", email: "", password: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({ name: "", email: "", password: "" });
  const [passwordByEmployeeId, setPasswordByEmployeeId] = useState<Record<string, string>>({});

  // Import-State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPdfLoading, setImportPdfLoading] = useState(false);

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
      const invite = await apiFetch<Invite>("/company/invites", { method: "POST" }, auth.token);
      setInvites((prev) => [invite, ...prev]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingInvite(false);
    }
  };

  const downloadCredentialsPdf = async (employeeId: string, password: string, employeeName: string) => {
    if (!auth.token || !password.trim()) return;
    setPdfLoadingId(employeeId);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/company/employees/credentials-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, password })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const fileName = employeeName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
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

  const downloadAllCredentialsPdf = async () => {
    if (!auth.token) return;
    if (!window.confirm("Achtung: Für alle Mitarbeiter werden neue Passwörter generiert und im PDF gespeichert. Fortfahren?")) return;
    setBulkPdfLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/company/employees/credentials-pdf-bulk`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "Bulk-PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "alle-zugangsdaten.pdf";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBulkPdfLoading(false);
    }
  };

  const createEmployee = async () => {
    if (!auth.token) return;
    setCreatingEmployee(true);
    setError(null);
    try {
      const created = await apiFetch<CreatedEmployee>(
        "/company/employees",
        { method: "POST", body: JSON.stringify(employeeForm) },
        auth.token
      );
      setEmployees((prev) => [created, ...prev]);
      setPasswordByEmployeeId((prev) => ({ ...prev, [created.id]: employeeForm.password }));
      const usedPassword = employeeForm.password;
      setEmployeeForm({ name: "", email: "", password: "" });
      await downloadCredentialsPdf(created.id, usedPassword, created.name);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreatingEmployee(false);
    }
  };

  const deleteEmployee = async (id: string, name: string) => {
    if (!auth.token) return;
    if (!window.confirm(`Mitarbeiter "${name}" wirklich löschen?`)) return;
    setDeletingId(id);
    setError(null);
    try {
      await apiFetch(`/company/employees/${id}`, { method: "DELETE" }, auth.token);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (employee: Employee) => {
    setEditingId(employee.id);
    setEditForm({ name: employee.name, email: employee.email, password: "" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({ name: "", email: "", password: "" });
  };

  const runImport = async () => {
    if (!auth.token || !importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const result = await apiFetch<ImportResult>(
        "/company/employees/import",
        { method: "POST", body: formData },
        auth.token
      );
      setImportResult(result);
      if (result.created.length > 0) {
        await load();
      }
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const downloadImportPdf = async () => {
    if (!auth.token || !importResult?.created.length) return;
    setImportPdfLoading(true);
    try {
      const response = await fetch(`${API_URL}/company/employees/import/credentials-pdf`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ employees: importResult.created })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "import-zugangsdaten.pdf";
      anchor.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImportPdfLoading(false);
    }
  };

  const saveEdit = async (id: string) => {
    if (!auth.token) return;
    setSavingEdit(true);
    setError(null);
    try {
      const body: Record<string, string> = {};
      if (editForm.name.trim()) body.name = editForm.name.trim();
      if (editForm.email.trim()) body.email = editForm.email.trim();
      if (editForm.password.trim()) body.password = editForm.password.trim();

      const updated = await apiFetch<Employee>(
        `/company/employees/${id}`,
        { method: "PUT", body: JSON.stringify(body) },
        auth.token
      );
      setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)));
      cancelEdit();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingEdit(false);
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
                Mitarbeiter anlegen, bearbeiten, löschen und Zugangsdaten als PDF erzeugen.
              </p>
            </div>
          </section>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          {/* Neuen Mitarbeiter erstellen */}
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
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="settings-field">
                <label>E-Mail</label>
                <input
                  type="email"
                  className="dashboard-text-input"
                  value={employeeForm.email}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="settings-field full-width">
                <label>Passwort</label>
                <input
                  type="password"
                  className="dashboard-text-input"
                  value={employeeForm.password}
                  onChange={(e) => setEmployeeForm((prev) => ({ ...prev, password: e.target.value }))}
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

          {/* Mitarbeiter-Import */}
          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Mitarbeiter importieren (CSV/Excel)</h2>
                <p>CSV oder Excel-Datei mit Spalten "Name" und "Mitarbeiternummer" hochladen.</p>
              </div>
            </div>

            {importError && <p className="text-sm text-brand-700">{importError}</p>}

            <div className="settings-grid">
              <div className="settings-field full-width">
                <label>Datei auswählen (.csv oder .xlsx)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="dashboard-text-input"
                  onChange={(e) => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportResult(null);
                    setImportError(null);
                  }}
                />
              </div>
            </div>

            {importFile && !importResult && (
              <div className="dashboard-inline-actions">
                <button
                  type="button"
                  className="dashboard-primary-btn"
                  onClick={runImport}
                  disabled={importing}
                >
                  {importing ? "Importiere..." : "Zugangsdaten erstellen"}
                </button>
              </div>
            )}

            {importResult && (
              <>
                <p className="dashboard-empty">
                  {importResult.created.length} Mitarbeiter importiert
                  {importResult.skipped.length > 0 ? `, ${importResult.skipped.length} übersprungen` : ""}.
                </p>

                {importResult.created.length > 0 && (
                  <>
                    <div className="dashboard-list">
                      {importResult.created.map((emp, i) => (
                        <article key={i} className="dashboard-list-item">
                          <div className="dashboard-list-head">
                            <div>
                              <p className="dashboard-item-title">{emp.name}</p>
                              <p className="dashboard-item-subtitle">
                                Benutzername: {emp.username} · Passwort: {emp.password}
                              </p>
                              {emp.internalCode && (
                                <p className="dashboard-item-subtitle">
                                  Interner Code: {emp.internalCode}
                                </p>
                              )}
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="dashboard-inline-actions">
                      <button
                        type="button"
                        className="dashboard-primary-btn"
                        onClick={downloadImportPdf}
                        disabled={importPdfLoading}
                      >
                        {importPdfLoading ? "Erstelle PDF..." : "Als PDF exportieren"}
                      </button>
                      <button
                        type="button"
                        className="dashboard-ghost-btn"
                        onClick={() => {
                          setImportResult(null);
                          setImportFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                      >
                        Neuer Import
                      </button>
                    </div>
                  </>
                )}

                {importResult.skipped.length > 0 && (
                  <div style={{ marginTop: "0.75rem" }}>
                    <p className="dashboard-item-subtitle">Übersprungen:</p>
                    <ul className="dashboard-compact-list">
                      {importResult.skipped.map((msg, i) => (
                        <li key={i}>
                          <p className="dashboard-item-subtitle">{msg}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </section>

          {/* Invite-Codes */}
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

          {/* Mitarbeiterliste */}
          <section className="dashboard-panel">
            <div className="dashboard-panel-head">
              <div>
                <h2>Mitarbeiterliste</h2>
                <p>{employees.length} Mitarbeiter · PDF-Zugangsdaten einzeln oder alle auf einmal erzeugen.</p>
              </div>
              {employees.length > 0 && (
                <button
                  type="button"
                  className="dashboard-primary-btn"
                  onClick={downloadAllCredentialsPdf}
                  disabled={bulkPdfLoading}
                >
                  {bulkPdfLoading ? "Erstelle PDF..." : "Alle Zugangsdaten-PDFs"}
                </button>
              )}
            </div>

            {loading ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : employees.length === 0 ? (
              <p className="dashboard-empty">Noch keine Mitarbeiter registriert.</p>
            ) : (
              <div className="dashboard-list">
                {employees.map((employee) => (
                  <article key={employee.id} className="dashboard-list-item">
                    {editingId === employee.id ? (
                      // Edit-Formular
                      <>
                        <div className="settings-grid">
                          <div className="settings-field">
                            <label>Name</label>
                            <input
                              className="dashboard-text-input"
                              value={editForm.name}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className="settings-field">
                            <label>E-Mail</label>
                            <input
                              type="email"
                              className="dashboard-text-input"
                              value={editForm.email}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                            />
                          </div>
                          <div className="settings-field full-width">
                            <label>Neues Passwort (optional)</label>
                            <input
                              type="password"
                              className="dashboard-text-input"
                              placeholder="Leer lassen = Passwort unverändert"
                              value={editForm.password}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, password: e.target.value }))}
                            />
                          </div>
                        </div>
                        <div className="dashboard-inline-actions">
                          <button
                            type="button"
                            className="dashboard-primary-btn"
                            onClick={() => saveEdit(employee.id)}
                            disabled={savingEdit}
                          >
                            {savingEdit ? "Speichert..." : "Speichern"}
                          </button>
                          <button
                            type="button"
                            className="dashboard-ghost-btn"
                            onClick={cancelEdit}
                            disabled={savingEdit}
                          >
                            Abbrechen
                          </button>
                        </div>
                      </>
                    ) : (
                      // Normal-Ansicht
                      <>
                        <div className="dashboard-list-head">
                          <div>
                            <p className="dashboard-item-title">{employee.name}</p>
                            <p className="dashboard-item-subtitle">{employee.email}</p>
                            <p className="dashboard-item-subtitle">
                              Registriert am {new Date(employee.createdAt).toLocaleString("de-DE")}
                            </p>
                          </div>
                          <div className="dashboard-inline-actions">
                            <button
                              type="button"
                              className="dashboard-ghost-btn"
                              onClick={() => startEdit(employee)}
                            >
                              Bearbeiten
                            </button>
                            <button
                              type="button"
                              className="dashboard-ghost-btn"
                              onClick={() => deleteEmployee(employee.id, employee.name)}
                              disabled={deletingId === employee.id}
                            >
                              {deletingId === employee.id ? "Löscht..." : "Löschen"}
                            </button>
                          </div>
                        </div>

                        <div className="dashboard-connect-row">
                          <div className="dashboard-connect-field">
                            <label>Passwort für PDF</label>
                            <input
                              type="password"
                              className="dashboard-text-input"
                              value={passwordByEmployeeId[employee.id] ?? ""}
                              onChange={(e) =>
                                setPasswordByEmployeeId((prev) => ({ ...prev, [employee.id]: e.target.value }))
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
                      </>
                    )}
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
