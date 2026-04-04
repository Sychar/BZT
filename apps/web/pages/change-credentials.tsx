import { useState } from "react";
import { useRouter } from "next/router";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function ChangeCredentialsPage() {
  const auth = useAuth();
  const router = useRouter();
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!auth.token) return;

    if (newPassword !== confirmPassword) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Passwort muss mindestens 6 Zeichen haben.");
      return;
    }
    if (!newUsername.trim()) {
      setError("Benutzername darf nicht leer sein.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await apiFetch(
        "/auth/change-password",
        {
          method: "POST",
          body: JSON.stringify({ newEmail: newUsername.trim(), newPassword })
        },
        auth.token
      );
      router.push("/vendors");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!auth.token) {
    return (
      <div className="login-screen">
        <main className="login-main">
          <section className="login-card">
            <p>Bitte zuerst einloggen.</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="login-screen">
      <main className="login-main">
        <section className="login-card" aria-label="Zugangsdaten ändern">
          <h1 className="login-title">Zugangsdaten ändern</h1>
          <p className="login-subtitle">
            Bitte wähle beim ersten Login einen neuen Benutzernamen und ein neues Passwort.
          </p>

          <form onSubmit={handleSubmit} className="login-form login-form-enter">
            <label className="login-label">
              Neuer Benutzername
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                className="login-input"
                placeholder="Dein neuer Benutzername"
              />
            </label>

            <label className="login-label">
              Neues Passwort
              <input
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="login-input"
                placeholder="Mindestens 6 Zeichen"
              />
            </label>

            <label className="login-label">
              Passwort bestätigen
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="login-input"
                placeholder="Passwort wiederholen"
              />
            </label>

            {error && <p className="login-error">{error}</p>}

            <button type="submit" disabled={loading} className="login-submit-btn">
              {loading ? "Bitte warten..." : "Zugangsdaten speichern"}
            </button>
          </form>
        </section>
      </main>

      <footer className="login-footer">
        BZT · Brotzeit & Mittag digital
      </footer>
    </div>
  );
}
