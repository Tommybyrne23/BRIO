import { useState } from "react";
import { Text, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { authClient } from "@/lib/auth-client";

const STEP_COUNT_TYPE = "HKQuantityTypeIdentifierStepCount";

function randomFakeStepSample() {
  const now = new Date();
  const start = new Date(now.getTime() - 15 * 60 * 1000); // 15 minutes ago
  return {
    sampleType: STEP_COUNT_TYPE,
    value: Math.floor(Math.random() * 500) + 50,
    unit: "count",
    startDate: start.toISOString(),
    endDate: now.toISOString(),
    sourceName: "briomobile (fake)",
  };
}

export default function Index() {
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  if (isPending) {
    return (
      <View style={styles.container}>
        <ActivityIndicator />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/sign-in" />;
  }

  async function sendFakeSample() {
    setSending(true);
    setStatus(null);
    try {
      // authClient.$fetch's baseURL is scoped to better-auth's own "/api/auth" routes,
      // so this must be an absolute URL to reach a plain app API route instead
      // (better-fetch uses an absolute URL as-is, bypassing that base path) — the
      // Expo client's fetch plugin still attaches the stored session cookie regardless.
      const { error } = await authClient.$fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/health-samples`, {
        method: "POST",
        body: randomFakeStepSample(),
      });
      setStatus(error ? `Failed: ${error.message ?? error.statusText}` : "Sample sent!");
    } catch {
      setStatus("Failed: could not reach the server.");
    } finally {
      setSending(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi {session.user.name || session.user.email}</Text>
      <Pressable style={styles.button} onPress={sendFakeSample} disabled={sending}>
        <Text style={styles.buttonText}>{sending ? "Sending..." : "Send fake sample"}</Text>
      </Pressable>
      {status && <Text style={styles.status}>{status}</Text>}
      <Pressable style={styles.signOut} onPress={() => authClient.signOut()}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  title: { fontSize: 20, fontWeight: "600" },
  button: {
    backgroundColor: "#111",
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "600" },
  status: { textAlign: "center" },
  signOut: { marginTop: 24 },
  signOutText: { textDecorationLine: "underline" },
});
