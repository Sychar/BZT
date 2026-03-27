import Link from "next/link";
import { PageShell } from "../../components/PageShell";

export default function VendorSettingsPage() {
  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Anbieterbereich</p>
            <h1>Bäcker Einstellungen</h1>
            <p className="dashboard-hero-copy">
              Hier pflegst du Ladeninfos, Abholzeiten und interne Hinweise.
            </p>
          </div>
          <div className="dashboard-hero-actions">
            <Link href="/vendor/dashboard" className="dashboard-settings-btn">
              Zurück zum Dashboard
            </Link>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Anbieter Profil</h2>
              <p>Diese Demo zeigt die Struktur für spätere API-Anbindung.</p>
            </div>
          </div>

          <div className="settings-grid">
            <div className="settings-field">
              <label>Anbietername</label>
              <input defaultValue="Bäckerei Sonnensemme" className="dashboard-text-input" />
            </div>
            <div className="settings-field">
              <label>Abhol-Cutoff</label>
              <input defaultValue="04:00" className="dashboard-text-input" />
            </div>
            <div className="settings-field full-width">
              <label>Adresse</label>
              <input defaultValue="Hauptstrasse 12, 10115 Berlin" className="dashboard-text-input" />
            </div>
          </div>

          <div className="settings-actions">
            <button type="button" className="dashboard-primary-btn">
              Speichern
            </button>
          </div>
        </section>
      </div>
    </PageShell>
  );
}
