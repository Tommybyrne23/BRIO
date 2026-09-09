import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { authClient } from "@/lib/auth-client";

export default function SignInScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await authClient.signIn.email({ email, password });
      if (error) {
        setError(error.message ?? "Sign in failed");
        return;
      }
      router.replace("/");
    } catch {
      setError("Something went wrong. Check your API URL and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        autoComplete="current-password"
        value={password}
        onChangeText={setPassword}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? "Signing in..." : "Sign in"}</Text>
      </Pressable>
      <Link href="/sign-up" style={styles.link}>
        No account? Sign up
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#111",
    borderRadius: 999,
    padding: 14,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#dc2626" },
  link: { marginTop: 16, textAlign: "center", textDecorationLine: "underline" },
});
