import { StyleSheet, Text, View } from "react-native";
import { palette, spacing, typography } from "../constants/theme";

export function MapScreen() {
  return (
    <View style={styles.webFallback}>
      <Text style={styles.webFallbackTitle}>Map Available On Native Build</Text>
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
  },
  webFallbackTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.ink,
  },
});
