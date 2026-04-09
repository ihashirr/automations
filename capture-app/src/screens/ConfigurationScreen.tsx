import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import { palette, radii, spacing, typography } from "../constants/theme";

export function ConfigurationScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Configuration Required</Text>
          <Text style={styles.title}>Add your Convex URL to boot the app.</Text>
          <Text style={styles.body}>
            Set <Text style={styles.code}>EXPO_PUBLIC_CONVEX_URL</Text> in{" "}
            <Text style={styles.code}>.env.local</Text>, then restart Expo.
          </Text>
          <Text style={styles.body}>
            Photos also need S3 credentials in Convex environment variables before image
            sync can complete.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.background,
  },
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    padding: spacing.xl,
    gap: spacing.md,
  },
  eyebrow: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: typography.headline,
    lineHeight: 36,
    fontWeight: "700",
    color: palette.ink,
  },
  body: {
    fontSize: typography.body,
    lineHeight: 24,
    color: palette.mutedInk,
  },
  code: {
    fontFamily: "monospace",
    color: palette.ink,
    fontWeight: "700",
  },
});
