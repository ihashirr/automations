import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, X } from "lucide-react-native";
import { palette, radii, shadows, spacing, typography } from "../constants/theme";
import { playSelectionHaptic } from "../lib/haptics";
import { formatCoordinateLabel } from "../lib/location";
import { OpenStreetMapView } from "./OpenStreetMapView.native";

type Coordinates = { lat: number; lng: number };

type CaptureMapPickerProps = {
  initialCoordinates: Coordinates | null;
  onClose: () => void;
  onConfirm: (coordinates: Coordinates) => Promise<void> | void;
  visible: boolean;
};

export function CaptureMapPicker({ initialCoordinates, onClose, onConfirm, visible }: CaptureMapPickerProps) {
  const insets = useSafeAreaInsets();
  const [markerCoordinates, setMarkerCoordinates] = useState<Coordinates | null>(initialCoordinates);
  const [isConfirming, setIsConfirming] = useState(false);
  const [mapReloadKey, setMapReloadKey] = useState(0);
  const latestCoordinatesRef = useRef<Coordinates | null>(initialCoordinates);

  function syncCoordinatesNow(coordinates: Coordinates) {
    latestCoordinatesRef.current = coordinates;
    setMarkerCoordinates(coordinates);
  }

  useEffect(() => {
    if (!visible || !initialCoordinates) {
      return;
    }

    latestCoordinatesRef.current = initialCoordinates;
    setMarkerCoordinates(initialCoordinates);
    setMapReloadKey((current) => current + 1);
  }, [initialCoordinates, visible]);

  async function handleConfirm() {
    const selectedCoordinates = latestCoordinatesRef.current ?? markerCoordinates;

    if (!selectedCoordinates || isConfirming) return;

    setIsConfirming(true);
    try {
      await onConfirm(selectedCoordinates);
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" visible={visible}>
      <View style={styles.container}>
        {markerCoordinates ? (
          <OpenStreetMapView
            center={markerCoordinates}
            mode="pick"
            onCenterChange={syncCoordinatesNow}
            reloadKey={`${mapReloadKey}`}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} size="large" />
            <Text style={styles.loadingText}>Preparing map...</Text>
          </View>
        )}

        {markerCoordinates ? (
          <View pointerEvents="none" style={styles.centerPinWrap}>
            <View style={styles.pinHead}>
              <View style={styles.pinDot} />
            </View>
            <View style={styles.pinTail} />
          </View>
        ) : null}

        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Text style={styles.topTitle}>Choose on Map</Text>
          <Pressable onPress={() => { void playSelectionHaptic(); onClose(); }} style={({ pressed }) => [styles.iconButton, pressed && styles.iconButtonPressed]}>
            <X color={palette.white} size={18} />
          </Pressable>
        </View>

        <View style={[styles.bottomCard, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Text style={styles.label}>Selected Coordinates</Text>
          <Text style={styles.coordinates}>{markerCoordinates ? formatCoordinateLabel(markerCoordinates) : "Locating..."}</Text>
          <Text style={styles.helper}>Move the map until the center pin sits on the exact spot, then confirm the location.</Text>
          <Pressable disabled={!markerCoordinates || isConfirming} onPress={() => { void playSelectionHaptic(); void handleConfirm(); }} style={({ pressed }) => [styles.confirmButton, (!markerCoordinates || isConfirming) && styles.confirmButtonDisabled, pressed && markerCoordinates && !isConfirming && styles.confirmButtonPressed]}>
            {isConfirming ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={18} /><Text style={styles.confirmText}>Confirm Location</Text></>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.ink },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm, backgroundColor: palette.background },
  loadingText: { fontSize: typography.body, fontWeight: "700", color: palette.ink },
  topBar: { position: "absolute", top: 0, left: spacing.lg, right: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topTitle: { fontSize: typography.title, fontWeight: "800", color: palette.white },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28, 28, 30, 0.58)" },
  iconButtonPressed: { backgroundColor: "rgba(28, 28, 30, 0.74)" },
  centerPinWrap: {
    position: "absolute",
    left: "50%",
    top: "50%",
    marginLeft: -16,
    marginTop: -42,
    alignItems: "center",
  },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D73A31",
    borderWidth: 2,
    borderColor: "#B42318",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7F1D1D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  pinDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: palette.white,
  },
  pinTail: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 16,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#D73A31",
  },
  bottomCard: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 0, gap: spacing.sm, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: palette.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, ...shadows.card },
  label: { fontSize: typography.overline, fontWeight: "800", color: palette.mutedInk, letterSpacing: 1, textTransform: "uppercase" },
  coordinates: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  helper: { fontSize: typography.label, lineHeight: 20, color: palette.mutedInk },
  confirmButton: { minHeight: 54, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, backgroundColor: palette.accent },
  confirmButtonDisabled: { backgroundColor: "#C7C1B5" },
  confirmButtonPressed: { backgroundColor: palette.accentStrong },
  confirmText: { fontSize: typography.body, fontWeight: "800", color: palette.white },
});
