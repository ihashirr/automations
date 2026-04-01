import { StyleSheet, Text, View } from "react-native";
import { palette, spacing, typography } from "../constants/theme";

export function MapScreen() {
  return (
    <View style={styles.webFallback}>
      <Text style={styles.webFallbackTitle}>Mission Map is native-first.</Text>
      <Text style={styles.webFallbackText}>
        Open the iOS or Android build to see your live position and mission pins.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: palette.background,
    gap: spacing.sm,
  },
  webFallbackTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.ink,
  },
  webFallbackText: {
    textAlign: "center",
    fontSize: typography.body,
    lineHeight: 24,
    color: palette.mutedInk,
  },
});
