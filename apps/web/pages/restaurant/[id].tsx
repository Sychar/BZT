import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { useRouter } from "next/router";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

type Vendor = {
  id: string;
  name: string;
  address: string;
  partnership: "PARTNER" | "AD_ONLY";
  supportsReservations: boolean;
  type?: "RESTAURANT" | "BAECKER" | "METZGER";
};

type MenuItem = {
  id: string;
  name: string;
  price: string;
};

type Menu = {
  id: string;
  title: string;
  description?: string | null;
  date: string;
  items: MenuItem[];
};

export default function RestaurantPage() {
  const router = useRouter();
  const { id } = router.query;
  const auth = useAuth();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [orderTime, setOrderTime] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [partySize, setPartySize] = useState(2);
  const [reservationNote, setReservationNote] = useState("");
  const [orderItems, setOrderItems] = useState<Record<string, number>>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    apiFetch<Vendor>(`/vendors/${id}`, {}, auth.token)
      .then(setVendor)
      .catch((err) => setError((err as Error).message));
    apiFetch<Menu[]>(`/restaurants/${id}/menus`, {}, auth.token)
      .then(setMenus)
      .catch((err) => setError((err as Error).message));
  }, [id, auth.token]);

  const total = useMemo(() => {
    const priceMap = new Map<string, number>();
    menus.forEach((menu) =>
      menu.items.forEach((item) => priceMap.set(item.id, Number(item.price)))
    );
    return Object.entries(orderItems).reduce((sum, [itemId, qty]) => {
      return sum + (priceMap.get(itemId) ?? 0) * qty;
    }, 0);
  }, [orderItems, menus]);

  const submitOrder = async () => {
    if (!auth.token || !vendor) {
      setError("Bitte einloggen.");
      return;
    }
    const items = Object.entries(orderItems)
      .filter(([, qty]) => qty > 0)
      .map(([menuItemId, qty]) => ({ menuItemId, qty }));
    if (items.length === 0) {
      setError("Bitte mindestens ein Menü auswählen.");
      return;
    }
    if (!orderTime) {
      setError("Bitte Uhrzeit auswählen.");
      return;
    }
    setError(null);
    setSuccess(null);
    const isoTime = DateTime.fromISO(orderTime).toISO();
    if (!isoTime) {
      setError("Uhrzeit ungültig.");
      return;
    }
    try {
      await apiFetch(
        `/restaurants/${vendor.id}/orders`,
        {
          method: "POST",
          body: JSON.stringify({
            pickupTime: isoTime,
            note: orderNote,
            items
          })
        },
        auth.token
      );
      setSuccess("Vorbestellung wurde gesendet.");
      setOrderItems({});
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const submitReservation = async () => {
    if (!auth.token || !vendor) {
      setError("Bitte einloggen.");
      return;
    }
    if (!reservationTime) {
      setError("Bitte Uhrzeit auswählen.");
      return;
    }
    setError(null);
    setSuccess(null);
    const isoTime = DateTime.fromISO(reservationTime).toISO();
    if (!isoTime) {
      setError("Uhrzeit ungültig.");
      return;
    }
    try {
      await apiFetch(
        `/restaurants/${vendor.id}/reservations`,
        {
          method: "POST",
          body: JSON.stringify({
            reservationTime: isoTime,
            partySize,
            note: reservationNote
          })
        },
        auth.token
      );
      setSuccess("Reservierung wurde gesendet.");
      setReservationNote("");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <PageShell title={vendor ? vendor.name : "Restaurant"}>
      {!vendor && <p className="text-ink/70">{error ?? "Lade..."}</p>}
      {vendor && (
        <div className="space-y-6">
          <div className="card p-6 space-y-2">
            <p className="text-sm text-ink/70">{vendor.address}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-brand-600">
              {vendor.partnership === "PARTNER" ? "Partner-Restaurant" : "Werbung"}
            </p>
          </div>
          {vendor.type && vendor.type !== "RESTAURANT" && (
            <p className="text-ink/70">Dieser Anbieter ist kein Restaurant.</p>
          )}

          {menus.map((menu) => (
            <div key={menu.id} className="card p-6 space-y-3">
              <h2 className="text-xl font-display font-semibold">{menu.title}</h2>
              {menu.description && <p className="text-sm text-ink/70">{menu.description}</p>}
              <ul className="space-y-2 text-sm text-ink/80">
                {menu.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between">
                    <span>{item.name}</span>
                    <div className="flex items-center gap-3">
                      <span>{Number(item.price).toFixed(2)} €</span>
                      <input
                        type="number"
                        min={0}
                        value={orderItems[item.id] ?? 0}
                        onChange={(event) =>
                          setOrderItems((prev) => ({
                            ...prev,
                            [item.id]: Number(event.target.value)
                          }))
                        }
                        className="w-16 rounded bg-cream border border-ink/10 px-2 py-1"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {vendor.partnership === "PARTNER" && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="card p-6 space-y-3">
                <h3 className="text-lg font-display font-semibold">Vorbestellen</h3>
                <label className="text-sm text-ink/70">Abholzeit</label>
                <input
                  type="datetime-local"
                  value={orderTime}
                  onChange={(event) => setOrderTime(event.target.value)}
                  className="rounded bg-cream border border-ink/10 px-3 py-2"
                />
                <textarea
                  value={orderNote}
                  onChange={(event) => setOrderNote(event.target.value)}
                  placeholder="Notiz"
                  className="rounded bg-cream border border-ink/10 px-3 py-2"
                />
                <p className="text-sm text-ink/70">Gesamt: {total.toFixed(2)} €</p>
                <button
                  onClick={submitOrder}
                  className="rounded-full bg-brand-500 px-4 py-2 text-paper text-sm font-semibold"
                >
                  Vorbestellung senden
                </button>
              </div>

              {vendor.supportsReservations && (
                <div className="card p-6 space-y-3">
                  <h3 className="text-lg font-display font-semibold">Platz reservieren</h3>
                  <label className="text-sm text-ink/70">Uhrzeit</label>
                  <input
                    type="datetime-local"
                    value={reservationTime}
                    onChange={(event) => setReservationTime(event.target.value)}
                    className="rounded bg-cream border border-ink/10 px-3 py-2"
                  />
                  <label className="text-sm text-ink/70">Personen</label>
                  <input
                    type="number"
                    min={1}
                    value={partySize}
                    onChange={(event) => setPartySize(Number(event.target.value))}
                    className="rounded bg-cream border border-ink/10 px-3 py-2"
                  />
                  <textarea
                    value={reservationNote}
                    onChange={(event) => setReservationNote(event.target.value)}
                    placeholder="Notiz"
                    className="rounded bg-cream border border-ink/10 px-3 py-2"
                  />
                  <button
                    onClick={submitReservation}
                    className="rounded-full border border-ink/15 px-4 py-2 text-sm"
                  >
                    Reservierung senden
                  </button>
                </div>
              )}
            </div>
          )}

          {vendor.partnership !== "PARTNER" && (
            <p className="text-ink/70">Dieser Anbieter ist aktuell nur als Werbung gelistet.</p>
          )}
          {error && <p className="text-sm text-brand-700">{error}</p>}
          {success && <p className="text-sm text-forest">{success}</p>}
        </div>
      )}
    </PageShell>
  );
}
