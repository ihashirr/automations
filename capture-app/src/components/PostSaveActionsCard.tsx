import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { ContactRound, MessageCircleMore, X } from "lucide-react-native";
import { playSelectionHaptic } from "../lib/haptics";
import { palette, radii, spacing, typography } from "../constants/theme";

type PostSaveActionsCardProps = {
  disabled: boolean;
  onDismiss: () => void;
  onSaveToPhone: () => void;
  onWhatsApp: () => void;
  phoneAvailable: boolean;
  title: string;
};

export function PostSaveActionsCard({
  disabled,
  onDismiss,
  onSaveToPhone,
  onWhatsApp,
  phoneAvailable,
  title,
}: PostSaveActionsCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>Saved</Text>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Dismiss post-save actions"
          hitSlop={10}
          onPress={() => {
            void playSelectionHaptic();
            onDismiss();
          }}
          style={styles.closeButton}
        >
          <X color={palette.mutedInk} size={18} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save contact to phone"
          disabled={disabled || !phoneAvailable}
          onPress={() => {
            void playSelectionHaptic();
            onSaveToPhone();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            (!phoneAvailable || disabled) && styles.buttonDisabled,
            pressed && !disabled && phoneAvailable && styles.secondaryPressed,
          ]}
        >
          {disabled ? (
            <ActivityIndicator color={palette.ink} size="small" />
          ) : (
            <ContactRound color={palette.ink} size={18} />
          )}
          <Text style={styles.secondaryText}>Save to Phone</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open instant WhatsApp chat"
          disabled={!phoneAvailable}
          onPress={() => {
            void playSelectionHaptic();
            onWhatsApp();
          }}
          style={({ pressed }) => [
            styles.primaryButton,
            !phoneAvailable && styles.buttonDisabled,
            pressed && phoneAvailable && styles.primaryPressed,
          ]}
        >
          <MessageCircleMore color={palette.white} size={18} />
          <Text style={styles.primaryText}>Instant WhatsApp</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "700",
    color: palette.ink,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.backgroundMuted,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  primaryPressed: {
    backgroundColor: palette.accentStrong,
  },
  primaryText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.white,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  secondaryPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  secondaryText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
