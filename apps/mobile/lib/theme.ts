import { StyleSheet } from "react-native";

export const color = {
  bg: "#f8f7f2",
  card: "#ffffff",
  text: "#163230",
  muted: "#61716e",
  border: "#d9dfd8",
  line: "#e4e7e3",
  primary: "#166B57",
  primarySoft: "#edf5f1",
  amber: "#e8a624",
  blue: "#285e9a",
  danger: "#d75242",
  map: "#d9e7de"
};

export const ui = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.bg },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 1.2, color: color.primary },
  title: { fontSize: 32, fontWeight: "800", color: color.text },
  body: { fontSize: 15, lineHeight: 22, color: color.muted },
  hint: { fontSize: 12, lineHeight: 17, color: color.muted },
  error: { fontSize: 13, color: color.danger },
  label: { fontSize: 12, fontWeight: "700", color: color.muted },
  input: { height: 48, paddingHorizontal: 14, borderWidth: 1, borderColor: color.border, borderRadius: 10, backgroundColor: color.card, color: color.text, fontSize: 16 },
  card: { gap: 10, padding: 16, borderWidth: 1, borderColor: color.border, borderRadius: 14, backgroundColor: color.card },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: color.primarySoft },
  badgeText: { fontSize: 11, fontWeight: "800", color: color.primary },
  button: { height: 52, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", borderRadius: 10, backgroundColor: color.primary },
  buttonText: { fontSize: 15, fontWeight: "800", color: "#ffffff" },
  buttonOutline: { borderWidth: 1, borderColor: color.border, backgroundColor: "transparent" },
  buttonOutlineText: { color: color.text },
  disabled: { opacity: 0.5 }
});
