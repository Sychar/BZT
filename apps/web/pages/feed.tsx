import { useEffect, useState } from "react";
import Link from "next/link";
import { DateTime } from "luxon";
import { PageShell } from "../components/PageShell";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

type MenuItem = {
  id: string;
  name: string;
  price: string;
};

type Vendor = {
  id: string;
  name: string;
  address: string;
  partnership: "PARTNER" | "AD_ONLY";
  supportsReservations: boolean;
};

type Menu = {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  vendor: Vendor;
  items: MenuItem[];
};

export default function FeedPage() {
  const auth = useAuth();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;
    apiFetch<Menu[]>("/feed/private", {}, auth.token)
      .then(setMenus)
      .catch((err) => setError((err as Error).message));
  }, [auth.token]);

  return (
    <PageShell title="Dein Feed">
      {auth.customerType !== "PRIVATE" && (
        <p className="text-ink/70">Der Feed ist für private Nutzer gedacht.</p>
      )}
      {error && <p className="text-sm text-brand-700">{error}</p>}
      <div className="space-y-6">
        {menus.map((menu) => (
          <div key={menu.id} className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-brand-600">
                  {DateTime.fromISO(menu.date).toFormat("dd.MM.yyyy")}
                </p>
                <h2 className="text-xl font-display font-semibold">{menu.title}</h2>
                {menu.description && <p className="text-sm text-ink/70">{menu.description}</p>}
              </div>
              <span className="text-xs border border-ink/15 px-3 py-1 rounded-full">
                {menu.vendor.partnership === "PARTNER" ? "Partner" : "Werbung"}
              </span>
            </div>
            <div>
              <p className="text-sm text-ink/70">{menu.vendor.name}</p>
              <p className="text-xs text-ink/60">{menu.vendor.address}</p>
            </div>
            <ul className="text-sm text-ink/80 space-y-1">
              {menu.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span>{Number(item.price).toFixed(2)} €</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/restaurant/${menu.vendor.id}`}
                className="rounded-full bg-brand-500 px-4 py-2 text-paper text-sm font-semibold"
              >
                Details
              </Link>
              {menu.vendor.supportsReservations && menu.vendor.partnership === "PARTNER" && (
                <span className="text-xs text-ink/60 self-center">
                  Reservierung möglich
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
