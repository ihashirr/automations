import React, { ReactNode, useEffect, useRef, useCallback } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { BottomSheetModal, BottomSheetView, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
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
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      bottomSheetModalRef.current?.present();
    } else {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [visible]);

  const handleSheetChanges = useCallback((index: number) => {
    if (index === -1) {
      onClose();
    }
  }, [onClose]);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      onChange={handleSheetChanges}
      enableDynamicSizing={true}
      backdropComponent={renderBackdrop}
      keyboardBehavior={Platform.OS === "ios" ? "extend" : "interactive"}
      keyboardBlurBehavior="restore"
      backgroundStyle={styles.backgroundStyle}
      handleIndicatorStyle={styles.indicatorStyle}
    >
      <BottomSheetView style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
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
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  backgroundStyle: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    ...shadows.card,
  },
  indicatorStyle: {
    backgroundColor: palette.line,
    width: 40,
  },
  sheet: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
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
