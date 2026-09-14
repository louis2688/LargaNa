import { useState } from "react";
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from "react-native";
import { Button } from "./button";
import { supabase } from "../lib/supabase";
import { ui } from "../lib/theme";

// ponytail: email + password for the demo accounts; phone OTP replaces this once an SMS provider exists.
export function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setError(error.message);
  };

  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.wrap}>
    <Text style={ui.overline}>WELCOME TO LARGANA</Text>
    <Text style={ui.title}>Sign in</Text>
    <Text style={ui.body}>Riders book trips and drivers go online, all in this app.</Text>
    <View style={styles.field}>
      <Text style={ui.label}>Email</Text>
      <TextInput style={ui.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" accessibilityLabel="Email" />
    </View>
    <View style={styles.field}>
      <Text style={ui.label}>Password</Text>
      <TextInput style={ui.input} value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" onSubmitEditing={submit} accessibilityLabel="Password" />
    </View>
    {error && <Text style={ui.error}>{error}</Text>}
    <Button title={busy ? "Signing in…" : "Sign in"} disabled={busy || !email || !password} onPress={submit} />
    <Text style={ui.hint}>Demo rider: rider@largana.demo{"\n"}Demo driver: driver@largana.demo{"\n"}Password for both: largana-demo</Text>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  wrap: { flex: 1, gap: 14, paddingHorizontal: 22, paddingTop: 24 },
  field: { gap: 6 }
});
