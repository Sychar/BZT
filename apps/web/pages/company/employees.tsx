import { useEffect, useRef, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_URL } from "../../lib/api";

type Employee = {
  id: string;
  name: string;
  email: string;
  mustChangePassword: boolean;
  createdAt: string;
};

type CreatedEmployee = {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
  companyCode: string;
  internalCode: string | null;
  mustChangePassword: boolean;
  createdAt: string;
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

type Stats = {
  total: number;
  active: number;
  neverLoggedIn: number;
};

type CompanyInfo = {
  internalCode: string | null;
};

export default function CompanyEmployeesPage() {
  const auth = useAuth();

  // --- State: Mitarbeiterliste ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  // --- State: Stats ---
  const [stats, setStats] = useState<Stats | null>(null);

  // --- State: Interner Firmencode ---
  const [internalCode, setInternalCode] = useState<string | null>(null);
  const [regeneratingCode, setRegeneratingCode] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);

  // --- State: Manuell hinzufügen ---
  const [manualForm, setManualForm] = useState({ name: "", mitarbeiternummer: "" });
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<CreatedEmployee | null>(null);
  const [manualPdfLoading, setManualPdfLoading] = useState(false);

  // --- State: Import ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<{ name: string; mitarbeiternummer: string }>>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importPdfLoading, setImportPdfLoading] = useState(false);

  // --- State: Liste verwalten ---
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadAll = async () => {
    if (!auth.token) return;
    setLoadingEmployees(true);
    setEmployeesError(null);
    try {
      const [emps, statsData, dashboardData] = await Promise.all([
        apiFetch<Employee[]>("/company/employees", {}, auth.token),
        apiFetch<Stats>("/company/employees/stats", {}, auth.token),
        apiFetch<{ company: CompanyInfo }>("/company/dashboard", {}, auth.token)
      ]);
      setEmployees(emps);
      setStats(statsData);
      setInternalCode(dashboardData.company.internalCode);
    } catch (err) {
      setEmployeesError((err as Error).message);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [auth.token]);

  // --- Import: Vorschau aus Datei lesen ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setImportFile(file);
    setImportResult(null);
    setImportError(null);
    setImportPreview([]);
    if (!file) return;

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<{ Name?: string; Mitarbeiternummer?: string }>(sheet);
      const preview = rows
        .map((r) => ({
          name: String(r.Name ?? "").trim(),
          mitarbeiternummer: String(r.Mitarbeiternummer ?? "").trim()
        }))
        .filter((r) => r.name && r.mitarbeiternummer)
        .slice(0, 10);
      setImportPreview(preview);
    } catch {
      setImportError("Datei konnte nicht gelesen werden.");
    }
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
        await loadAll();
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
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ employees: importResult.created })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "import-zugangsdaten.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImportPdfLoading(false);
    }
  };

  const resetImport = () => {
    setImportResult(null);
    setImportFile(null);
    setImportPreview([]);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Manuell hinzufügen ---
  const createEmployee = async () => {
    if (!auth.token || !manualForm.name.trim() || !manualForm.mitarbeiternummer.trim()) return;
    setManualLoading(true);
    setManualError(null);
    setManualSuccess(null);
    try {
      const created = await apiFetch<CreatedEmployee>(
        "/company/employees",
        { method: "POST", body: JSON.stringify(manualForm) },
        auth.token
      );
      setManualSuccess(created);
      setManualForm({ name: "", mitarbeiternummer: "" });
      await loadAll();
    } catch (err) {
      setManualError((err as Error).message);
    } finally {
      setManualLoading(false);
    }
  };

  const downloadManualPdf = async () => {
    if (!auth.token || !manualSuccess) return;
    setManualPdfLoading(true);
    try {
      const response = await fetch(`${API_URL}/company/employees/import/credentials-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          employees: [
            {
              name: manualSuccess.name,
              username: manualSuccess.username,
              password: manualSuccess.password,
              internalCode: manualSuccess.internalCode
            }
          ]
        })
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const safeName = manualSuccess.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-_]/g, "");
      a.download = `zugangsdaten-${safeName || "mitarbeiter"}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setManualError((err as Error).message);
    } finally {
      setManualPdfLoading(false);
    }
  };

  // --- Code neu generieren ---
  const regenerateCode = async () => {
    if (!auth.token) return;
    if (!window.confirm("Interner Firmencode neu generieren? Bestehende Mitarbeiter müssen den neuen Code verwenden.")) return;
    setRegeneratingCode(true);
    setCodeError(null);
    try {
      const endpoint = internalCode ? "/company/internal-code/regenerate" : "/company/internal-code/generate";
      const result = await apiFetch<{ internalCode: string }>(endpoint, { method: "POST" }, auth.token);
      setInternalCode(result.internalCode);
    } catch (err) {
      setCodeError((err as Error).message);
    } finally {
      setRegeneratingCode(false);
    }
  };

  // --- Mitarbeiter bearbeiten (nur Name) ---
  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditName(emp.name);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
  };

  const saveEdit = async (id: string) => {
    if (!auth.token || !editName.trim()) return;
    setSavingEdit(true);
    try {
      const updated = await apiFetch<Employee>(
        `/company/employees/${id}`,
        { method: "PUT", body: JSON.stringify({ name: editName.trim() }) },
        auth.token
      );
      setEmployees((prev) => prev.map((e) => (e.id === id ? { ...e, name: updated.name } : e)));
      cancelEdit();
    } catch (err) {
      setEmployeesError((err as Error).message);
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteEmployee = async (id: string, name: string) => {
    if (!auth.token) return;
    if (!window.confirm(`Mitarbeiter "${name}" wirklich löschen?`)) return;
    setDeletingId(id);
    try {
      await apiFetch(`/company/employees/${id}`, { method: "DELETE" }, auth.token);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      if (stats) setStats({ ...stats, total: stats.total - 1, active: stats.active - 1 });
    } catch (err) {
      setEmployeesError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  if (!auth.token) {
    return (
      <PageShell>
        <div className="dashboard-shell">
          <p className="dashboard-empty">Bitte einloggen.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="dashboard-shell">
        {/* Hero */}
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Mitarbeiter</p>
            <h1>Mitarbeiterverwaltung</h1>
            <p className="dashboard-hero-copy">
              Mitarbeiter importieren, anlegen und verwalten.
            </p>
          </div>
        </section>

        {/* 2×2 Grid auf Desktop, untereinander auf Mobile */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Card 1: Mitarbeiter importieren ── */}
          <section className="dashboard-panel flex flex-col gap-4">
            <div className="dashboard-panel-head">
              <div>
                <h2 className="flex items-center gap-2">
                  <span>📥</span> Mitarbeiter importieren
                </h2>
                <p>CSV oder Excel hochladen – Zugangsdaten werden automatisch erstellt.</p>
              </div>
            </div>

            {importError && <p className="text-sm text-brand-700">{importError}</p>}

            {!importResult ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="text-sm font-medium text-ink/70">Datei auswählen (.csv oder .xlsx)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="dashboard-text-input cursor-pointer"
                    onChange={handleFileChange}
                  />
                </label>

                {importPreview.length > 0 && (
                  <div className="rounded-xl border border-ink/10 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-cream text-ink/60">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Name</th>
                          <th className="px-3 py-2 text-left font-medium">Mitarbeiternummer</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, i) => (
                          <tr key={i} className="border-t border-ink/5">
                            <td className="px-3 py-2 text-ink">{row.name}</td>
                            <td className="px-3 py-2 text-ink/70 font-mono text-xs">{row.mitarbeiternummer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {importPreview.length === 10 && (
                      <p className="px-3 py-2 text-xs text-ink/50 border-t border-ink/5">Vorschau: erste 10 Zeilen</p>
                    )}
                  </div>
                )}

                {importFile && (
                  <button
                    type="button"
                    className="dashboard-primary-btn self-start"
                    onClick={runImport}
                    disabled={importing}
                  >
                    {importing ? "Importiere..." : "Zugangsdaten erstellen & PDF generieren"}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-ink">
                  {importResult.created.length} Mitarbeiter importiert
                  {importResult.skipped.length > 0 && `, ${importResult.skipped.length} übersprungen`}.
                </p>

                {importResult.created.length > 0 && (
                  <div className="rounded-xl border border-ink/10 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-cream text-ink/60">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Name</th>
                          <th className="px-3 py-2 text-left font-medium">Benutzername</th>
                          <th className="px-3 py-2 text-left font-medium">Passwort</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResult.created.map((emp, i) => (
                          <tr key={i} className="border-t border-ink/5">
                            <td className="px-3 py-2 text-ink">{emp.name}</td>
                            <td className="px-3 py-2 text-ink/70 font-mono text-xs">{emp.username}</td>
                            <td className="px-3 py-2 text-ink/70 font-mono text-xs">{emp.password}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {importResult.skipped.length > 0 && (
                  <ul className="text-xs text-ink/50 space-y-1">
                    {importResult.skipped.map((msg, i) => (
                      <li key={i}>• {msg}</li>
                    ))}
                  </ul>
                )}

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="dashboard-primary-btn"
                    onClick={downloadImportPdf}
                    disabled={importPdfLoading || importResult.created.length === 0}
                  >
                    {importPdfLoading ? "Erstelle PDF..." : "Als PDF speichern"}
                  </button>
                  <button type="button" className="dashboard-ghost-btn" onClick={resetImport}>
                    Neuer Import
                  </button>
                </div>
              </>
            )}
          </section>

          {/* ── Card 2: Manuell hinzufügen ── */}
          <section className="dashboard-panel flex flex-col gap-4">
            <div className="dashboard-panel-head">
              <div>
                <h2 className="flex items-center gap-2">
                  <span>➕</span> Manuell hinzufügen
                </h2>
                <p>Einzelnen Mitarbeiter anlegen – Passwort wird automatisch generiert.</p>
              </div>
            </div>

            {manualError && <p className="text-sm text-brand-700">{manualError}</p>}

            {!manualSuccess ? (
              <>
                <div className="flex flex-col gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-ink/70">Name</span>
                    <input
                      className="dashboard-text-input"
                      placeholder="z. B. Max Mustermann"
                      value={manualForm.name}
                      onChange={(e) => setManualForm((p) => ({ ...p, name: e.target.value }))}
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm font-medium text-ink/70">Mitarbeiternummer (= Benutzername)</span>
                    <input
                      className="dashboard-text-input font-mono"
                      placeholder="z. B. MA-1234"
                      value={manualForm.mitarbeiternummer}
                      onChange={(e) => setManualForm((p) => ({ ...p, mitarbeiternummer: e.target.value }))}
                    />
                  </label>
                </div>

                <button
                  type="button"
                  className="dashboard-primary-btn self-start"
                  onClick={createEmployee}
                  disabled={manualLoading || !manualForm.name.trim() || !manualForm.mitarbeiternummer.trim()}
                >
                  {manualLoading ? "Erstelle..." : "Mitarbeiter erstellen"}
                </button>
              </>
            ) : (
              <div className="rounded-xl border border-forest/20 bg-forest/5 p-4 flex flex-col gap-3">
                <p className="text-sm font-semibold text-forest">Mitarbeiter erfolgreich erstellt</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-ink/50">Name</span>
                    <p className="font-medium text-ink">{manualSuccess.name}</p>
                  </div>
                  <div>
                    <span className="text-ink/50">Benutzername</span>
                    <p className="font-mono text-ink">{manualSuccess.username}</p>
                  </div>
                  <div>
                    <span className="text-ink/50">Passwort</span>
                    <p className="font-mono text-ink">{manualSuccess.password}</p>
                  </div>
                  {manualSuccess.internalCode && (
                    <div>
                      <span className="text-ink/50">Interner Code</span>
                      <p className="font-mono text-ink">{manualSuccess.internalCode}</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="dashboard-primary-btn"
                    onClick={downloadManualPdf}
                    disabled={manualPdfLoading}
                  >
                    {manualPdfLoading ? "Erstelle PDF..." : "Als PDF speichern"}
                  </button>
                  <button
                    type="button"
                    className="dashboard-ghost-btn"
                    onClick={() => setManualSuccess(null)}
                  >
                    Weiteren anlegen
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* ── Card 3: Mitarbeiterstatus ── */}
          <section className="dashboard-panel flex flex-col gap-4">
            <div className="dashboard-panel-head">
              <div>
                <h2 className="flex items-center gap-2">
                  <span>📊</span> Mitarbeiterstatus
                </h2>
                <p>Übersicht über aktive und neu angelegte Mitarbeiter.</p>
              </div>
            </div>

            {loadingEmployees && !stats ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : stats ? (
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-forest/5 border border-forest/15 p-3 sm:p-4 text-center min-w-0">
                  <p className="text-2xl sm:text-3xl font-bold text-forest">{stats.total}</p>
                  <p className="mt-1 text-xs text-ink/60">Gesamt</p>
                </div>
                <div className="rounded-xl bg-brand-50 border border-brand-200 p-3 sm:p-4 text-center min-w-0">
                  <p className="text-2xl sm:text-3xl font-bold text-brand-600">{stats.active}</p>
                  <p className="mt-1 text-xs text-ink/60">Aktiv</p>
                </div>
                <div className="rounded-xl bg-neutral border border-taupe p-3 sm:p-4 text-center min-w-0">
                  <p className="text-2xl sm:text-3xl font-bold text-ink/60">{stats.neverLoggedIn}</p>
                  <p className="mt-1 text-xs text-ink/60 break-words">Nie eingeloggt</p>
                </div>
              </div>
            ) : null}
          </section>

          {/* ── Card 4: Mitarbeiterliste verwalten ── */}
          <section className="dashboard-panel flex flex-col gap-4">
            <div className="dashboard-panel-head">
              <div>
                <h2 className="flex items-center gap-2">
                  <span>👥</span> Mitarbeiterliste
                </h2>
                <p>Namen bearbeiten oder Mitarbeiter löschen.</p>
              </div>
            </div>

            {/* Interner Firmencode */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cream border border-ink/10 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-ink/50 font-medium uppercase tracking-wide">Interner Firmencode</p>
                {internalCode ? (
                  <p className="mt-0.5 font-mono text-base sm:text-lg font-bold text-ink tracking-widest break-all">{internalCode}</p>
                ) : (
                  <p className="mt-0.5 text-sm text-ink/50">Noch nicht generiert</p>
                )}
              </div>
              <button
                type="button"
                className="dashboard-ghost-btn shrink-0"
                onClick={regenerateCode}
                disabled={regeneratingCode}
              >
                {regeneratingCode ? "Generiere..." : internalCode ? "Neu generieren" : "Generieren"}
              </button>
            </div>
            {codeError && <p className="text-sm text-brand-700">{codeError}</p>}
            {employeesError && <p className="text-sm text-brand-700">{employeesError}</p>}

            {loadingEmployees ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : employees.length === 0 ? (
              <p className="dashboard-empty">Noch keine Mitarbeiter vorhanden.</p>
            ) : (
              <div className="overflow-hidden rounded-xl border border-ink/10">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-cream text-ink/60">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Name</th>
                      <th className="px-3 py-2 text-left font-medium hidden sm:table-cell w-32">Benutzername</th>
                      <th className="px-3 py-2 text-left font-medium hidden md:table-cell w-28">Status</th>
                      <th className="px-3 py-2 text-right font-medium w-24 sm:w-36">Aktionen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp) => (
                      <tr key={emp.id} className="border-t border-ink/5 hover:bg-cream/50 transition-colors">
                        {editingId === emp.id ? (
                          <td colSpan={4} className="px-3 py-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                className="dashboard-text-input flex-1 min-w-[120px]"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="dashboard-primary-btn"
                                onClick={() => saveEdit(emp.id)}
                                disabled={savingEdit || !editName.trim()}
                              >
                                {savingEdit ? "..." : "Speichern"}
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
                          </td>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-medium text-ink min-w-0 overflow-hidden">
                              <span className="block truncate">{emp.name}</span>
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-ink/60 hidden sm:table-cell overflow-hidden">
                              <span className="block truncate">{emp.email}</span>
                            </td>
                            <td className="px-3 py-2 hidden md:table-cell">
                              {emp.mustChangePassword ? (
                                <span className="dashboard-status is-inactive">Noch nicht eingeloggt</span>
                              ) : (
                                <span className="dashboard-status is-active">Aktiv</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex flex-col sm:flex-row justify-end gap-1 sm:gap-2">
                                <button
                                  type="button"
                                  className="dashboard-ghost-btn text-xs px-2 py-1"
                                  onClick={() => startEdit(emp)}
                                >
                                  Bearbeiten
                                </button>
                                <button
                                  type="button"
                                  className="dashboard-ghost-btn text-xs px-2 py-1"
                                  onClick={() => deleteEmployee(emp.id, emp.name)}
                                  disabled={deletingId === emp.id}
                                >
                                  {deletingId === emp.id ? "..." : "Löschen"}
                                </button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

        </div>
      </div>
    </PageShell>
  );
}
