import React, { createContext, useContext, useMemo, useState } from "react";

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
  addItem: (item: Omit<CartItem, "qty">, qty?: number, vendorId?: string) => void;
  updateQty: (productId: string, qty: number) => void;
  updateNote: (productId: string, note: string) => void;
  clear: () => void;
  total: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [vendorId, setVendorId] = useState<string | null>(null);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      vendorId,
      addItem: (item, qty = 1, nextVendorId) => {
        if (nextVendorId && vendorId && vendorId !== nextVendorId) {
          setItems([]);
        }
        if (nextVendorId) {
          setVendorId(nextVendorId);
        }
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
