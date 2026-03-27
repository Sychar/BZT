import Link from "next/link";
import { useEffect, useState } from "react";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type CompanySummary = {
  company: { id: string; name: string; code: string; isActive: boolean };
};

type TileIcon = "management" | "costs" | "employees" | "suppliers";

type Tile = {
  href: string;
  title: string;
  description: string;
  icon: TileIcon;
};

const tiles: Tile[] = [
  {
    href: "/company/management",
    title: "Verwaltung",
    description: "Firmenprofil und Basisdaten im Überblick.",
    icon: "management"
  },
  {
    href: "/company/costs",
    title: "Kosten/Rechnungen",
    description: "Monatsübersicht mit Summen und CSV-Export.",
    icon: "costs"
  },
  {
    href: "/company/employees",
    title: "Mitarbeiter",
    description: "Zugangsdaten erstellen, Mitarbeiterliste und Invite-Codes verwalten.",
    icon: "employees"
  },
  {
    href: "/company/suppliers",
    title: "Lieferanten",
    description: "Alle Lieferanten-Verbindungen mit Status sehen.",
    icon: "suppliers"
  }
];

const renderIcon = (icon: TileIcon) => {
  if (icon === "management") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.5-2.3.8a7.3 7.3 0 0 0-1.7-1l-.3-2.4h-4l-.3 2.4a7.3 7.3 0 0 0-1.7 1L6.2 6l-2 3.5 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.5 2.3-.8a7.3 7.3 0 0 0 1.7 1l.3 2.4h4l.3-2.4a7.3 7.3 0 0 0 1.7-1l2.3.8 2-3.5-2-1.5c.1-.3.1-.7.1-1z" />
      </svg>
    );
  }

  if (icon === "costs") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 19V5h16v14z" />
        <path d="M8 9h8M8 12h8M8 15h5" />
      </svg>
    );
  }

  if (icon === "employees") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="9" r="3" />
        <path d="M3.5 18a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="10" r="2.5" />
        <path d="M14.5 18a4.5 4.5 0 0 1 6 0" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 20V8l6-3v15" />
      <path d="M10 20V5l10 3v12" />
      <path d="M14 11h2M14 14h2M6.5 12h1.5M6.5 15h1.5" />
    </svg>
  );
};

export default function CompanyDashboardPage() {
  const auth = useAuth();
  const [summary, setSummary] = useState<CompanySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;

    apiFetch<CompanySummary>("/company/dashboard", {}, auth.token)
      .then(setSummary)
      .catch((err) => setError((err as Error).message));
  }, [auth.token]);

  return (
    <PageShell>
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && (
        <div className="vendor-home-shell">
          <section className="dashboard-hero vendor-home-hero">
            <div>
              <p className="dashboard-eyebrow">Firmenbereich</p>
              <h1>{summary?.company.name ?? "Firmen-Dashboard"}</h1>
              <p className="dashboard-hero-copy">
                {summary ? `Firmen-Code: ${summary.company.code}` : "Verwaltung, Kosten, Mitarbeiter und Lieferanten."}
              </p>
            </div>
          </section>

          {error && <p className="text-sm text-brand-700">{error}</p>}

          <section className="vendor-home-grid" aria-label="Firmen-Dashboard Bereiche">
            {tiles.map((tile, index) => (
              <Link
                href={tile.href}
                key={tile.href}
                className={`vendor-home-tile ${index === 0 ? "is-highlight" : ""}`}
              >
                <span className="vendor-home-icon" aria-hidden="true">
                  {renderIcon(tile.icon)}
                </span>
                <h2>{tile.title}</h2>
                <p>{tile.description}</p>
              </Link>
            ))}
          </section>
        </div>
      )}
    </PageShell>
  );
}
