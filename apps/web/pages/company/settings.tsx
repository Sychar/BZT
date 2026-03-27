import Link from "next/link";
import { PageShell } from "../../components/PageShell";

export default function CompanySettingsPage() {
  return (
    <PageShell>
      <div className="settings-shell">
        <section className="dashboard-hero">
          <div>
            <p className="dashboard-eyebrow">Firmenbereich</p>
            <h1>Firmen Einstellungen</h1>
            <p className="dashboard-hero-copy">
              Hier verwaltest du Basisdaten und Benachrichtigungen deiner Firma.
            </p>
          </div>
          <div className="dashboard-hero-actions">
            <Link href="/company/dashboard" className="dashboard-settings-btn">
              Zurück zum Dashboard
            </Link>
          </div>
        </section>

        <section className="dashboard-panel">
          <div className="dashboard-panel-head">
            <div>
              <h2>Profil</h2>
              <p>Diese Demo zeigt die Struktur für spätere API-Anbindung.</p>
            </div>
          </div>

          <div className="settings-grid">
            <div className="settings-field">
              <label>Firmenname</label>
              <input defaultValue="Firma XY" className="dashboard-text-input" />
            </div>
            <div className="settings-field">
              <label>Kontakt E-Mail</label>
              <input defaultValue="firma@example.com" className="dashboard-text-input" />
            </div>
            <div className="settings-field full-width">
              <label>Adresse</label>
              <input defaultValue="Hauptstrasse 10, 10115 Berlin" className="dashboard-text-input" />
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
