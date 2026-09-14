import { Pressable, Text, type StyleProp, type ViewStyle } from "react-native";
import { ui } from "../lib/theme";

export function Button({ title, onPress, variant = "primary", disabled, style }: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const outline = variant === "outline";
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[ui.button, outline && ui.buttonOutline, disabled && ui.disabled, style]}>
    <Text style={[ui.buttonText, outline && ui.buttonOutlineText]}>{title}</Text>
  </Pressable>;
}
