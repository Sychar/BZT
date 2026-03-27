import React, { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";

type Order = {
  id: string;
  pickupWindow: string;
  status: string;
  createdAt: string;
  vendor: { name: string };
  items: Array<{ id: string; qty: number; product: { name: string } }>;
};

export default function OrdersScreen() {
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
    <View style={styles.container}>
      <Text style={styles.title}>Bestellungen</Text>
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle}>{item.vendor?.name ?? "Anbieter"}</Text>
              <Text style={styles.status}>{item.status}</Text>
            </View>
            <Text style={styles.meta}>{item.pickupWindow}</Text>
            {item.items.map((orderItem) => (
              <Text key={orderItem.id} style={styles.item}>
                {orderItem.qty} × {orderItem.product?.name}
              </Text>
            ))}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: 16
  },
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12
  },
  error: {
    color: colors.danger,
    marginBottom: 8
  },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    borderRadius: radii.lg,
    marginBottom: 12
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardTitle: {
    color: colors.ink,
    fontWeight: "700"
  },
  status: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase"
  },
  meta: {
    color: colors.muted,
    marginTop: 4,
    marginBottom: 8
  },
  item: {
    color: colors.ink,
    fontSize: 12
  }
});
