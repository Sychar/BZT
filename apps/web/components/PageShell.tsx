import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";

export const PageShell: React.FC<{
  title?: string;
  hideHeader?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}> = ({
  title,
  hideHeader = false,
  fullWidth = false,
  children
}) => {
  const auth = useAuth();
  const cart = useCart();
  const router = useRouter();

  return (
    <div className="page-shell">
      {!hideHeader && (
        <header className="border-b border-ink/10 bg-paper/90 px-6 py-5 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="block h-14 w-40 shrink-0">
                <img src="/logo-bzt.svg" alt="B·Z·T bis zum tisch" className="h-full w-full object-contain" />
              </Link>
              <p className="hidden text-sm text-ink/65 md:block">
                Brotzeit & Mittagstisch digital vorbestellen.
              </p>
            </div>

            <nav className="flex flex-wrap items-center gap-3 text-sm">
              {!auth.token && (
                <Link href="/vendors" className="text-ink/80 transition hover:text-brand-600">
                  Anbieter entdecken
                </Link>
              )}

              {auth.role === "CUSTOMER" && auth.customerType === "EMPLOYEE" && (
                <>
                  <Link href="/orders" className="text-ink/80 transition hover:text-brand-600">
                    Bestellungen
                  </Link>
                  <Link href="/checkout" className="text-ink/80 transition hover:text-brand-600">
                    Warenkorb ({cart.items.length})
                  </Link>
                </>
              )}

              {auth.role === "COMPANY" && auth.companyId && (
                <Link href="/company/dashboard" className="text-ink/80 transition hover:text-brand-600">
                  Firmen-Dashboard
                </Link>
              )}

              {auth.role === "COMPANY" && !auth.companyId && (
                <Link href="/admin/dashboard" className="text-ink/80 transition hover:text-brand-600">
                  Admin-Dashboard
                </Link>
              )}

              {auth.role === "VENDOR" && auth.vendorId && (
                <>
                  <Link href="/vendor/dashboard" className="text-ink/80 transition hover:text-brand-600">
                    Dashboard
                  </Link>
                  {auth.vendorType !== "RESTAURANT" && (
                    <Link href="/vendor/products" className="text-ink/80 transition hover:text-brand-600">
                      Produkte
                    </Link>
                  )}
                  {auth.vendorType !== "RESTAURANT" && (
                    <Link href="/vendor/companies" className="text-ink/80 transition hover:text-brand-600">
                      Firmen
                    </Link>
                  )}
                  {auth.vendorType === "RESTAURANT" && (
                    <Link href="/vendor/menus" className="text-ink/80 transition hover:text-brand-600">
                      Menüs
                    </Link>
                  )}
                  {auth.vendorType !== "RESTAURANT" && (
                    <Link href="/vendor/orders" className="text-ink/80 transition hover:text-brand-600">
                      Bestellungen
                    </Link>
                  )}
                  {auth.vendorType !== "RESTAURANT" && (
                    <Link href="/vendor/invoices" className="text-ink/80 transition hover:text-brand-600">
                      Rechnungen
                    </Link>
                  )}
                </>
              )}

              {auth.token && auth.name && (
                <span className="text-ink/70">Hallo, {auth.name}</span>
              )}

              {!auth.token ? (
                <Link href="/login" className="btn-chip">
                  Login
                </Link>
              ) : (
                <button
                  onClick={() => {
                    auth.clearAuth();
                    router.push("/");
                  }}
                  className="btn-chip"
                >
                  Logout
                </button>
              )}
            </nav>
          </div>
        </header>
      )}

      <main className={fullWidth ? undefined : "px-6 py-10"}>
        <div className={fullWidth ? "space-y-8" : "mx-auto max-w-6xl space-y-8"}>
          {title && <h1 className="text-4xl font-display font-semibold tracking-wide text-ink">{title}</h1>}
          {children}
        </div>
      </main>
    </div>
  );
};
