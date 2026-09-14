import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { DriverHome } from "../components/driver-home";
import { RiderHome } from "../components/rider-home";
import { SignIn } from "../components/sign-in";
import { supabase, useSession } from "../lib/supabase";
import { color, ui } from "../lib/theme";

// One app: accounts with a driver profile get the driver screen, everyone else books rides.
export default function Home() {
  const session = useSession();
  const uid = session?.user.id;
  const [mode, setMode] = useState<{ uid: string; driver: boolean } | null>(null);

  useEffect(() => {
    if (!uid) return;
    supabase.from("driver_profiles").select("user_id").eq("user_id", uid).maybeSingle()
      .then(({ data }) => setMode({ uid, driver: !!data }));
  }, [uid]);

  const loading = session === undefined || (session !== null && mode?.uid !== uid);

  return <SafeAreaView style={ui.safe}>
    <View style={styles.header}>
      <Text style={styles.brand}><Text style={{ color: color.primary }}>Larga</Text>Na</Text>
      {session && <Pressable accessibilityRole="button" accessibilityLabel="Sign out" style={styles.iconButton} onPress={() => supabase.auth.signOut()}>
        <Ionicons name="log-out-outline" size={19} color={color.text} />
      </Pressable>}
    </View>
    {loading ? <ActivityIndicator style={styles.loading} color={color.primary} />
      : !session ? <SignIn />
      : mode?.driver ? <DriverHome uid={session.user.id} />
      : <RiderHome session={session} />}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  header: { height: 56, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { fontSize: 24, fontWeight: "800", color: color.text },
  iconButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color.border, borderRadius: 20 },
  loading: { marginTop: 80 }
});
