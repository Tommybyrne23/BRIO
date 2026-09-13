import { useCallback, useEffect, useState } from "react";
import { Text, View, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Redirect } from "expo-router";
import { useHealthkitAuthorization, AuthorizationRequestStatus } from "@kingstinct/react-native-healthkit";
import { authClient } from "@/lib/auth-client";
import { HEALTHKIT_READ_IDENTIFIERS, syncHealthKitData } from "@/lib/healthkit";

export default function Index() {
  const { data: session, isPending } = authClient.useSession();
  const [authStatus, requestAuthorization] = useHealthkitAuthorization({ toRead: HEALTHKIT_READ_IDENTIFIERS });
  const [syncing, setSyncing] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const alreadyRequested = authStatus === AuthorizationRequestStatus.unnecessary;

  const runSync = useCallback(async () => {
    if (!session?.user.id) { setStatus("Sign in before syncing."); return; }
    setSyncing(true); setStatus(null);
    try {
      const { pushed, skipped, errors } = await syncHealthKitData(session.user.id);
      setStatus(errors.length > 0 ? `Accepted ${pushed} sample(s); ${skipped} signal type(s) off; ${errors.length} type(s) failed: ${errors.join("; ")}` : `Accepted ${pushed} sample(s); ${skipped} signal type(s) are off in Brio Data controls.`);
    } catch (error) { setStatus(error instanceof Error ? error.message : "Could not reach Brio."); } finally { setSyncing(false); }
  }, [session]);

  useEffect(() => {
    if (!alreadyRequested || !session?.user.id) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- foreground sync starts only after confirmed session and server consent check
    runSync();
  }, [alreadyRequested, session?.user.id, runSync]);

  if (isPending) return <View style={styles.container}><ActivityIndicator color="#1D4436" /></View>;
  if (!session) return <Redirect href="/sign-in" />;

  async function connectHealthKit() {
    setStatus(null);
    await requestAuthorization();
    await runSync();
  }

  return <View style={styles.container}><View style={styles.mark}><Text style={styles.markText}>B</Text></View><Text style={styles.eyebrow}>IPHONE HEALTH HELPER</Text><Text style={styles.title}>Send selected Apple Health samples to Brio.</Text><Text style={styles.copy}>This companion is not the main workspace. It checks your server-side signal controls before reading each supported type, scopes anchors to this account, reconciles HealthKit deletions, and advances an anchor only after the server acknowledges the request.</Text><View style={styles.note}><Text style={styles.noteTitle}>Signed in as</Text><Text style={styles.noteText}>{session.user.email}</Text></View>{!alreadyRequested ? <Pressable style={styles.button} onPress={connectHealthKit}><Text style={styles.buttonText}>Connect Apple Health</Text></Pressable> : <Pressable style={[styles.button, syncing && styles.disabled]} onPress={runSync} disabled={syncing}><Text style={styles.buttonText}>{syncing ? "Syncing…" : "Sync now"}</Text></Pressable>}{status && <Text style={styles.status}>{status}</Text>}<Text style={styles.privacy}>Apple does not reveal per-type read denial. A denied type may return no samples. Brio never reports that as a granted permission.</Text><Pressable style={styles.signOut} onPress={() => authClient.signOut()}><Text style={styles.signOutText}>Sign out</Text></Pressable></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", gap: 16, padding: 28, backgroundColor: "#F7F5F0" },
  mark: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#1D4436", alignItems: "center", justifyContent: "center" },
  markText: { color: "white", fontSize: 22, fontWeight: "700" },
  eyebrow: { color: "#8A5A18", fontSize: 11, letterSpacing: 1.4, fontWeight: "800" },
  title: { color: "#0F1A16", fontSize: 32, lineHeight: 38, fontWeight: "600" },
  copy: { color: "#4E5C56", fontSize: 15, lineHeight: 23 },
  note: { borderWidth: 1, borderColor: "#1D443655", borderRadius: 18, backgroundColor: "#DBE6DF", padding: 16 },
  noteTitle: { color: "#4E5C56", fontSize: 12, fontWeight: "700" }, noteText: { color: "#0F1A16", marginTop: 4 },
  button: { backgroundColor: "#1D4436", borderRadius: 999, paddingVertical: 15, paddingHorizontal: 24, alignItems: "center" },
  disabled: { opacity: 0.5 }, buttonText: { color: "#fff", fontWeight: "700" },
  status: { color: "#1D4436", backgroundColor: "#DBE6DF", borderRadius: 14, padding: 14, lineHeight: 20 },
  privacy: { color: "#4E5C56", fontSize: 12, lineHeight: 18 }, signOut: { alignSelf: "flex-start", marginTop: 8 }, signOutText: { color: "#1D4436", textDecorationLine: "underline", fontWeight: "600" },
});
