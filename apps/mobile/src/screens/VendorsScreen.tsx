import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList
} from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { colors, radii } from "../theme";

type Vendor = {
  id: string;
  name: string;
  type: "BAECKER" | "METZGER";
  address: string;
};

type Props = NativeStackScreenProps<RootStackParamList, "Vendors">;

export default function VendorsScreen({ navigation }: Props) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const auth = useAuth();
  const cart = useCart();

  const load = async () => {
    try {
      const query = q ? `?q=${encodeURIComponent(q)}` : "";
      const data = await apiFetch<Vendor[]>(`/vendors${query}`);
      setVendors(data);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title}>Anbieter</Text>
        <TouchableOpacity style={styles.logoutButton} onPress={() => auth.clearAuth()}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        placeholder="Suche nach Bäckerei, Metzgerei..."
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={load}
        style={styles.input}
      />

      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("Orders")}>
          <Text style={styles.secondaryButtonText}>Bestellungen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("Checkout")}>
          <Text style={styles.secondaryButtonText}>Warenkorb ({cart.items.length})</Text>
        </TouchableOpacity>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <FlatList
        data={vendors}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() =>
              navigation.navigate("VendorDetail", { vendorId: item.id, vendorName: item.name })
            }
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardSubtitle}>
              {item.type === "BAECKER" ? "Bäckerei" : "Metzgerei"}
            </Text>
            <Text style={styles.cardAddress}>{item.address}</Text>
          </TouchableOpacity>
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
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12
  },
  title: {
    color: colors.ink,
    fontSize: 25,
    fontWeight: "700"
  },
  logoutButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.card
  },
  logoutText: {
    color: colors.ink,
    fontWeight: "600"
  },
  input: {
    backgroundColor: colors.field,
    borderRadius: radii.md,
    padding: 12,
    color: colors.ink,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12
  },
  secondaryButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingVertical: 8,
    paddingHorizontal: 14
  },
  secondaryButtonText: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: "600"
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
  cardTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: "700"
  },
  cardSubtitle: {
    color: colors.brand,
    fontSize: 12,
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 1
  },
  cardAddress: {
    color: colors.muted,
    marginTop: 4,
    fontSize: 12
  }
});
