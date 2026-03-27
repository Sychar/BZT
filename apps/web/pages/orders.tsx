import { useEffect, useState } from "react";
import { PageShell } from "../components/PageShell";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";

type Order = {
  id: string;
  pickupWindow: string;
  status: string;
  createdAt: string;
  vendor: { name: string };
  items: Array<{ id: string; qty: number; product: { name: string } }>;
};

export default function OrdersPage() {
  const auth = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.token) return;
    apiFetch<Order[]>("/orders", {}, auth.token)
      .then(setOrders)
      .catch((err) => setError((err as Error).message));
  }, [auth.token]);

  return (
    <PageShell title="Bestellhistorie">
      {!auth.token && <p className="text-ink/70">Bitte einloggen, um Bestellungen zu sehen.</p>}
      {error && <p className="text-sm text-brand-700">{error}</p>}
      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order.id} className="card p-6 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{order.vendor?.name ?? "Anbieter"}</p>
                <p className="text-xs text-ink/60">
                  Abholung: {order.pickupWindow} · {new Date(order.createdAt).toLocaleString("de-DE")}
                </p>
              </div>
              <span className="rounded-full border border-ink/15 px-3 py-1 text-xs">
                {order.status}
              </span>
            </div>
            <ul className="text-sm text-ink/70">
              {order.items.map((item) => (
                <li key={item.id}>
                  {item.qty} × {item.product?.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

