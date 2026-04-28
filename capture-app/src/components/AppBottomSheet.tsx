import React, { ReactNode, useCallback } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { palette, radii, shadows, spacing, typography } from "../constants/theme";
import { playSelectionHaptic } from "../lib/haptics";

type AppBottomSheetProps = {
  children: ReactNode;
  description?: string;
  onClose: () => void;
  title: string;
  visible: boolean;
};

export function AppBottomSheet({
  children,
  description,
  onClose,
  title,
  visible,
}: AppBottomSheetProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <Pressable
              onPress={() => {
                void playSelectionHaptic();
                onClose();
              }}
              style={({ pressed }) => [styles.closeButton, pressed && styles.closeButtonPressed]}
            >
              <X color={palette.ink} size={18} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.35)",
  },
  handle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: palette.line,
    marginBottom: spacing.md,
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: palette.card,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    ...shadows.card,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: spacing.xxs,
  },
  title: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.ink,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: typography.label,
    lineHeight: 20,
    color: palette.mutedInk,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.surfaceStrong,
  },
  closeButtonPressed: {
    opacity: 0.8,
  },
});
