import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { PageShell } from "../../components/PageShell";
import { apiFetch } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const auth = useAuth();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      });
      auth.setAuth(data.token, null);
      router.push("/admin/dashboard");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Admin-Login">
      <form onSubmit={handleSubmit} className="card p-6 max-w-xl space-y-4">
        <div>
          <label htmlFor="admin-email" className="text-sm text-ink/70">E-Mail</label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
          />
        </div>
        <div>
          <label htmlFor="admin-password" className="text-sm text-ink/70">Passwort</label>
          <input
            id="admin-password"
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
          />
        </div>
        {error && <p className="text-sm text-brand-700">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-full bg-brand-500 px-6 py-3 text-paper font-semibold"
        >
          {loading ? "Bitte warten..." : "Einloggen"}
        </button>
        <div className="flex flex-col gap-2 text-sm text-ink/70">
          <Link href="/login" className="hover:text-brand-600">
            Mitarbeiter Login
          </Link>
          <Link href="/login/vendor" className="hover:text-brand-600">
            Lieferant Login
          </Link>
          <Link href="/login/company" className="hover:text-brand-600">
            Firmen-Login
          </Link>
        </div>
      </form>
    </PageShell>
  );
}
