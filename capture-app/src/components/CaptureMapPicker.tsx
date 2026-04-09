import { useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";
import { palette, radii, shadows, spacing, typography } from "../constants/theme";
import { playSelectionHaptic } from "../lib/haptics";
import { formatCoordinateLabel } from "../lib/location";

type Coordinates = { lat: number; lng: number };

type CaptureMapPickerProps = {
  initialCoordinates: Coordinates | null;
  onClose: () => void;
  onConfirm: (coordinates: Coordinates) => Promise<void> | void;
  visible: boolean;
};

export function CaptureMapPicker({ initialCoordinates, onClose, onConfirm, visible }: CaptureMapPickerProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  async function handleConfirm() {
    if (!initialCoordinates || isConfirming) return;
    setIsConfirming(true);
    try {
      await onConfirm(initialCoordinates);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Choose on Map</Text>
            <Pressable onPress={() => { void playSelectionHaptic(); onClose(); }} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
              <X color={palette.ink} size={18} />
            </Pressable>
          </View>
          <Text style={styles.body}>Full-screen map picking is available in the native build. You can still confirm the prepared coordinates below.</Text>
          <Text style={styles.coordinates}>{initialCoordinates ? formatCoordinateLabel(initialCoordinates) : "No coordinates selected"}</Text>
          <Pressable disabled={!initialCoordinates || isConfirming} onPress={() => { void playSelectionHaptic(); void handleConfirm(); }} style={({ pressed }) => [styles.confirmButton, (!initialCoordinates || isConfirming) && styles.confirmButtonDisabled, pressed && initialCoordinates && !isConfirming && styles.confirmButtonPressed]}>
            {isConfirming ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={18} /><Text style={styles.confirmText}>Confirm Location</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28, 28, 30, 0.3)", padding: spacing.lg },
  card: { width: "100%", gap: spacing.md, borderRadius: radii.lg, backgroundColor: palette.surface, padding: spacing.lg, ...shadows.card },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  iconButton: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: palette.backgroundMuted },
  iconButtonPressed: { opacity: 0.8 },
  body: { fontSize: typography.label, lineHeight: 20, color: palette.mutedInk },
  coordinates: { fontSize: typography.body, fontWeight: "700", color: palette.ink },
  confirmButton: { minHeight: 52, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, backgroundColor: palette.accent },
  confirmButtonDisabled: { backgroundColor: "#C7C1B5" },
  confirmButtonPressed: { backgroundColor: palette.accentStrong },
  confirmText: { fontSize: typography.body, fontWeight: "800", color: palette.white },
});
