import { useEffect, useState } from "react";
import { Text, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import {
  useHealthkitAuthorization,
  AuthorizationRequestStatus,
} from "@kingstinct/react-native-healthkit";
import { authClient } from "@/lib/auth-client";
import { HEALTHKIT_READ_IDENTIFIERS, syncHealthKitData } from "@/lib/healthkit";

export default function Index() {
  const { data: session, isPending } = authClient.useSession();
  const [authStatus, requestAuthorization] = useHealthkitAuthorization({
    toRead: HEALTHKIT_READ_IDENTIFIERS,
  });
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const alreadyRequested = authStatus === AuthorizationRequestStatus.unnecessary;

  async function runSync() {
    setSyncing(true);
    setStatus(null);
    try {
      const { pushed, errors } = await syncHealthKitData();
      setStatus(
        errors.length > 0
          ? `Synced ${pushed} sample(s), ${errors.length} type(s) failed: ${errors.join("; ")}`
          : `Synced ${pushed} sample(s) from Apple Health.`,
      );
    } catch {
      setStatus("Failed: could not reach the server.");
    } finally {
      setSyncing(false);
    }
  }

  // Auto-sync once per app open, as soon as we know HealthKit access has already been requested.
  useEffect(() => {
    if (alreadyRequested) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: kick off a fetch on mount
      runSync();
    }
  }, [alreadyRequested]);

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

  async function connectHealthKit() {
    setStatus(null);
    await requestAuthorization();
    // Read permissions never report grant/deny back to the app (Apple privacy
    // design) — the sync below just silently returns nothing for denied types.
    runSync();
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hi {session.user.name || session.user.email}</Text>
      {!alreadyRequested ? (
        <Pressable style={styles.button} onPress={connectHealthKit}>
          <Text style={styles.buttonText}>Connect Apple Health</Text>
        </Pressable>
      ) : (
        <Pressable style={styles.button} onPress={runSync} disabled={syncing}>
          <Text style={styles.buttonText}>{syncing ? "Syncing..." : "Sync now"}</Text>
        </Pressable>
      )}
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
  status: { textAlign: "center", paddingHorizontal: 16 },
  signOut: { marginTop: 24 },
  signOutText: { textDecorationLine: "underline" },
});
