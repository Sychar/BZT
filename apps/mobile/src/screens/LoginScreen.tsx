import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import BrandLogo from "../components/BrandLogo";
import { apiFetch } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { colors, radii } from "../theme";

type Props = NativeStackScreenProps<RootStackParamList, "Login">;

export default function LoginScreen({ navigation }: Props) {
  const auth = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyCode, setCompanyCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    try {
      const data = await apiFetch<{ token: string; vendorId?: string | null }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, companyCode })
      });
      auth.setAuth(data.token, data.vendorId ?? null, "CUSTOMER");
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <View style={styles.container}>
      <BrandLogo />
      <View style={styles.card}>
        <Text style={styles.title}>Mitarbeiter Login</Text>
        <TextInput
          placeholder="E-Mail"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
        />
        <TextInput
          placeholder="Passwort"
          placeholderTextColor={colors.muted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={styles.input}
        />
        <TextInput
          placeholder="Firmen-Code"
          placeholderTextColor={colors.muted}
          value={companyCode}
          onChangeText={setCompanyCode}
          style={styles.input}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
          <Text style={styles.primaryButtonText}>Einloggen</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.linkWrap} onPress={() => navigation.navigate("Register")}>
          <Text style={styles.link}>Noch kein Konto? Registrieren</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    backgroundColor: colors.paper,
    gap: 18
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: radii.lg,
    padding: 18,
    gap: 10
  },
  title: {
    fontSize: 25,
    color: colors.ink,
    fontWeight: "700",
    marginBottom: 4
  },
  input: {
    backgroundColor: colors.field,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: 12,
    color: colors.ink,
    marginBottom: 2
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radii.pill,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4
  },
  primaryButtonText: {
    color: colors.paper,
    fontWeight: "700"
  },
  linkWrap: {
    marginTop: 6
  },
  link: {
    color: colors.forest,
    textAlign: "center",
    fontWeight: "600"
  },
  error: {
    color: colors.danger,
    marginBottom: 2
  }
});
