import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { startTransition, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  CheckCircle2,
  Images,
  MapPinned,
  Signal,
  SignalHigh,
  SignalZero,
} from "lucide-react-native";
import { CaptureField } from "../components/CaptureField";
import { PhotoStrip } from "../components/PhotoStrip";
import { PostSaveActionsCard } from "../components/PostSaveActionsCard";
import { defaultMission } from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { saveLeadToContacts } from "../lib/contacts";
import { buildWhatsAppLink, formatCoordinates } from "../lib/format";
import {
  playMissionAccomplishedHaptic,
  playPinSuccessHaptic,
  playSelectionHaptic,
} from "../lib/haptics";
import { mapPickerAssetsToDraftImages } from "../lib/images";
import { getLocationLabel, resolveLocationDetails } from "../lib/location";
import { ShopDraft } from "../types/shops";

type FlashState = {
  tone: "success" | "warning" | "error";
  message: string;
};

function createEmptyDraft(mission: string, category: string | null): ShopDraft {
  return {
    category: category ?? "Unsorted",
    name: "",
    mission,
    neighborhood: "",
    phone: "",
    contactPerson: "",
    referredBy: "",
    images: [],
    location: null,
  };
}

export function CaptureScreen() {
  const { activeCategoryLabel, activeMissionLabel } = useMissionControl();
  const { isOnline, lastSyncIssue, pendingCount, saveCapture } = useCaptureQueue();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ShopDraft>(() =>
    createEmptyDraft(activeMissionLabel, activeCategoryLabel),
  );
  const [flashState, setFlashState] = useState<FlashState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPinningLocation, setIsPinningLocation] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const [recentLead, setRecentLead] = useState<ShopDraft | null>(null);
  const phoneRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const referredByRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!flashState) {
      return;
    }

    const timeout = setTimeout(() => {
      setFlashState(null);
    }, 2400);

    return () => clearTimeout(timeout);
  }, [flashState]);

  useEffect(() => {
    setDraft((current) => {
      const isPristine =
        !current.name &&
        !current.phone &&
        !current.contactPerson &&
        !current.referredBy &&
        !current.location &&
        current.images.length === 0;

      if (!isPristine) {
        return current;
      }

      return createEmptyDraft(activeMissionLabel, activeCategoryLabel);
    });
  }, [activeCategoryLabel, activeMissionLabel]);

  function updateField<Key extends keyof ShopDraft>(key: Key, value: ShopDraft[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function showFlash(tone: FlashState["tone"], message: string) {
    setFlashState({ tone, message });
  }

  async function handlePinLocation() {
    setIsPinningLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        showFlash("error", "Location permission is required to pin this shop.");
        return;
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const coordinates = {
        lat: currentLocation.coords.latitude,
        lng: currentLocation.coords.longitude,
      };
      const locationDetails = await resolveLocationDetails({
        allowReverseGeocode: Platform.OS !== "web",
        coordinates,
        reverseGeocode: () =>
          Location.reverseGeocodeAsync({
            latitude: coordinates.lat,
            longitude: coordinates.lng,
          }),
      });

      const lockedLocation = {
        ...coordinates,
        formattedAddress: locationDetails.formattedAddress,
      };

      updateField("location", lockedLocation);
      updateField("neighborhood", locationDetails.neighborhood);
      await playPinSuccessHaptic();
      showFlash("success", "Location locked.");
    } catch (error) {
      showFlash(
        "error",
        error instanceof Error ? error.message : "Unable to lock the current location.",
      );
    } finally {
      setIsPinningLocation(false);
    }
  }

  async function requestCameraAndCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera access needed", "Allow camera access to take shop photos.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.6,
    });

    if (!result.canceled) {
      updateField("images", [...draft.images, ...mapPickerAssetsToDraftImages(result.assets)]);
    }
  }

  async function requestLibraryAndPick() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Photo access needed", "Allow library access to add existing shop photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.6,
      selectionLimit: 0,
    });

    if (!result.canceled) {
      updateField("images", [...draft.images, ...mapPickerAssetsToDraftImages(result.assets)]);
    }
  }

  function removeImage(index: number) {
    updateField(
      "images",
      draft.images.filter((_, imageIndex) => imageIndex !== index),
    );
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      showFlash("error", "Shop name is required.");
      nameRef.current?.focus();
      return;
    }

    if (!draft.location) {
      showFlash("error", "Pin the location before saving.");
      return;
    }

    setIsSaving(true);

    try {
      const completedDraft = draft;
      const result = await saveCapture(completedDraft);

      startTransition(() => {
        setDraft(createEmptyDraft(activeMissionLabel, activeCategoryLabel));
      });

      setRecentLead(completedDraft);
      nameRef.current?.focus();

      void playMissionAccomplishedHaptic();

      showFlash(
        result.status === "saved"
          ? "success"
          : "warning",
        result.status === "saved" ? "Saved to Convex." : result.reason,
      );
    } catch (error) {
      showFlash(
        "error",
        error instanceof Error ? error.message : "Save failed.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSaveToPhone() {
    if (!recentLead) {
      return;
    }

    setIsSavingContact(true);

    try {
      await saveLeadToContacts({
        contactPerson: recentLead.contactPerson,
        phone: recentLead.phone,
        shopName: recentLead.name,
      });
      showFlash("success", "Contact saved to your phone.");
      setRecentLead(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save this contact.";
      showFlash("warning", message);
    } finally {
      setIsSavingContact(false);
    }
  }

  async function handleOpenWhatsApp() {
    if (!recentLead?.phone) {
      showFlash("warning", "Add a phone number to open WhatsApp.");
      return;
    }

    const whatsappLink = buildWhatsAppLink(recentLead.phone);

    if (!whatsappLink) {
      showFlash("warning", "Phone number format is invalid for WhatsApp.");
      return;
    }

    try {
      await Linking.openURL(whatsappLink);
    } catch {
      showFlash("warning", "Unable to open WhatsApp on this device.");
    }
  }

  const saveDisabled = isSaving || !draft.name.trim() || !draft.location;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 92 : 0}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + 220,
          },
        ]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.statusRow}>
            <View style={styles.signalPill}>
              {isOnline ? (
                <SignalHigh color={palette.success} size={14} />
              ) : (
                <SignalZero color={palette.warning} size={14} />
              )}
              <Text style={styles.signalText}>{isOnline ? "Live sync" : "Offline queue"}</Text>
            </View>
            <Text style={styles.queueCount}>{pendingCount} queued</Text>
          </View>
          <Text style={styles.title}>Rapid Capture</Text>
          <Text style={styles.subtitle}>
            Lock the location, add the lead, save, and move to the next shop.
          </Text>
        </View>

        {flashState ? (
          <View
            style={[
              styles.flashCard,
              flashState.tone === "success" && styles.flashSuccess,
              flashState.tone === "warning" && styles.flashWarning,
              flashState.tone === "error" && styles.flashError,
            ]}
          >
            <Text style={styles.flashText}>{flashState.message}</Text>
          </View>
        ) : null}

        {lastSyncIssue ? (
          <View style={styles.syncCard}>
            <Signal color={palette.warning} size={16} />
            <Text style={styles.syncText}>{lastSyncIssue}</Text>
          </View>
        ) : null}

        <View style={styles.folderCard}>
          <Text style={styles.folderEyebrow}>Active Folder</Text>
          <Text style={styles.folderTitle}>
            {draft.mission || defaultMission.label}
            {" / "}
            {draft.category || "Unsorted"}
          </Text>
          <Text style={styles.folderSubtitle}>
            New leads from the mission dashboard land here automatically.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pin current shop location"
          onPress={() => void handlePinLocation()}
          style={({ pressed }) => [
            styles.locationCard,
            pressed && !isPinningLocation && styles.locationPressed,
          ]}
        >
          <View style={styles.locationIconWrap}>
            {isPinningLocation ? (
              <ActivityIndicator color={palette.accent} />
            ) : draft.location ? (
              <CheckCircle2 color={palette.success} size={20} />
            ) : (
              <MapPinned color={palette.accent} size={20} />
            )}
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationTitle}>
              {draft.location ? "Location Locked" : "PIN LOCATION"}
            </Text>
            <Text style={styles.locationSubtitle}>
              {draft.location
                ? getLocationLabel(draft.location)
                : "Fetch precise GPS coordinates. Address lookup is optional and never blocks save."}
            </Text>
            {draft.location ? (
              <Text style={styles.locationCoordinates}>
                {formatCoordinates(draft.location)}
              </Text>
            ) : null}
            {draft.neighborhood ? (
              <Text style={styles.locationNeighborhood}>Neighborhood: {draft.neighborhood}</Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.formCard}>
          <CaptureField
            autoFocus
            label="Shop Name"
            onChangeText={(value) => updateField("name", value)}
            onSubmitEditing={() => phoneRef.current?.focus()}
            placeholder="Al Noor Grocery"
            ref={nameRef}
            returnKeyType="next"
            value={draft.name}
          />
          <CaptureField
            keyboardType="phone-pad"
            label="Phone"
            onChangeText={(value) => updateField("phone", value)}
            onSubmitEditing={() => contactRef.current?.focus()}
            placeholder="+971..."
            ref={phoneRef}
            returnKeyType="next"
            value={draft.phone}
          />
          <CaptureField
            keyboardType="default"
            label="Contact Person"
            onChangeText={(value) => updateField("contactPerson", value)}
            onSubmitEditing={() => referredByRef.current?.focus()}
            placeholder="Owner or manager"
            ref={contactRef}
            returnKeyType="next"
            value={draft.contactPerson}
          />
          <CaptureField
            keyboardType="default"
            label="Referred By"
            onChangeText={(value) => updateField("referredBy", value)}
            onSubmitEditing={() => {
              void handleSave();
            }}
            placeholder="Who gave you this lead?"
            ref={referredByRef}
            returnKeyType="done"
            value={draft.referredBy}
          />

          <View style={styles.actionRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Take a shop photo"
              onPress={() => {
                void playSelectionHaptic();
                void requestCameraAndCapture();
              }}
              style={styles.mediaButton}
            >
              <Camera color={palette.ink} size={20} />
              <Text style={styles.mediaButtonTitle}>Take Photo</Text>
              <Text style={styles.mediaButtonHint}>Quick camera capture</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add existing shop photos"
              onPress={() => {
                void playSelectionHaptic();
                void requestLibraryAndPick();
              }}
              style={styles.mediaButton}
            >
              <Images color={palette.ink} size={20} />
              <Text style={styles.mediaButtonTitle}>Add Photos</Text>
              <Text style={styles.mediaButtonHint}>Multiple images</Text>
            </Pressable>
          </View>
        </View>

        <PhotoStrip images={draft.images} onRemove={removeImage} />

        {recentLead ? (
          <PostSaveActionsCard
            disabled={isSavingContact}
            onDismiss={() => setRecentLead(null)}
            onSaveToPhone={() => void handleSaveToPhone()}
            onWhatsApp={() => void handleOpenWhatsApp()}
            phoneAvailable={Boolean(recentLead.phone.trim())}
            title={recentLead.name}
          />
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + spacing.sm,
          },
        ]}
      >
        <View style={styles.footerMeta}>
          <Text style={styles.footerTitle}>
            {draft.location ? getLocationLabel(draft.location) : "Pin the location before saving"}
          </Text>
          <Text style={styles.footerSubtitle}>
            {isOnline ? "Live sync is ready." : "Offline queue is active."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Save this shop"
          disabled={saveDisabled}
          onPress={() => {
            void playSelectionHaptic();
            void handleSave();
          }}
          style={({ pressed }) => [
            styles.saveButton,
            saveDisabled && styles.saveButtonDisabled,
            pressed && !saveDisabled && styles.saveButtonPressed,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={palette.white} />
          ) : (
            <Text style={styles.saveButtonText}>Save Lead</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  signalPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    alignSelf: "flex-start",
    borderRadius: radii.pill,
    backgroundColor: palette.syncBadge,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  signalText: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.ink,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  queueCount: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "800",
    color: palette.ink,
  },
  subtitle: {
    fontSize: typography.body,
    lineHeight: 24,
    color: palette.mutedInk,
  },
  flashCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  flashSuccess: {
    backgroundColor: palette.successSoft,
    borderColor: "#CFEBDD",
  },
  flashWarning: {
    backgroundColor: palette.warningSoft,
    borderColor: "#F7DF9E",
  },
  flashError: {
    backgroundColor: palette.dangerSoft,
    borderColor: "#F4C7C3",
  },
  flashText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  syncCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#F7DF9E",
    backgroundColor: palette.warningSoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  syncText: {
    flex: 1,
    fontSize: typography.label,
    lineHeight: 20,
    color: palette.ink,
  },
  folderCard: {
    gap: spacing.xs,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#D8D2C5",
    backgroundColor: "#1C1C1E",
    padding: spacing.lg,
  },
  folderEyebrow: {
    fontSize: typography.overline,
    fontWeight: "700",
    color: "#CFC7BB",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  folderTitle: {
    fontSize: typography.title,
    fontWeight: "800",
    color: palette.white,
  },
  folderSubtitle: {
    fontSize: typography.label,
    lineHeight: 20,
    color: "#E7E0D6",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  locationPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  locationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.backgroundMuted,
  },
  locationCopy: {
    flex: 1,
    gap: 2,
  },
  locationTitle: {
    fontSize: typography.label,
    fontWeight: "800",
    color: palette.ink,
    letterSpacing: 0.6,
  },
  locationSubtitle: {
    fontSize: typography.body,
    lineHeight: 22,
    color: palette.ink,
  },
  locationCoordinates: {
    marginTop: spacing.xs,
    fontSize: typography.overline,
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  locationNeighborhood: {
    marginTop: spacing.xs,
    fontSize: typography.overline,
    color: palette.accentStrong,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  formCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  mediaButton: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    padding: spacing.md,
    gap: spacing.xs,
  },
  mediaButtonTitle: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  mediaButtonHint: {
    fontSize: typography.overline,
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  footer: {
    position: "absolute",
    right: 0,
    bottom: 0,
    left: 0,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  footerMeta: {
    gap: 2,
  },
  footerTitle: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  footerSubtitle: {
    fontSize: typography.overline,
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  saveButton: {
    minHeight: 58,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  saveButtonPressed: {
    backgroundColor: palette.accentStrong,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonText: {
    fontSize: typography.body,
    fontWeight: "800",
    color: palette.white,
  },
});
