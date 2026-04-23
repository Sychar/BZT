import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { PageShell } from "../../components/PageShell";
import { apiFetch, API_URL } from "../../lib/api";
import { useCart } from "../../context/CartContext";
import { useAuth } from "../../context/AuthContext";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  isPromo: boolean;
  imageUrl?: string | null;
};

type Vendor = {
  id: string;
  name: string;
  type: "BAECKER" | "METZGER" | "RESTAURANT";
  address: string;
  products: Product[];
};

const toAssetUrl = (imageUrl?: string | null) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) return imageUrl;
  return `${API_URL}${imageUrl}`;
};

export default function VendorDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();
  const auth = useAuth();

  useEffect(() => {
    if (!id || Array.isArray(id)) return;
    apiFetch<Vendor>(`/vendors/${id}`, {}, auth.token)
      .then(setVendor)
      .catch((err) => setError((err as Error).message));
  }, [id, auth.token]);

  const grouped = useMemo(() => {
    if (!vendor) return {};
    return vendor.products.reduce<Record<string, Product[]>>((acc, product) => {
      const key = product.category;
      acc[key] = acc[key] ?? [];
      acc[key].push(product);
      return acc;
    }, {});
  }, [vendor]);

  const promos = useMemo(() => {
    if (!vendor) return [];
    return vendor.products.filter((product) => product.isPromo);
  }, [vendor]);

  if (!vendor) {
    return (
      <PageShell title="Anbieter">
        <p className="text-ink/70">{error ?? "Lade..."}</p>
      </PageShell>
    );
  }

  if (vendor.type === "RESTAURANT") {
    return (
      <PageShell title={vendor.name}>
        <div className="card p-6 space-y-3">
          <p className="text-sm text-ink/70">{vendor.address}</p>
          <p className="text-xs uppercase tracking-[0.2em] text-brand-600">Restaurant</p>
          <p className="text-ink/70">Für Restaurants gibt es eine eigene Menü-Ansicht.</p>
          <button
            onClick={() => router.push(`/restaurant/${vendor.id}`)}
            className="rounded-full bg-brand-500 px-4 py-2 text-paper text-sm font-semibold"
          >
            Zum Menü
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell title={vendor.name}>
      <div className="card p-6 space-y-2">
        <p className="text-sm text-ink/70">{vendor.address}</p>
        <p className="text-xs uppercase tracking-[0.2em] text-brand-600">
          {vendor.type === "BAECKER" ? "Bäckerei" : "Metzgerei"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {promos.length > 0 && (
            <div className="card p-6 space-y-4">
              <h2 className="text-xl font-display font-semibold">Tagesangebote</h2>
              <div className="space-y-3">
                {promos.map((product) => {
                  const image = toAssetUrl(product.imageUrl);
                  return (
                    <div key={product.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {image ? (
                          <img src={image} alt={product.name} className="h-12 w-12 rounded-lg border border-ink/10 object-cover" />
                        ) : null}
                        <div>
                          <p className="font-semibold">{product.name}</p>
                          <p className="text-sm text-ink/60">{product.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold">{Number(product.price).toFixed(2)} €</p>
                        <button
                          onClick={() => {
                            if (cart.vendorId && cart.vendorId !== vendor.id) {
                              cart.clear();
                            }
                            cart.setVendor(vendor.id);
                            cart.addItem({
                              productId: product.id,
                              name: product.name,
                              price: Number(product.price)
                            });
                          }}
                          className="rounded-full bg-brand-500 px-4 py-2 text-paper text-sm font-semibold"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category} className="card p-6 space-y-4">
              <h2 className="text-xl font-display font-semibold">{category}</h2>
              <div className="space-y-3">
                {items.map((product) => {
                  const image = toAssetUrl(product.imageUrl);
                  return (
                    <div key={product.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {image ? (
                          <img src={image} alt={product.name} className="h-12 w-12 rounded-lg border border-ink/10 object-cover" />
                        ) : null}
                        <div>
                          <p className="font-semibold">
                            {product.name} {product.isPromo ? "• Promo" : ""}
                          </p>
                          <p className="text-sm text-ink/60">{product.unit}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="font-semibold">{Number(product.price).toFixed(2)} €</p>
                        <button
                          onClick={() => {
                            if (cart.vendorId && cart.vendorId !== vendor.id) {
                              cart.clear();
                            }
                            cart.setVendor(vendor.id);
                            cart.addItem({
                              productId: product.id,
                              name: product.name,
                              price: Number(product.price)
                            });
                          }}
                          className="rounded-full bg-brand-500 px-4 py-2 text-paper text-sm font-semibold"
                        >
                          Hinzufügen
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="card p-6 space-y-4 h-fit">
          <h3 className="text-lg font-display font-semibold">Warenkorb</h3>
          {cart.items.length === 0 ? (
            <p className="text-ink/60 text-sm">Noch keine Artikel.</p>
          ) : (
            <div className="space-y-3">
              {cart.items.map((item) => (
                <div key={item.productId} className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-ink/60">x {item.qty}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-2 py-1 border border-ink/15 rounded"
                      onClick={() => cart.updateQty(item.productId, item.qty - 1)}
                    >
                      -
                    </button>
                    <button
                      className="px-2 py-1 border border-ink/15 rounded"
                      onClick={() => cart.updateQty(item.productId, item.qty + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
              <p className="text-sm text-ink/70">Gesamt: {cart.total.toFixed(2)} €</p>
              <button
                className="rounded-full bg-brand-500 px-4 py-2 text-paper text-sm font-semibold"
                onClick={() => router.push("/checkout")}
              >
                Zur Kasse
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
