import { useState } from "react";
import { useRouter } from "next/router";
import { PageShell } from "../components/PageShell";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

const pickupWindows = ["06:00-09:00", "09:00-12:00", "12:00-15:00"];

export default function CheckoutPage() {
  const cart = useCart();
  const auth = useAuth();
  const router = useRouter();
  const [pickupWindow, setPickupWindow] = useState(pickupWindows[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!auth.token) {
      setError("Bitte einloggen, um zu bestellen.");
      return;
    }
    if (!cart.vendorId) {
      setError("Bitte wähle zuerst einen Anbieter.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await apiFetch(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            vendorId: cart.vendorId,
            pickupWindow,
            note,
            items: cart.items.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              itemNote: item.note
            }))
          })
        },
        auth.token
      );
      cart.clear();
      router.push("/orders");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell title="Checkout">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="card p-6 space-y-4">
          <h2 className="text-xl font-display font-semibold">Deine Auswahl</h2>
          {cart.items.length === 0 ? (
            <p className="text-ink/60">Keine Artikel im Warenkorb.</p>
          ) : (
            <div className="space-y-4">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-ink/60">Menge: {item.qty}</p>
                  </div>
                  <input
                    value={item.note ?? ""}
                    onChange={(event) => cart.updateNote(item.productId, event.target.value)}
                    placeholder="Notiz (z.B. geschnitten)"
                    className="rounded-lg bg-cream border border-ink/10 px-3 py-2 text-sm"
                  />
                </div>
              ))}
              <p className="text-sm text-ink/70">
                Gesamt: {cart.total.toFixed(2)} €
              </p>
            </div>
          )}
        </div>
        <div className="card p-6 space-y-4 h-fit">
          <h2 className="text-xl font-display font-semibold">Abholfenster</h2>
          <div className="flex flex-col gap-2">
            {pickupWindows.map((window) => (
              <button
                key={window}
                onClick={() => setPickupWindow(window)}
                className={`rounded-full px-4 py-2 text-sm text-left ${
                  pickupWindow === window
                    ? "bg-brand-500 text-paper"
                    : "border border-ink/15"
                }`}
              >
                {window}
              </button>
            ))}
          </div>
          <div>
            <label className="text-sm text-ink/70">Notiz zur Bestellung</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 w-full rounded-lg bg-cream border border-ink/10 px-4 py-2"
            />
          </div>
          {error && <p className="text-sm text-brand-700">{error}</p>}
          <button
            onClick={handleSubmit}
            disabled={loading || cart.items.length === 0}
            className="rounded-full bg-brand-500 px-6 py-3 text-paper font-semibold"
          >
            {loading ? "Bitte warten..." : "Bestellung abschicken"}
          </button>
        </div>
      </div>
    </PageShell>
  );
}
