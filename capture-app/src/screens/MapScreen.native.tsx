import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import { LocateFixed, Navigation, Phone, Target } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
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
import { CapturedLocation, ShopMapPin } from "../types/shops";

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
  const isFocused = useIsFocused();
  const insets = useSafeAreaInsets();
  const { activeCategoryLabel, activeMissionLabel } = useMissionControl();
  const { pendingCaptures } = useCaptureQueue();
  const [currentLocation, setCurrentLocation] = useState<CapturedLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadPin | null>(null);

  const feed = useQuery(
    api.shops.listMissionMapPins,
    isFocused
      ? {
          mission: activeMissionLabel,
          category: activeCategoryLabel ?? undefined,
          limit: 200,
        }
      : "skip",
  );

  useEffect(() => {
    void refreshCurrentLocation();
  }, []);

  const pins = useMemo(() => {
    const livePins = (feed ?? [])
      .filter((shop) => shop.location)
      .map<LeadPin>((shop: ShopMapPin) => ({
        id: shop._id,
        location: shop.location as CapturedLocation,
        name: shop.name,
        phone: shop.phone,
        status: "live",
      }));

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

  const region = useMemo<Region>(() => {
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

  useEffect(() => {
    if (!selectedLead) {
      return;
    }

    const leadStillVisible = pins.some((pin) => pin.id === selectedLead.id);

    if (!leadStillVisible) {
      setSelectedLead(null);
    }
  }, [pins, selectedLead]);

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
        allowReverseGeocode: true,
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

  return (
    <View style={styles.container}>
      <MapView
        initialRegion={region}
        key={`${region.latitude}-${region.longitude}-${pins.length}`}
        showsMyLocationButton={false}
        showsUserLocation
        style={StyleSheet.absoluteFill}
        customMapStyle={mapStyle}
      >
        {pins.map((pin) => (
          <Marker
            anchor={{ x: 0.5, y: 0.5 }}
            coordinate={{
              latitude: pin.location.lat,
              longitude: pin.location.lng,
            }}
            key={pin.id}
            onPress={() => {
              void playSelectionHaptic();
              setSelectedLead(pin);
            }}
          >
            <View style={[
              styles.markerRing,
              pin.status === "queued" && styles.markerRingQueued,
              selectedLead?.id === pin.id && styles.markerRingSelected
            ]}>
              <View style={[
                styles.markerDot,
                pin.status === "queued" && styles.markerDotQueued,
                selectedLead?.id === pin.id && styles.markerDotSelected
              ]} />
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={[styles.topOverlay, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.missionPill}>
          <Text numberOfLines={1} style={styles.missionPillText}>
            {activeMissionLabel || defaultMission.label}
          </Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{pins.length}</Text>
          </View>
        </View>

        <Pressable
          onPress={() => {
            void playSelectionHaptic();
            void refreshCurrentLocation();
          }}
          style={({ pressed }) => [styles.glassButton, pressed && styles.glassButtonPressed]}
        >
          {isLocating ? (
            <ActivityIndicator color={palette.white} size="small" />
          ) : (
            <LocateFixed color={palette.white} size={20} />
          )}
        </Pressable>
      </View>

      {selectedLead ? (
        <View style={[styles.quickInfo, { paddingBottom: insets.bottom + spacing.xl }]}>
          <View style={styles.dragHandle} />
          <View style={styles.infoContent}>
             <View style={styles.infoText}>
                <Text style={styles.infoTitle}>{selectedLead.name}</Text>
                <Text style={styles.infoSubtitle}>{getLocationLabel(selectedLead.location)}</Text>
             </View>
             <View style={[styles.statusBadge, selectedLead.status === "queued" && styles.statusBadgeQueued]}>
                <Text style={styles.statusBadgeText}>{selectedLead.status === "live" ? "Live" : "Pending"}</Text>
             </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              disabled={!selectedLead.phone.trim()}
              onPress={() => {
                if (!selectedLead.phone.trim()) return;
                void playSelectionHaptic();
                void Linking.openURL(buildDialLink(selectedLead.phone));
              }}
              style={({ pressed }) => [
                styles.ghostButton,
                !selectedLead.phone.trim() && styles.ghostButtonDisabled,
                pressed && styles.ghostButtonPressed
              ]}
            >
              <Phone color={palette.white} size={20} />
              <Text style={styles.ghostButtonText}>Call</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                void playSelectionHaptic();
                void openLocationInMaps(selectedLead.location);
              }}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed
              ]}
            >
              <Navigation color={palette.white} size={20} />
              <Text style={styles.primaryButtonText}>Route</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const mapStyle = [
  {
    "featureType": "poi",
    "elementType": "labels",
    "stylers": [{ "visibility": "off" }]
  }
];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#161719",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  missionPill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(22, 23, 25, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  missionPillText: {
    fontSize: 14,
    fontWeight: "800",
    color: palette.white,
    letterSpacing: 0.5,
  },
  countBadge: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#E96B39",
    alignItems: "center",
    justifyContent: "center",
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: palette.white,
  },
  glassButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(22, 23, 25, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  glassButtonPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  markerRing: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(233, 107, 57, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(233, 107, 57, 0.4)",
  },
  markerRingQueued: {
    backgroundColor: "rgba(199, 193, 181, 0.2)",
    borderColor: "rgba(199, 193, 181, 0.4)",
  },
  markerRingSelected: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(233, 107, 57, 0.4)",
    borderColor: "#E96B39",
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#E96B39",
  },
  markerDotQueued: {
    backgroundColor: "#C7C1B5",
  },
  markerDotSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E96B39",
  },
  quickInfo: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1C1D1F",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.xl,
    gap: spacing.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignSelf: "center",
    marginBottom: -spacing.sm,
  },
  infoContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    gap: 4,
  },
  infoTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.white,
  },
  infoSubtitle: {
    fontSize: 14,
    color: palette.mutedInk,
    fontWeight: "600",
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(40, 199, 111, 0.15)",
  },
  statusBadgeQueued: {
    backgroundColor: "rgba(233, 107, 57, 0.15)",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#28C76F",
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  ghostButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  ghostButtonPressed: {
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  ghostButtonDisabled: {
    opacity: 0.3,
  },
  ghostButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: palette.white,
  },
  primaryButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E96B39",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  primaryButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "800",
    color: palette.white,
  },
});
