import { useEffect, useMemo, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch, API_URL } from "../../lib/api";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string | number;
  unit: string;
  active: boolean;
  isPromo: boolean;
  imageUrl?: string | null;
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

type EditState = {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  active: boolean;
  isPromo: boolean;
  imageUrl: string | null;
};

const toAssetUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${API_URL}${imageUrl}`;
};

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

  const [editState, setEditState] = useState<EditState | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editUploadLoading, setEditUploadLoading] = useState(false);
  const [editRemoveImageLoading, setEditRemoveImageLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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

  const openEdit = (product: Product) => {
    setEditError(null);
    setEditImageFile(null);
    setEditState({
      id: product.id,
      name: product.name,
      category: product.category,
      price: String(product.price),
      unit: product.unit,
      active: product.active,
      isPromo: product.isPromo,
      imageUrl: product.imageUrl ?? null
    });
  };

  const closeEdit = () => {
    setEditState(null);
    setEditImageFile(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!auth.token || !editState) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await apiFetch(
        `/products/${editState.id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            name: editState.name,
            category: editState.category,
            price: Number(editState.price),
            unit: editState.unit,
            active: editState.active,
            isPromo: editState.isPromo
          })
        },
        auth.token
      );
      await load();
      closeEdit();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  const uploadEditImage = async () => {
    if (!auth.token || !editState || !editImageFile) return;
    setEditUploadLoading(true);
    setEditError(null);
    try {
      const formData = new FormData();
      formData.append("file", editImageFile);
      const updated = await apiFetch<Product>(
        `/vendor/products/${editState.id}/image`,
        {
          method: "POST",
          body: formData
        },
        auth.token
      );
      setEditState((prev) => (prev ? { ...prev, imageUrl: updated.imageUrl ?? null } : prev));
      setEditImageFile(null);
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditUploadLoading(false);
    }
  };

  const removeEditImage = async () => {
    if (!auth.token || !editState) return;
    setEditRemoveImageLoading(true);
    setEditError(null);
    try {
      const updated = await apiFetch<Product>(
        `/products/${editState.id}`,
        {
          method: "PUT",
          body: JSON.stringify({ imageUrl: null })
        },
        auth.token
      );
      setEditState((prev) => (prev ? { ...prev, imageUrl: updated.imageUrl ?? null } : prev));
      await load();
    } catch (err) {
      setEditError((err as Error).message);
    } finally {
      setEditRemoveImageLoading(false);
    }
  };

  const selectedImageUrl = useMemo(() => toAssetUrl(editState?.imageUrl), [editState?.imageUrl]);

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
              <p>Produkte bearbeiten, Bilder pflegen, aktivieren/deaktivieren und als Angebot markieren.</p>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="dashboard-empty">Noch keine Produkte angelegt.</p>
          ) : (
            <div className="dashboard-list">
              {products.map((product) => {
                const productImage = toAssetUrl(product.imageUrl);
                return (
                  <article key={product.id} className="dashboard-list-item">
                    <div className="dashboard-list-head">
                      <div className="flex items-center gap-3">
                        {productImage ? (
                          <img
                            src={productImage}
                            alt={product.name}
                            className="h-14 w-14 rounded-lg object-cover border border-ink/10"
                          />
                        ) : (
                          <div className="h-14 w-14 rounded-lg border border-dashed border-ink/20 bg-cream" />
                        )}
                        <div>
                          <p className="dashboard-item-title">{product.name}</p>
                          <p className="dashboard-item-subtitle">
                            {product.category} · {Number(product.price).toFixed(2)} EUR · {product.unit}
                            {product.isPromo ? " · Angebot" : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`dashboard-status ${product.active ? "is-active" : "is-inactive"}`}>
                        {product.active ? "Aktiv" : "Inaktiv"}
                      </span>
                    </div>

                    <div className="dashboard-inline-actions">
                      <button type="button" onClick={() => openEdit(product)} className="dashboard-ghost-btn">
                        Bearbeiten
                      </button>
                      <button type="button" onClick={() => togglePromo(product)} className="dashboard-ghost-btn">
                        {product.isPromo ? "Promo aus" : "Promo an"}
                      </button>
                      <button type="button" onClick={() => toggleActive(product)} className="dashboard-ghost-btn">
                        {product.active ? "Deaktivieren" : "Aktivieren"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {editState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">Produkt bearbeiten</h3>
              <button type="button" className="dashboard-ghost-btn" onClick={closeEdit}>
                Schließen
              </button>
            </div>

            {editError && <p className="mb-3 text-sm text-brand-700">{editError}</p>}

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="settings-field">
                <span>Name</span>
                <input
                  className="dashboard-text-input"
                  value={editState.name}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, name: event.target.value } : prev))}
                />
              </label>

              <label className="settings-field">
                <span>Einheit</span>
                <input
                  className="dashboard-text-input"
                  value={editState.unit}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, unit: event.target.value } : prev))}
                />
              </label>

              <label className="settings-field">
                <span>Kategorie</span>
                <select
                  className="dashboard-text-input"
                  value={editState.category}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, category: event.target.value } : prev))}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="settings-field">
                <span>Preis</span>
                <input
                  className="dashboard-text-input"
                  value={editState.price}
                  onChange={(event) => setEditState((prev) => (prev ? { ...prev, price: event.target.value } : prev))}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button
                type="button"
                className={`dashboard-ghost-btn ${editState.isPromo ? "is-active" : ""}`}
                onClick={() => setEditState((prev) => (prev ? { ...prev, isPromo: !prev.isPromo } : prev))}
              >
                {editState.isPromo ? "Angebot aktiv" : "Als Angebot markieren"}
              </button>
              <button
                type="button"
                className={`dashboard-ghost-btn ${editState.active ? "is-active" : ""}`}
                onClick={() => setEditState((prev) => (prev ? { ...prev, active: !prev.active } : prev))}
              >
                {editState.active ? "Produkt aktiv" : "Produkt inaktiv"}
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-ink/10 p-4">
              <p className="mb-2 text-sm font-medium text-ink/70">Produktbild</p>

              {selectedImageUrl ? (
                <img src={selectedImageUrl} alt={editState.name} className="mb-3 h-28 w-28 rounded-lg object-cover border border-ink/10" />
              ) : (
                <div className="mb-3 h-28 w-28 rounded-lg border border-dashed border-ink/20 bg-cream" />
              )}

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={(event) => setEditImageFile(event.target.files?.[0] ?? null)}
                  className="dashboard-text-input"
                />
                <button
                  type="button"
                  className="dashboard-primary-btn"
                  onClick={uploadEditImage}
                  disabled={!editImageFile || editUploadLoading}
                >
                  {editUploadLoading ? "Upload..." : "Bild hochladen"}
                </button>
                <button
                  type="button"
                  className="dashboard-ghost-btn"
                  onClick={removeEditImage}
                  disabled={!editState.imageUrl || editRemoveImageLoading}
                >
                  {editRemoveImageLoading ? "Entfernen..." : "Bild entfernen"}
                </button>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" className="dashboard-ghost-btn" onClick={closeEdit} disabled={editSaving}>
                Abbrechen
              </button>
              <button type="button" className="dashboard-primary-btn" onClick={saveEdit} disabled={editSaving}>
                {editSaving ? "Speichern..." : "Änderungen speichern"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
