import { useState } from "react";
import { useRouter } from "next/router";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type RoleOption = "CUSTOMER" | "VENDOR";

export default function RegisterPage() {
  const [role, setRole] = useState<RoleOption>("CUSTOMER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [vendorType, setVendorType] = useState<"BAECKER" | "METZGER" | "RESTAURANT">(
    "BAECKER"
  );
  const [vendorAddress, setVendorAddress] = useState("");
  const [vendorVisibility, setVendorVisibility] = useState<"PUBLIC" | "COMPANY_ONLY">(
    "PUBLIC"
  );
  const [vendorPartnership, setVendorPartnership] = useState<"PARTNER" | "AD_ONLY">("PARTNER");
  const [vendorCompanyCode, setVendorCompanyCode] = useState("");
  const [vendorSupportsReservations, setVendorSupportsReservations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (role === "CUSTOMER") {
        const data = await apiFetch<{ token: string }>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name,
            email,
            password,
            companyCode
          })
        });
        auth.setAuth(data.token, null);
        router.push("/vendors");
      } else {
        const data = await apiFetch<{ token: string; vendorId?: string | null }>(
          "/auth/register-vendor",
          {
            method: "POST",
            body: JSON.stringify({
              name,
              email,
              password,
              vendor: {
                name: vendorName,
                type: vendorType,
                address: vendorAddress,
                visibility: vendorVisibility,
                partnership: vendorPartnership,
                companyCode: vendorVisibility === "COMPANY_ONLY" ? vendorCompanyCode : undefined,
                supportsReservations: vendorSupportsReservations
              }
            })
          }
        );
        auth.setAuth(data.token, data.vendorId ?? null);
        router.push("/vendor/dashboard");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Registrieren">
      <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
        <div className="flex gap-4">
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${
              role === "CUSTOMER" ? "bg-brand-500 text-paper" : "border border-ink/15"
            }`}
            onClick={() => setRole("CUSTOMER")}
          >
            Mitarbeiter
          </button>
          <button
            type="button"
            className={`rounded-full px-4 py-2 text-sm ${
              role === "VENDOR" ? "bg-brand-500 text-paper" : "border border-ink/15"
            }`}
            onClick={() => setRole("VENDOR")}
          >
            Anbieter
          </button>
        </div>
        <div>
          <label className="text-sm text-ink/70">Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
            required
          />
        </div>
        <div>
          <label className="text-sm text-ink/70">E-Mail</label>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
            required
          />
        </div>
        <div>
          <label className="text-sm text-ink/70">Passwort</label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
            required
          />
        </div>

        {role === "CUSTOMER" && (
          <div className="space-y-3 border-t border-ink/10 pt-4">
            <div>
              <label className="text-sm text-ink/70">Firmen-Code</label>
              <input
                value={companyCode}
                onChange={(event) => setCompanyCode(event.target.value)}
                className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
                placeholder="FIRMA-XY"
                required
              />
              <p className="mt-2 text-xs text-ink/50">Den Code bekommst du direkt von deiner Firma.</p>
            </div>
          </div>
        )}

        {role === "VENDOR" && (
          <div className="space-y-4 border-t border-ink/10 pt-4">
            <div>
              <label className="text-sm text-ink/70">Anbieter-Name</label>
              <input
                value={vendorName}
                onChange={(event) => setVendorName(event.target.value)}
                className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
                required
              />
            </div>
            <div className="flex gap-4">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorType === "BAECKER"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorType("BAECKER")}
              >
                Bäcker
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorType === "METZGER"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorType("METZGER")}
              >
                Metzger
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorType === "RESTAURANT"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorType("RESTAURANT")}
              >
                Restaurant
              </button>
            </div>
            <div>
              <label className="text-sm text-ink/70">Adresse</label>
              <input
                value={vendorAddress}
                onChange={(event) => setVendorAddress(event.target.value)}
                className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
                required
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorVisibility === "PUBLIC"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorVisibility("PUBLIC")}
              >
                Public
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorVisibility === "COMPANY_ONLY"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorVisibility("COMPANY_ONLY")}
              >
                Nur Firma
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorPartnership === "PARTNER"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorPartnership("PARTNER")}
              >
                Partner
              </button>
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorPartnership === "AD_ONLY"
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorPartnership("AD_ONLY")}
              >
                Nur Werbung
              </button>
            </div>
            {vendorVisibility === "COMPANY_ONLY" && (
              <div>
                <label className="text-sm text-ink/70">Firmen-Code</label>
                <input
                  value={vendorCompanyCode}
                  onChange={(event) => setVendorCompanyCode(event.target.value)}
                  className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
                  required
                />
              </div>
            )}
            {vendorType === "RESTAURANT" && (
              <button
                type="button"
                className={`rounded-full px-4 py-2 text-sm ${
                  vendorSupportsReservations
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
                onClick={() => setVendorSupportsReservations((prev) => !prev)}
              >
                {vendorSupportsReservations ? "Reservierung aktiv" : "Reservierung erlauben"}
              </button>
            )}
          </div>
        )}

        {error && <p className="text-sm text-brand-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-brand-500 px-6 py-3 text-paper font-semibold"
        >
          {loading ? "Bitte warten..." : "Konto erstellen"}
        </button>
      </form>
    </PageShell>
  );
}
