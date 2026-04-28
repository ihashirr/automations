import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { AppBottomSheet } from "./AppBottomSheet";
import { palette, radii, spacing, typography } from "../constants/theme";
import { playSelectionHaptic } from "../lib/haptics";

type ConfirmationSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  isDestructive?: boolean;
};

export function ConfirmationSheet({
  visible,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isDestructive = false,
}: ConfirmationSheetProps) {
  return (
    <AppBottomSheet visible={visible} onClose={onClose} title={title} description={description}>
      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.button, styles.cancelButton, pressed && styles.pressed]}
          onPress={() => {
            void playSelectionHaptic();
            onClose();
          }}
        >
          <Text style={styles.cancelText}>{cancelLabel}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            isDestructive ? styles.destructiveButton : styles.primaryButton,
            pressed && styles.pressed,
          ]}
          onPress={() => {
            void playSelectionHaptic();
            onConfirm();
            onClose();
          }}
        >
          <Text style={styles.confirmText}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.md,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: palette.surfaceStrong,
  },
  primaryButton: {
    backgroundColor: palette.accent,
  },
  destructiveButton: {
    backgroundColor: palette.danger,
  },
  cancelText: {
    color: palette.ink,
    fontSize: typography.body,
    fontWeight: "700",
  },
  confirmText: {
    color: palette.white,
    fontSize: typography.body,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.8,
  },
});
