import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "../lib/api";
import { colors, radii } from "../theme";

const pickupWindows = ["06:00-09:00", "09:00-12:00", "12:00-15:00"];

type Props = NativeStackScreenProps<RootStackParamList, "Checkout">;

export default function CheckoutScreen({ navigation }: Props) {
  const cart = useCart();
  const auth = useAuth();
  const [pickupWindow, setPickupWindow] = useState(pickupWindows[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!auth.token) {
      setError("Bitte einloggen.");
      return;
    }
    if (!cart.vendorId) {
      setError("Bitte wähle einen Anbieter.");
      return;
    }
    try {
      await apiFetch(
        "/orders",
        {
          method: "POST",
          body: JSON.stringify({
            vendorId: cart.vendorId,
            pickupWindow,
            note,
            items: cart.items.map((item) => ({
              productId: item.productId,
              qty: item.qty,
              itemNote: item.note
            }))
          })
        },
        auth.token
      );
      cart.clear();
      navigation.navigate("Orders");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Checkout</Text>
      <FlatList
        data={cart.items}
        keyExtractor={(item) => item.productId}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemName}>{item.name}</Text>
              <Text style={styles.itemMeta}>x {item.qty}</Text>
            </View>
            <TextInput
              placeholder="Notiz"
              placeholderTextColor={colors.muted}
              value={item.note ?? ""}
              onChangeText={(text) => cart.updateNote(item.productId, text)}
              style={styles.noteInput}
            />
          </View>
        )}
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.sectionTitle}>Abholfenster</Text>
            <View style={styles.windowRow}>
              {pickupWindows.map((window) => {
                const active = pickupWindow === window;
                return (
                  <TouchableOpacity
                    key={window}
                    onPress={() => setPickupWindow(window)}
                    style={[styles.windowButton, active && styles.windowButtonActive]}
                  >
                    <Text style={[styles.windowButtonText, active && styles.windowButtonTextActive]}>
                      {window}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              placeholder="Notiz zur Bestellung"
              placeholderTextColor={colors.muted}
              value={note}
              onChangeText={setNote}
              style={styles.input}
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity style={styles.primaryButton} onPress={submit}>
              <Text style={styles.primaryButtonText}>Bestellung abschicken</Text>
            </TouchableOpacity>
          </View>
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
  title: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 12
  },
  itemRow: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    padding: 12,
    borderRadius: radii.md,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10
  },
  itemName: {
    color: colors.ink,
    fontWeight: "700"
  },
  itemMeta: {
    color: colors.muted,
    fontSize: 12
  },
  noteInput: {
    backgroundColor: colors.field,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    color: colors.ink,
    width: 140
  },
  footer: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 14
  },
  sectionTitle: {
    color: colors.brand,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontWeight: "700",
    marginBottom: 8
  },
  windowRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap"
  },
  windowButton: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  windowButtonActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand
  },
  windowButtonText: {
    color: colors.ink,
    fontSize: 12
  },
  windowButtonTextActive: {
    color: colors.paper,
    fontWeight: "700"
  },
  input: {
    backgroundColor: colors.field,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    color: colors.ink,
    marginBottom: 12
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryButtonText: {
    color: colors.paper,
    fontWeight: "700"
  },
  error: {
    color: colors.danger,
    marginBottom: 8
  }
});
