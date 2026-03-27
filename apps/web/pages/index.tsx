import Link from "next/link";
import { PageShell } from "../components/PageShell";

const processSteps = [
  {
    title: "Mitarbeiter registrieren",
    text: "Mitarbeiter nutzen den Firmen-Code für eine saubere Firmen-Zuordnung."
  },
  {
    title: "Anbieter anfragen",
    text: "Bäcker oder Metzger senden über den Firmen-Code eine Verbindungsanfrage."
  },
  {
    title: "Admin-Freigabe",
    text: "Der neutrale Plattform-Admin bestätigt die Anfrage und schaltet die Verbindung frei."
  }
];

const advantages = [
  {
    title: "Für Bäcker",
    text: "Planbare Mengen, weniger Leerlauf und klare Abholzeiten pro Firma."
  },
  {
    title: "Für Firmen",
    text: "Ein zentraler Firmen-Code, saubere Freigaben und transparente Bestellwege."
  },
  {
    title: "Für Mitarbeiter",
    text: "Schnelle Vorbestellung ohne Warteschlange und einfache Zuordnung zur Firma."
  }
];

const practiceVoices = [
  {
    text: "Die Ergebnisse sind sehr zufriedenstellend. Unser Team kann jetzt klar planen.",
    name: "Ralph Edwards",
    role: "Firmenkunde"
  },
  {
    text: "Der Service ist sehr gut und freundlich. Die Vorbestellung funktioniert stabil.",
    name: "Leslie Aleksander",
    role: "Anbieter"
  }
];

export default function Home() {
  return (
    <PageShell hideHeader fullWidth>
      <header className="landing-header">
        <div className="landing-header-inner">
          <Link href="/" className="landing-logo">
            <img src="/logo-bzt.svg" alt="B·Z·T bis zum tisch" />
          </Link>
          <nav className="landing-nav">
            <Link href="/login" className="landing-login-link">
              <svg viewBox="0 0 24 24" className="login-icon" aria-hidden="true">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4.2 3.6-7 8-7s8 2.8 8 7" />
              </svg>
              <span>Login</span>
            </Link>
          </nav>
        </div>
      </header>

      <div className="landing-shell">
        <section className="hero-banner">
          <img src="/bild2.jpg" alt="Bäckerei und Metzgerei" className="hero-banner-image" />
          <div className="hero-banner-overlay">
            <h1>Wir bringen Brotzeit und Mittag digital bis zum Tisch.</h1>
            <p>
              Firmen, Mitarbeiter und Anbieter arbeiten in einem klaren Ablauf zusammen:
              vorbestellen, freigeben, abholen.
            </p>
            <div className="hero-banner-actions">
              <Link href="/register" className="btn-primary">
                Jetzt starten
              </Link>
              <Link href="/vendors" className="btn-secondary">
                Anbieter entdecken
              </Link>
            </div>
          </div>
        </section>

        <section className="process-split">
          <div className="process-left">
            <h2>So läuft der Ablauf</h2>
            <ol>
              {processSteps.map((step, index) => (
                <li key={step.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="process-right">
            <img src="/Bild3.jpg" alt="Ablauf und Team" />
          </div>
        </section>

        <section className="benefits-section">
          <h2>Unsere Vorteile für Bäcker, Firmen und Mitarbeiter</h2>
          <div className="benefits-grid">
            {advantages.map((item) => (
              <article key={item.title} className="benefits-item">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="support-section">
          <div className="support-copy">
            <h2>Wir unterstützen Bäcker, Metzgerei und Lokale</h2>
            <p>
              Mit digitaler Vorbestellung, Firmen-Code und neutraler Admin-Freigabe verbinden wir
              Anbieter und Firmen in einem klaren Ablauf.
            </p>
            <ul>
              <li>Weniger Stress im Morgenbetrieb durch vorgeplante Mengen.</li>
              <li>Saubere Zuordnung von Mitarbeitern über den Firmen-Code.</li>
              <li>Lokale Anbieter bleiben sichtbar und erhalten stabile Bestellströme.</li>
            </ul>
          </div>
          <div className="support-media">
            <img src="/bild2.jpg" alt="Bäckerei und lokale Anbieter" />
          </div>
        </section>

        <section className="practice-section">
          <div className="practice-head">
            <h2>Meinungen aus der Praxis über uns</h2>
            <div className="practice-arrows" aria-hidden="true">
              <span>&larr;</span>
              <span>&rarr;</span>
            </div>
          </div>
          <div className="practice-grid">
            {practiceVoices.map((voice) => (
              <article key={voice.name} className="practice-card">
                <p className="quote-mark">&ldquo;</p>
                <p className="voice-text">{voice.text}</p>
                <footer>
                  <span className="voice-name">{voice.name}</span>
                  <span className="voice-role">{voice.role}</span>
                </footer>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <h2>Bereit für den Start?</h2>
          <p>Starte jetzt mit Firmen-Code, Anbieter-Freigabe und digitaler Vorbestellung.</p>
          <Link href="/register" className="btn-primary">
            Kostenlos registrieren
          </Link>
        </section>
      </div>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="footer-brand">
            <h3>Bis zum Tisch gmah</h3>
            <p>
              Digitale Vorbestellung für Firmen, Mitarbeiter und Anbieter. Einfach, lokal und
              planbar.
            </p>
          </div>

          <div className="footer-links">
            <h4>Social Media</h4>
            <a href="#" aria-label="Instagram">
              Instagram
            </a>
            <a href="#" aria-label="LinkedIn">
              LinkedIn
            </a>
            <a href="#" aria-label="Facebook">
              Facebook
            </a>
          </div>

          <div className="footer-contact">
            <h4>Kontakt</h4>
            <p>kontakt@biszumtisch.de</p>
            <p>+49 40 1234 5678</p>
            <p>Hamburg, Deutschland</p>
          </div>
        </div>
      </footer>
    </PageShell>
  );
}
