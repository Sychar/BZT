import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { apiFetch } from "../lib/api";
import { useCart } from "../context/CartContext";
import { colors, radii } from "../theme";

type Product = {
  id: string;
  name: string;
  category: string;
  price: string;
  unit: string;
  isPromo: boolean;
};

type Vendor = {
  id: string;
  name: string;
  products: Product[];
};

type Props = NativeStackScreenProps<RootStackParamList, "VendorDetail">;

export default function VendorDetailScreen({ route, navigation }: Props) {
  const { vendorId } = route.params;
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cart = useCart();

  useEffect(() => {
    apiFetch<Vendor>(`/vendors/${vendorId}`)
      .then(setVendor)
      .catch((err) => setError((err as Error).message));
  }, [vendorId]);

  const grouped = useMemo(() => {
    if (!vendor) return [] as Array<[string, Product[]]>;
    const map = vendor.products.reduce<Record<string, Product[]>>((acc, product) => {
      const key = product.category;
      acc[key] = acc[key] ?? [];
      acc[key].push(product);
      return acc;
    }, {});
    return Object.entries(map);
  }, [vendor]);

  if (!vendor) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>{error ?? "Lade..."}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={grouped}
        keyExtractor={([category]) => category}
        renderItem={({ item: [category, items] }) => (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{category}</Text>
            {items.map((product) => (
              <View key={product.id} style={styles.row}>
                <View>
                  <Text style={styles.productName}>
                    {product.name} {product.isPromo ? "· Angebot" : ""}
                  </Text>
                  <Text style={styles.productMeta}>{product.unit}</Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.price}>{Number(product.price).toFixed(2)} €</Text>
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() =>
                      cart.addItem(
                        {
                          productId: product.id,
                          name: product.name,
                          price: Number(product.price)
                        },
                        1,
                        vendor.id
                      )
                    }
                  >
                    <Text style={styles.addButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.checkoutButton} onPress={() => navigation.navigate("Checkout")}>
            <Text style={styles.checkoutText}>Zum Checkout ({cart.items.length})</Text>
          </TouchableOpacity>
        }
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
  loading: {
    color: colors.muted,
    fontWeight: "600"
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 14
  },
  sectionTitle: {
    color: colors.brand,
    fontSize: 13,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    fontWeight: "700",
    marginBottom: 12
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  productName: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "700"
  },
  productMeta: {
    color: colors.muted,
    fontSize: 12
  },
  price: {
    color: colors.ink,
    fontWeight: "700"
  },
  addButton: {
    backgroundColor: colors.brand,
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  addButtonText: {
    color: colors.paper,
    fontWeight: "800"
  },
  checkoutButton: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
    marginBottom: 16
  },
  checkoutText: {
    color: colors.paper,
    fontWeight: "700"
  }
});
