import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string | number;
  unit: string;
  active: boolean;
  isPromo: boolean;
};

type ImportResult = {
  importedCount: number;
  skippedCount: number;
  errorRows: Array<{ row: number; reason: string }>;
};

type MenuUpload = {
  id: string;
  fileName: string;
  originalName: string;
  uploadedAt: string;
  size?: number;
};

const categories = ["BROT", "BELAG", "GETRAENK", "FLEISCH", "WURST", "SONSTIGES"];

export default function VendorProductsPage() {
  const auth = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [menuUploads, setMenuUploads] = useState<MenuUpload[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [menuUploadError, setMenuUploadError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [menuUploading, setMenuUploading] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [menuFile, setMenuFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "BROT",
    price: "",
    unit: "Stk",
    isPromo: false
  });

  const load = async () => {
    if (!auth.token) return;
    try {
      const [productsData, uploadsData] = await Promise.all([
        apiFetch<Product[]>("/vendor/products", {}, auth.token),
        apiFetch<MenuUpload[]>("/vendor/products/menu-uploads", {}, auth.token)
      ]);
      setProducts(productsData);
      setMenuUploads(uploadsData);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, [auth.token]);

  const createProduct = async () => {
    if (!auth.token || !auth.vendorId) return;
    setError(null);
    try {
      await apiFetch(
        `/vendors/${auth.vendorId}/products`,
        {
          method: "POST",
          body: JSON.stringify({
            name: form.name,
            category: form.category,
            price: Number(form.price),
            unit: form.unit,
            isPromo: form.isPromo
          })
        },
        auth.token
      );
      setForm({ name: "", category: "BROT", price: "", unit: "Stk", isPromo: false });
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const uploadMenuFile = async () => {
    if (!auth.token || !menuFile) return;

    setMenuUploading(true);
    setMenuUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", menuFile);
      const created = await apiFetch<MenuUpload>(
        "/vendor/products/menu-upload",
        {
          method: "POST",
          body: formData
        },
        auth.token
      );
      setMenuUploads((prev) => [created, ...prev]);
      setMenuFile(null);
    } catch (err) {
      setMenuUploadError((err as Error).message);
    } finally {
      setMenuUploading(false);
    }
  };

  const importProducts = async () => {
    if (!auth.token || !importFile) return;
    setImportError(null);
    setImportResult(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const result = await apiFetch<ImportResult>(
        "/vendor/products/import",
        {
          method: "POST",
          body: formData
        },
        auth.token
      );
      setImportResult(result);
      setImportFile(null);
      await load();
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const toggleActive = async (product: Product) => {
    if (!auth.token) return;
    setError(null);
    try {
      await apiFetch(
        `/products/${product.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ active: !product.active })
        },
        auth.token
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const togglePromo = async (product: Product) => {
    if (!auth.token) return;
    setError(null);
    try {
      await apiFetch(
        `/products/${product.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ isPromo: !product.isPromo })
        },
        auth.token
      );
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Produkte</p>
            <h1>Produktverwaltung</h1>
            <p className="dashboard-hero-copy">
              Menü-Dateien hochladen, Produkte manuell pflegen oder per Excel importieren.
            </p>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Menü hochladen (PDF/Bilder)</h2>
              <p>Upload für Speisekarte als PDF oder Bilddatei. AI-Verarbeitung kann später folgen.</p>
            </div>
          </div>

          <div className="dashboard-connect-row">
            <div className="dashboard-connect-field">
              <label>Datei (PDF, PNG, JPG, JPEG, WEBP)</label>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(event) => setMenuFile(event.target.files?.[0] ?? null)}
                className="dashboard-text-input"
              />
            </div>
            <button
              type="button"
              onClick={uploadMenuFile}
              className="dashboard-primary-btn"
              disabled={!menuFile || menuUploading}
            >
              {menuUploading ? "Upload läuft..." : "Menü hochladen"}
            </button>
          </div>

          {menuUploadError && <p className="text-sm text-brand-700">{menuUploadError}</p>}

          {menuUploads.length === 0 ? (
            <p className="dashboard-empty">Noch keine Menü-Dateien hochgeladen.</p>
          ) : (
            <ul className="dashboard-compact-list">
              {menuUploads.map((upload) => (
                <li key={upload.id}>
                  <div>
                    <p className="dashboard-item-title">{upload.originalName}</p>
                    <p className="dashboard-item-subtitle">
                      Hochgeladen: {new Date(upload.uploadedAt).toLocaleString("de-DE")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Excel-Import</h2>
              <p>Pflichtspalten: Name, Preis. Standard: Kategorie BROT, Einheit Stk.</p>
            </div>
          </div>

          <div className="dashboard-connect-row">
            <div className="dashboard-connect-field">
              <label>Datei (.xlsx)</label>
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                className="dashboard-text-input"
              />
            </div>
            <button type="button" onClick={importProducts} className="dashboard-primary-btn" disabled={!importFile || importing}>
              {importing ? "Import läuft..." : "Excel importieren"}
            </button>
          </div>

          {importError && <p className="text-sm text-brand-700">{importError}</p>}

          {importResult && (
            <div className="dashboard-import-result">
              <p>Importiert: {importResult.importedCount}</p>
              <p>Übersprungen: {importResult.skippedCount}</p>
              {importResult.errorRows.length > 0 && (
                <ul>
                  {importResult.errorRows.map((item) => (
                    <li key={`${item.row}-${item.reason}`}>
                      Zeile {item.row}: {item.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Neues Produkt</h2>
              <p>Einzelnes Produkt direkt anlegen.</p>
            </div>
          </div>

          <div className="settings-grid">
            <div className="settings-field">
              <label>Name</label>
              <input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                className="dashboard-text-input"
              />
            </div>
            <div className="settings-field">
              <label>Einheit</label>
              <input
                value={form.unit}
                onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
                className="dashboard-text-input"
              />
            </div>
            <div className="settings-field">
              <label>Kategorie</label>
              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="dashboard-text-input"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="settings-field">
              <label>Preis</label>
              <input
                value={form.price}
                onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                className="dashboard-text-input"
              />
            </div>
          </div>

          <div className="dashboard-inline-actions">
            <button
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, isPromo: !prev.isPromo }))}
              className={`dashboard-ghost-btn ${form.isPromo ? "is-active" : ""}`}
            >
              {form.isPromo ? "Als Angebot markiert" : "Als Angebot markieren"}
            </button>
            <button type="button" onClick={createProduct} className="dashboard-primary-btn">
              Produkt anlegen
            </button>
          </div>

          {error && <p className="text-sm text-brand-700">{error}</p>}
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Bestehende Produkte</h2>
              <p>Produkte aktivieren, deaktivieren oder als Angebot markieren.</p>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="dashboard-empty">Noch keine Produkte angelegt.</p>
          ) : (
            <div className="dashboard-list">
              {products.map((product) => (
                <article key={product.id} className="dashboard-list-item">
                  <div className="dashboard-list-head">
                    <div>
                      <p className="dashboard-item-title">{product.name}</p>
                      <p className="dashboard-item-subtitle">
                        {product.category} · {Number(product.price).toFixed(2)} € · {product.unit}
                        {product.isPromo ? " · Angebot" : ""}
                      </p>
                    </div>
                    <span className={`dashboard-status ${product.active ? "is-active" : "is-inactive"}`}>
                      {product.active ? "Aktiv" : "Inaktiv"}
                    </span>
                  </div>

                  <div className="dashboard-inline-actions">
                    <button type="button" onClick={() => togglePromo(product)} className="dashboard-ghost-btn">
                      {product.isPromo ? "Promo aus" : "Promo an"}
                    </button>
                    <button type="button" onClick={() => toggleActive(product)} className="dashboard-ghost-btn">
                      {product.active ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
