import { useEffect, useState } from "react";
import Link from "next/link";
import { PageShell } from "../../components/PageShell";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

type Vendor = {
  id: string;
  name: string;
  type: "BAECKER" | "METZGER" | "RESTAURANT";
  address: string;
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "BAECKER" | "METZGER">("");
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();

  const isEmployee = auth.customerType === "EMPLOYEE";

  const load = async () => {
    try {
      setError(null);
      const query = new URLSearchParams();
      if (q) query.set("q", q);
      if (type) query.set("type", type);

      const path = isEmployee ? `/vendors/company?${query.toString()}` : `/vendors/public?${query.toString()}`;
      const data = await apiFetch<Vendor[]>(path, {}, auth.token);
      setVendors(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, [auth.token, isEmployee]);

  useEffect(() => {
    const timer = setTimeout(() => {
      load();
    }, 300);
    return () => clearTimeout(timer);
  }, [q, type, auth.token, isEmployee]);

  return (
    <PageShell title="Anbieter entdecken">
      <div className="card p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="text-sm text-ink/70">Suche</label>
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
              placeholder="Bäckerei, Metzgerei, ..."
            />
          </div>
          <div className="flex gap-3">
            {(["", "BAECKER", "METZGER"] as const).map((option) => (
              <button
                key={option || "all"}
                onClick={() => {
                  setType(option);
                }}
                className={`rounded-full px-4 py-2 text-sm ${
                  type === option ? "bg-brand-500 text-paper" : "border border-ink/15"
                }`}
              >
                {option === "" ? "Alle" : option === "BAECKER" ? "Bäcker" : "Metzger"}
              </button>
            ))}
            <button
              onClick={() => load()}
              className="rounded-full bg-cream border border-ink/15 px-4 py-2 text-sm"
            >
              Aktualisieren
            </button>
          </div>
        </div>
        {error && <p className="text-brand-700 text-sm">{error}</p>}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {vendors.map((vendor) => (
          <Link key={vendor.id} href={`/vendor/${vendor.id}`} className="card p-6 space-y-2">
            <p className="text-xs text-brand-600 uppercase tracking-[0.2em]">
              {vendor.type === "BAECKER"
                ? "Bäckerei"
                : vendor.type === "METZGER"
                ? "Metzgerei"
                : "Restaurant"}
            </p>
            <h2 className="text-xl font-display font-semibold">{vendor.name}</h2>
            <p className="text-sm text-ink/70">{vendor.address}</p>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
