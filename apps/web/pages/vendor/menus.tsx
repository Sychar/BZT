import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { PageShell } from "../../components/PageShell";
import { useAuth } from "../../context/AuthContext";
import { apiFetch } from "../../lib/api";

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

export default function VendorMenusPage() {
  const auth = useAuth();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [date, setDate] = useState(DateTime.now().toISODate() ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [itemDrafts, setItemDrafts] = useState<Record<string, { name: string; price: string }>>({});

  const load = async () => {
    if (!auth.token) return;
    try {
      setError(null);
      const data = await apiFetch<Menu[]>(`/vendor/menus?date=${date}`, {}, auth.token);
      setMenus(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, [auth.token, date]);

  const createMenu = async () => {
    if (!auth.token) return;
    try {
      setError(null);
      await apiFetch(
        "/vendor/menus",
        {
          method: "POST",
          body: JSON.stringify({ date, title, description })
        },
        auth.token
      );
      setTitle("");
      setDescription("");
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const addItem = async (menuId: string) => {
    if (!auth.token) return;
    const draft = itemDrafts[menuId];
    if (!draft?.name || !draft.price) return;
    try {
      setError(null);
      await apiFetch(
        `/vendor/menus/${menuId}/items`,
        {
          method: "POST",
          body: JSON.stringify({ name: draft.name, price: Number(draft.price) })
        },
        auth.token
      );
      setItemDrafts((prev) => ({ ...prev, [menuId]: { name: "", price: "" } }));
      await load();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <PageShell title="Tagesmenüs">
      {error && <p className="text-sm text-brand-700">{error}</p>}
      <div className="card p-6 space-y-4">
        <h2 className="text-lg font-display font-semibold">Neues Menü</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="rounded-lg bg-cream border border-ink/10 px-4 py-2"
          />
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Titel (z.B. Mittagstisch)"
            className="rounded-lg bg-cream border border-ink/10 px-4 py-2"
          />
        </div>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Beschreibung"
          className="rounded-lg bg-cream border border-ink/10 px-4 py-2"
        />
        <button
          onClick={createMenu}
          className="rounded-full bg-brand-500 px-4 py-2 text-paper font-semibold"
        >
          Menü anlegen
        </button>
      </div>

      <div className="space-y-4">
        {menus.map((menu) => (
          <div key={menu.id} className="card p-6 space-y-3">
            <div>
              <h3 className="text-lg font-display font-semibold">{menu.title}</h3>
              {menu.description && <p className="text-sm text-ink/70">{menu.description}</p>}
            </div>
            <ul className="text-sm text-ink/80 space-y-1">
              {menu.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>{item.name}</span>
                  <span>{Number(item.price).toFixed(2)} €</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <input
                value={itemDrafts[menu.id]?.name ?? ""}
                onChange={(event) =>
                  setItemDrafts((prev) => ({
                    ...prev,
                    [menu.id]: { name: event.target.value, price: prev[menu.id]?.price ?? "" }
                  }))
                }
                placeholder="Neues Item"
                className="rounded-lg bg-cream border border-ink/10 px-4 py-2"
              />
              <input
                value={itemDrafts[menu.id]?.price ?? ""}
                onChange={(event) =>
                  setItemDrafts((prev) => ({
                    ...prev,
                    [menu.id]: { name: prev[menu.id]?.name ?? "", price: event.target.value }
                  }))
                }
                placeholder="Preis"
                className="rounded-lg bg-cream border border-ink/10 px-4 py-2"
              />
              <button
                onClick={() => addItem(menu.id)}
                className="rounded-full border border-ink/15 px-4 py-2 text-sm"
              >
                Item hinzufügen
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
