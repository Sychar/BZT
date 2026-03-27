import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  note?: string;
};

type CartContextValue = {
  items: CartItem[];
  vendorId: string | null;
  addItem: (item: Omit<CartItem, "qty">, qty?: number) => void;
  setVendor: (vendorId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  updateNote: (productId: string, note: string) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  total: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("cart_items");
    const storedVendor = localStorage.getItem("cart_vendorId");
    if (stored) {
      setItems(JSON.parse(stored));
    }
    if (storedVendor) {
      setVendorId(storedVendor);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("cart_items", JSON.stringify(items));
    if (vendorId) {
      localStorage.setItem("cart_vendorId", vendorId);
    } else {
      localStorage.removeItem("cart_vendorId");
    }
  }, [items, vendorId]);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      vendorId,
      addItem: (item, qty = 1) => {
        setItems((prev) => {
          const existing = prev.find((i) => i.productId === item.productId);
          if (existing) {
            return prev.map((i) =>
              i.productId === item.productId ? { ...i, qty: i.qty + qty } : i
            );
          }
          return [...prev, { ...item, qty }];
        });
      },
      setVendor: (nextVendorId) => {
        setVendorId(nextVendorId);
      },
      updateQty: (productId, qty) => {
        setItems((prev) =>
          prev
            .map((item) => (item.productId === productId ? { ...item, qty } : item))
            .filter((item) => item.qty > 0)
        );
      },
      updateNote: (productId, note) => {
        setItems((prev) =>
          prev.map((item) => (item.productId === productId ? { ...item, note } : item))
        );
      },
      removeItem: (productId) => {
        setItems((prev) => prev.filter((item) => item.productId !== productId));
      },
      clear: () => {
        setItems([]);
        setVendorId(null);
      },
      total: items.reduce((sum, item) => sum + item.price * item.qty, 0)
    }),
    [items, vendorId]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within CartProvider");
  }
  return ctx;
};
