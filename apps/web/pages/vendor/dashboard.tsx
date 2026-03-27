import Link from "next/link";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";

type TileIcon = "products" | "companies" | "orders" | "invoices";

type Tile = {
  href: string;
  title: string;
  description: string;
  icon: TileIcon;
};

const tiles: Tile[] = [
  {
    href: "/vendor/products",
    title: "Produkte",
    description: "Menü-Dateien hochladen, Produkte pflegen und Excel importieren.",
    icon: "products"
  },
  {
    href: "/vendor/companies",
    title: "Firmen",
    description: "Verbundene Firmen verwalten und neue Anfragen senden.",
    icon: "companies"
  },
  {
    href: "/vendor/orders",
    title: "Bestellungen",
    description: "Aktuelle Bestellungen und Historie einsehen.",
    icon: "orders"
  },
  {
    href: "/vendor/invoices",
    title: "Rechnungen",
    description: "Summen prüfen und CSV/PDF exportieren.",
    icon: "invoices"
  }
];

const renderIcon = (icon: TileIcon) => {
  if (icon === "products") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 8.5h16v10.5H4z" />
        <path d="M8 8.5v-2A2.5 2.5 0 0 1 10.5 4h3A2.5 2.5 0 0 1 16 6.5v2" />
      </svg>
    );
  }

  if (icon === "companies") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V8l6-3v15" />
        <path d="M10 20V5l10 3v12" />
        <path d="M14 11h2M14 14h2M6.5 12h1.5M6.5 15h1.5" />
      </svg>
    );
  }

  if (icon === "orders") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 4h12v16H6z" />
        <path d="M9 8h6M9 12h6M9 16h4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="M4 10h16M8 14h4" />
    </svg>
  );
};

export default function VendorDashboardPage() {
  const auth = useAuth();

  return (
    <PageShell>
      {!auth.token && <p className="text-ink/70">Bitte einloggen.</p>}

      {auth.token && (
        <div className="vendor-home-shell">
          <section className="dashboard-hero vendor-home-hero">
            <div>
              <p className="dashboard-eyebrow">Anbieterbereich</p>
              <h1>Bäcker & Anbieter Dashboard</h1>
              <p className="dashboard-hero-copy">
                Wähle einen Bereich: Produkte, Firmen, Bestellungen oder Rechnungen.
              </p>
            </div>
          </section>

          <section className="vendor-home-grid" aria-label="Dashboard Bereiche">
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
