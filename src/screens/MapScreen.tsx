import * as Location from "expo-location";
import { useQuery } from "convex/react";
import { LocateFixed, MapPin, Navigation, Phone, Target } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { defaultMission } from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { buildDialLink } from "../lib/format";
import { playSelectionHaptic } from "../lib/haptics";
import { getLocationLabel, resolveLocationDetails } from "../lib/location";
import { openLocationInMaps } from "../lib/maps";
import { CapturedLocation, PendingCapture, ShopSummary } from "../types/shops";

type LeadPin = {
  id: string;
  location: CapturedLocation;
  name: string;
  phone: string;
  status: "live" | "queued";
};

const DEFAULT_REGION: Region = {
  latitude: 24.4539,
  longitude: 54.3773,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export function MapScreen() {
  const insets = useSafeAreaInsets();
  const { activeCategoryLabel, activeMissionLabel } = useMissionControl();
  const { pendingCaptures } = useCaptureQueue();
  const [currentLocation, setCurrentLocation] = useState<CapturedLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadPin | null>(null);

  const feed = useQuery(api.shops.listMissionFeed, {
    mission: activeMissionLabel,
    limit: 200,
  });

  useEffect(() => {
    void refreshCurrentLocation();
  }, []);

  async function refreshCurrentLocation() {
    setIsLocating(true);

    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();
      const permission =
        existingPermission.status === "granted"
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coordinates = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
      };
      const details = await resolveLocationDetails({
        allowReverseGeocode: Platform.OS !== "web",
        coordinates,
        reverseGeocode: () =>
          Location.reverseGeocodeAsync({
            latitude: coordinates.lat,
            longitude: coordinates.lng,
          }),
      });

      setCurrentLocation({
        ...coordinates,
        formattedAddress: details.formattedAddress,
      });
    } finally {
      setIsLocating(false);
    }
  }

  const pins = useMemo(() => {
    const livePins =
      (feed ?? [])
        .filter((shop) => !activeCategoryLabel || shop.category === activeCategoryLabel)
        .filter((shop) => shop.location)
        .map<LeadPin>((shop) => ({
          id: shop._id,
          location: shop.location as CapturedLocation,
          name: shop.name,
          phone: shop.phone,
          status: "live",
        })) ?? [];

    const queuedPins = pendingCaptures
      .filter((capture) => capture.mission === activeMissionLabel)
      .filter((capture) => !activeCategoryLabel || capture.category === activeCategoryLabel)
      .filter((capture) => capture.location)
      .map<LeadPin>((capture) => ({
        id: capture.localId,
        location: capture.location as CapturedLocation,
        name: capture.name,
        phone: capture.phone,
        status: "queued",
      }));

    return [...queuedPins, ...livePins];
  }, [activeCategoryLabel, activeMissionLabel, feed, pendingCaptures]);

  const initialRegion = useMemo<Region>(() => {
    const anchor = currentLocation ?? pins[0]?.location;

    if (!anchor) {
      return DEFAULT_REGION;
    }

    return {
      latitude: anchor.lat,
      longitude: anchor.lng,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, [currentLocation, pins]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.webFallback}>
        <Text style={styles.webFallbackTitle}>Mission Map is native-first.</Text>
        <Text style={styles.webFallbackText}>
          Open the iOS or Android build to see live location and mission pins.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        style={StyleSheet.absoluteFill}
      >
        {pins.map((pin) => (
          <Marker
            coordinate={{
              latitude: pin.location.lat,
              longitude: pin.location.lng,
            }}
            key={pin.id}
            onPress={() => {
              void playSelectionHaptic();
              setSelectedLead(pin);
            }}
            pinColor={palette.accent}
            title={pin.name}
          />
        ))}
      </MapView>

      <View style={[styles.topOverlay, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.missionBanner}>
          <Text style={styles.missionLabel}>Active Mission</Text>
          <Text style={styles.missionValue}>
            {activeCategoryLabel ?? "No Folder Locked"} / {activeMissionLabel || defaultMission.label}
          </Text>
          <View style={styles.missionMetaRow}>
            <Target color={palette.accent} size={14} />
            <Text style={styles.missionMetaText}>{pins.length} pins in current folder</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh current location"
          onPress={() => {
            void playSelectionHaptic();
            void refreshCurrentLocation();
          }}
          style={styles.locateButton}
        >
          {isLocating ? (
            <ActivityIndicator color={palette.ink} />
          ) : (
            <LocateFixed color={palette.ink} size={18} />
          )}
        </Pressable>
      </View>

      {selectedLead ? (
        <View style={[styles.actionCard, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.actionCardHeader}>
            <View style={styles.actionCardTitleWrap}>
              <Text style={styles.actionCardTitle}>{selectedLead.name}</Text>
              <Text style={styles.actionCardSubtitle}>
                {getLocationLabel(selectedLead.location)}
              </Text>
            </View>
            <View
              style={[
                styles.statusDot,
                selectedLead.status === "queued" && styles.statusDotQueued,
              ]}
            />
          </View>
          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              disabled={!selectedLead.phone}
              onPress={() => {
                if (selectedLead.phone) {
                  void playSelectionHaptic();
                  void Location;
                  void import("react-native").then(({ Linking }) =>
                    Linking.openURL(buildDialLink(selectedLead.phone)),
                  );
                }
              }}
              style={({ pressed }) => [
                styles.actionButton,
                !selectedLead.phone && styles.actionButtonDisabled,
                pressed && selectedLead.phone && styles.actionButtonPressed,
              ]}
            >
              <Phone color={palette.ink} size={18} />
              <Text style={styles.actionButtonText}>Call</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void playSelectionHaptic();
                void openLocationInMaps(selectedLead.location);
              }}
              style={({ pressed }) => [styles.actionButtonPrimary, pressed && styles.actionButtonPrimaryPressed]}
            >
              <Navigation color={palette.white} size={18} />
              <Text style={styles.actionButtonPrimaryText}>Navigate</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
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
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "flex-start",
  },
  missionBanner: {
    flex: 1,
    borderRadius: radii.lg,
    backgroundColor: "rgba(28, 28, 30, 0.92)",
    padding: spacing.md,
    gap: spacing.xs,
  },
  missionLabel: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: "#CFC7BB",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  missionValue: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.white,
  },
  missionMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  missionMetaText: {
    fontSize: typography.label,
    color: "#E7E0D6",
  },
  locateButton: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCard: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: "rgba(255,255,255,0.98)",
    padding: spacing.lg,
    gap: spacing.md,
  },
  actionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  actionCardTitleWrap: {
    flex: 1,
    gap: spacing.xs,
  },
  actionCardTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.ink,
  },
  actionCardSubtitle: {
    fontSize: typography.label,
    color: palette.mutedInk,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: palette.success,
  },
  statusDotQueued: {
    backgroundColor: palette.accent,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  actionButtonPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionButtonText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  actionButtonPrimary: {
    flex: 1,
    minHeight: 50,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  actionButtonPrimaryPressed: {
    backgroundColor: palette.accentStrong,
  },
  actionButtonPrimaryText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.white,
  },
});
