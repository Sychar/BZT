import { FormEvent, useState } from "react";
import Link from "next/link";
import { PageShell } from "../components/PageShell";
import { apiFetch } from "../lib/api";

type RequestType = "COMPANY" | "VENDOR";
type VendorType = "BAECKER" | "METZGER";

export default function RegisterRequestPage() {
  const [requestType, setRequestType] = useState<RequestType>("COMPANY");
  const [vendorType, setVendorType] = useState<VendorType>("BAECKER");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await apiFetch("/auth/registration-request", {
        method: "POST",
        body: JSON.stringify({
          requestType,
          vendorType: requestType === "VENDOR" ? vendorType : undefined,
          businessName,
          contactName,
          email,
          phone,
          address
        })
      });
      setSuccess(true);
      setBusinessName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setAddress("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Registrieren & Anfrage senden">
      <section className="dashboard-panel max-w-2xl">
        <div className="dashboard-panel-head">
          <div>
            <h2>Neue Anfrage</h2>
            <p>Firma oder Lieferant anfragen. Wir melden uns danach bei dir.</p>
          </div>
          <Link href="/login" className="dashboard-ghost-btn">
            Zum Login
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={`dashboard-ghost-btn ${requestType === "COMPANY" ? "is-active" : ""}`}
              onClick={() => setRequestType("COMPANY")}
            >
              Firma
            </button>
            <button
              type="button"
              className={`dashboard-ghost-btn ${requestType === "VENDOR" ? "is-active" : ""}`}
              onClick={() => setRequestType("VENDOR")}
            >
              Lieferant
            </button>
          </div>

          {requestType === "VENDOR" && (
            <div className="flex flex-wrap gap-3 rounded-xl border border-ink/10 bg-cream-soft p-3">
              <span className="text-sm text-ink/70">Typ</span>
              <button
                type="button"
                className={`dashboard-ghost-btn ${vendorType === "BAECKER" ? "is-active" : ""}`}
                onClick={() => setVendorType("BAECKER")}
              >
                Bäcker
              </button>
              <button
                type="button"
                className={`dashboard-ghost-btn ${vendorType === "METZGER" ? "is-active" : ""}`}
                onClick={() => setVendorType("METZGER")}
              >
                Metzger
              </button>
            </div>
          )}

          <label className="settings-field">
            <span>{requestType === "COMPANY" ? "Firmenname" : "Anbietername"}</span>
            <input
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              className="dashboard-text-input"
              required
            />
          </label>

          <label className="settings-field">
            <span>Ansprechpartner (Name)</span>
            <input
              value={contactName}
              onChange={(event) => setContactName(event.target.value)}
              className="dashboard-text-input"
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="settings-field">
              <span>E-Mail</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="dashboard-text-input"
                required
              />
            </label>

            <label className="settings-field">
              <span>Telefon</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="dashboard-text-input"
                required
              />
            </label>
          </div>

          <label className="settings-field">
            <span>Adresse</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="dashboard-text-input"
              placeholder="Straße, Hausnummer, PLZ, Ort"
              required
            />
          </label>

          {error && <p className="text-sm text-brand-700">{error}</p>}
          {success && (
            <p className="rounded-xl border border-forest/20 bg-forest/10 px-4 py-3 text-sm text-forest">
              Anfrage erfolgreich gesendet. Wir melden uns bei dir.
            </p>
          )}

          <button type="submit" className="dashboard-primary-btn" disabled={loading}>
            {loading ? "Sende Anfrage..." : "Anfrage senden"}
          </button>
        </form>
      </section>
    </PageShell>
  );
}
