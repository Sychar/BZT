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

type EditModalState = {
  id: string;
  name: string;
  mitarbeiternummer: string;
};

export default function CompanyEmployeesPage() {
  const auth = useAuth();

  // --- State: Mitarbeiterliste ---
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [employeesError, setEmployeesError] = useState<string | null>(null);

  // --- State: Stats ---
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "NEVER">("ALL");

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

  // --- State: Edit Modal ---
  const [editModal, setEditModal] = useState<EditModalState | null>(null);
  const [editModalPassword, setEditModalPassword] = useState("");
  const [editModalMustChange, setEditModalMustChange] = useState(false);
  const [editModalLoading, setEditModalLoading] = useState(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);

  // --- State: Löschen ---
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- State: Export PDF ---
  const [exportPdfLoading, setExportPdfLoading] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);

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

  // --- Edit Modal ---
  const openEditModal = (emp: Employee) => {
    setEditModal({ id: emp.id, name: emp.name, mitarbeiternummer: emp.email });
    setEditModalPassword("");
    setEditModalMustChange(emp.mustChangePassword);
    setEditModalError(null);
  };

  const closeEditModal = () => {
    setEditModal(null);
    setEditModalPassword("");
    setEditModalMustChange(false);
    setEditModalError(null);
  };

  const saveEditModal = async () => {
    if (!auth.token || !editModal) return;
    if (!editModal.name.trim() || !editModal.mitarbeiternummer.trim()) {
      setEditModalError("Name und Mitarbeiternummer dürfen nicht leer sein.");
      return;
    }
    setEditModalLoading(true);
    setEditModalError(null);
    try {
      const body: Record<string, unknown> = {
        name: editModal.name.trim(),
        mitarbeiternummer: editModal.mitarbeiternummer.trim(),
        mustChangePassword: editModalMustChange
      };
      if (editModalPassword.trim()) {
        body.password = editModalPassword.trim();
      }
      const updated = await apiFetch<Employee>(
        `/company/employees/${editModal.id}`,
        { method: "PUT", body: JSON.stringify(body) },
        auth.token
      );
      setEmployees((prev) => prev.map((e) => (e.id === editModal.id ? { ...e, ...updated } : e)));
      closeEditModal();
    } catch (err) {
      setEditModalError((err as Error).message);
    } finally {
      setEditModalLoading(false);
    }
  };

  // --- Mitarbeiter löschen ---
  const deleteEmployee = async (id: string, name: string) => {
    if (!auth.token) return;
    if (!window.confirm(`Mitarbeiter "${name}" wirklich löschen?`)) return;
    const employeeToDelete = employees.find((employee) => employee.id === id) ?? null;
    setDeletingId(id);
    try {
      await apiFetch(`/company/employees/${id}`, { method: "DELETE" }, auth.token);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
      if (stats && employeeToDelete) {
        setStats({
          total: Math.max(0, stats.total - 1),
          active: Math.max(0, stats.active - (employeeToDelete.mustChangePassword ? 0 : 1)),
          neverLoggedIn: Math.max(0, stats.neverLoggedIn - (employeeToDelete.mustChangePassword ? 1 : 0))
        });
      }
    } catch (err) {
      setEmployeesError((err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  // --- Export PDF alle Mitarbeiter ---
  const downloadExportPdf = async () => {
    if (!auth.token) return;
    setExportPdfLoading(true);
    setExportPdfError(null);
    try {
      const response = await fetch(`${API_URL}/company/employees/export-pdf`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error((payload as { error?: string }).error ?? "PDF konnte nicht erstellt werden.");
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zugangsdaten-alle-mitarbeiter.pdf";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setExportPdfError((err as Error).message);
    } finally {
      setExportPdfLoading(false);
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

  const filteredEmployees = employees.filter((employee) => {
    if (statusFilter === "ACTIVE") return !employee.mustChangePassword;
    if (statusFilter === "NEVER") return employee.mustChangePassword;
    return true;
  });

  const activeEmployeesCount = employees.filter((employee) => !employee.mustChangePassword).length;
  const neverLoggedInCount = employees.length - activeEmployeesCount;

  const filterButtonClass = (filter: "ALL" | "ACTIVE" | "NEVER") =>
    [
      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
      statusFilter === filter
        ? "bg-brand-500 text-paper shadow-[0_8px_20px_rgba(198,90,58,0.25)]"
        : "bg-paper text-ink/80 hover:bg-cream"
    ].join(" ");

  return (
    <PageShell>
      <div className="dashboard-shell overflow-x-hidden">
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
              <div className="w-full overflow-hidden">
                <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold break-words w-full overflow-hidden">
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
              <div className="w-full overflow-hidden">
                <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold break-words w-full overflow-hidden">
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
              <div className="w-full overflow-hidden">
                <h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold break-words w-full overflow-hidden">
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

          {/* Card 4: Mitarbeiterliste verwalten */}
          <section className="dashboard-panel relative flex flex-col gap-5 overflow-hidden">
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-100/50 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 -left-14 h-44 w-44 rounded-full bg-forest/10 blur-3xl" />

            <div className="dashboard-panel-head relative">
              <div className="w-full overflow-hidden">
                <h2 className="text-base font-semibold sm:text-lg">Mitarbeiterliste</h2>
                <p>Namen bearbeiten, Status sehen und Mitarbeiter sauber verwalten.</p>
              </div>
            </div>

            <div className="relative rounded-2xl border border-brand-200/70 bg-gradient-to-r from-brand-50 via-paper to-cream px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-700/80">
                    Interner Firmencode
                  </p>
                  {internalCode ? (
                    <p className="mt-1 break-all font-mono text-lg font-bold tracking-[0.2em] text-ink sm:text-xl">
                      {internalCode}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-ink/55">Noch nicht generiert</p>
                  )}
                  <p className="mt-1 text-xs text-ink/60">Dieser Code wird beim Mitarbeiter-Login verwendet.</p>
                </div>
                <button
                  type="button"
                  className="dashboard-ghost-btn shrink-0 border-brand-300/80 bg-paper/90 text-ink hover:border-brand-500 hover:bg-paper"
                  onClick={regenerateCode}
                  disabled={regeneratingCode}
                >
                  {regeneratingCode ? "Generiere..." : internalCode ? "Neu generieren" : "Generieren"}
                </button>
              </div>
            </div>
            {codeError && <p className="text-sm text-brand-700">{codeError}</p>}
            {employeesError && <p className="text-sm text-brand-700">{employeesError}</p>}

            <div className="relative flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-ink/10 bg-cream/70 p-1.5">
                <button type="button" className={filterButtonClass("ALL")} onClick={() => setStatusFilter("ALL")}>
                  Alle
                  <span className="rounded-full bg-paper/70 px-2 py-0.5 text-xs font-semibold text-ink/70">
                    {employees.length}
                  </span>
                </button>
                <button
                  type="button"
                  className={filterButtonClass("ACTIVE")}
                  onClick={() => setStatusFilter("ACTIVE")}
                >
                  Aktiv
                  <span className="rounded-full bg-paper/70 px-2 py-0.5 text-xs font-semibold text-ink/70">
                    {activeEmployeesCount}
                  </span>
                </button>
                <button
                  type="button"
                  className={filterButtonClass("NEVER")}
                  onClick={() => setStatusFilter("NEVER")}
                >
                  Nie eingeloggt
                  <span className="rounded-full bg-paper/70 px-2 py-0.5 text-xs font-semibold text-ink/70">
                    {neverLoggedInCount}
                  </span>
                </button>
              </div>

              <button
                type="button"
                className="dashboard-ghost-btn border-ink/20 bg-paper px-4 py-2"
                onClick={downloadExportPdf}
                disabled={exportPdfLoading || employees.length === 0}
              >
                {exportPdfLoading ? "Erstelle PDF..." : "Zugangsdaten exportieren (PDF)"}
              </button>
            </div>
            {exportPdfError && <p className="text-sm text-brand-700">{exportPdfError}</p>}

            {loadingEmployees ? (
              <p className="dashboard-empty">Daten werden geladen...</p>
            ) : filteredEmployees.length === 0 ? (
              <p className="dashboard-empty">
                {statusFilter === "ALL"
                  ? "Noch keine Mitarbeiter vorhanden."
                  : "Keine Mitarbeiter in diesem Status gefunden."}
              </p>
            ) : (
              <div className="relative space-y-3">
                {filteredEmployees.map((emp) => (
                  <article
                    key={emp.id}
                    className="group rounded-2xl border border-ink/10 bg-paper/95 px-4 py-4 shadow-[0_8px_22px_rgba(28,28,28,0.04)] transition hover:-translate-y-[1px] hover:border-ink/20 hover:shadow-[0_14px_30px_rgba(28,28,28,0.08)]"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-ink">{emp.name}</h3>
                          {emp.mustChangePassword ? (
                            <span className="inline-flex rounded-full bg-neutral px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/80">
                              Noch nicht eingeloggt
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-forest px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-paper">
                              Aktiv
                            </span>
                          )}
                        </div>
                        <p className="mt-1 break-all font-mono text-xs text-ink/60">
                          Benutzername: {emp.email}
                        </p>
                      </div>

                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                        <button
                          type="button"
                          className="dashboard-ghost-btn w-full px-3 py-2 sm:w-auto"
                          onClick={() => openEditModal(emp)}
                        >
                          Bearbeiten
                        </button>
                        <button
                          type="button"
                          className="inline-flex w-full items-center justify-center rounded-full border border-brand-200 bg-paper px-4 py-2 text-sm text-brand-700 transition hover:border-brand-500 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                          onClick={() => deleteEmployee(emp.id, emp.name)}
                          disabled={deletingId === emp.id}
                        >
                          {deletingId === emp.id ? "Lösche..." : "Löschen"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      {/* ── Edit Modal ── */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl p-6 flex flex-col gap-4">
            <h3 className="text-base sm:text-lg font-semibold text-ink break-words">
              Mitarbeiter bearbeiten
            </h3>

            {editModalError && (
              <p className="text-sm text-brand-700">{editModalError}</p>
            )}

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink/70">Name</span>
              <input
                className="dashboard-text-input"
                value={editModal.name}
                onChange={(e) => setEditModal((p) => p ? { ...p, name: e.target.value } : p)}
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink/70">Mitarbeiternummer (= Benutzername)</span>
              <input
                className="dashboard-text-input font-mono"
                value={editModal.mitarbeiternummer}
                onChange={(e) => setEditModal((p) => p ? { ...p, mitarbeiternummer: e.target.value } : p)}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium text-ink/70">Neues Passwort</span>
              <input
                type="password"
                className="dashboard-text-input"
                placeholder="Leer lassen = unverändert"
                value={editModalPassword}
                onChange={(e) => setEditModalPassword(e.target.value)}
              />
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editModalMustChange}
                onChange={(e) => setEditModalMustChange(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-ink/70">Passwort-Reset erzwingen (mustChangePassword)</span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="dashboard-ghost-btn px-3 py-2 w-full sm:w-auto"
                onClick={closeEditModal}
                disabled={editModalLoading}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="dashboard-primary-btn px-3 py-2 w-full sm:w-auto"
                onClick={saveEditModal}
                disabled={editModalLoading || !editModal.name.trim() || !editModal.mitarbeiternummer.trim()}
              >
                {editModalLoading ? "Speichern..." : "Speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
