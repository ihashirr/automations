import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { forwardRef, startTransition, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  Check,
  ChevronDown,
  FolderOpen,
  Images,
  MapPinned,
  SignalHigh,
  SignalZero,
} from "lucide-react-native";
import { PhotoStrip } from "../components/PhotoStrip";
import {
  defaultMission,
  getCategoryDefinition,
  getCategoryIdFromLabel,
  getMissionDefinition,
  missionCatalog,
} from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { formatCoordinates } from "../lib/format";
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

function isDraftPristine(draft: ShopDraft) {
  return (
    !draft.name &&
    !draft.phone &&
    !draft.contactPerson &&
    !draft.referredBy &&
    !draft.location &&
    draft.images.length === 0
  );
}

export function CaptureScreen() {
  const {
    activeCategoryId,
    activeCategoryLabel,
    activeMissionId,
    activeMissionLabel,
    startCategoryMission,
  } = useMissionControl();
  const { isOnline, pendingCount, saveCapture } = useCaptureQueue();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ShopDraft>(() =>
    createEmptyDraft(activeMissionLabel, activeCategoryLabel),
  );
  const [flashState, setFlashState] = useState<FlashState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPinningLocation, setIsPinningLocation] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [pickerMissionId, setPickerMissionId] = useState(activeMissionId);
  const [showSavedCheck, setShowSavedCheck] = useState(false);
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
    }, 1800);

    return () => clearTimeout(timeout);
  }, [flashState]);

  useEffect(() => {
    if (!showSavedCheck) {
      return;
    }

    const timeout = setTimeout(() => {
      setShowSavedCheck(false);
    }, 1400);

    return () => clearTimeout(timeout);
  }, [showSavedCheck]);

  useEffect(() => {
    setDraft((current) => {
      if (!isDraftPristine(current)) {
        return current;
      }

      return createEmptyDraft(activeMissionLabel, activeCategoryLabel);
    });
  }, [activeCategoryLabel, activeMissionLabel]);

  useEffect(() => {
    if (!isFolderPickerOpen) {
      setPickerMissionId(activeMissionId);
    }
  }, [activeMissionId, isFolderPickerOpen]);

  function updateField<Key extends keyof ShopDraft>(key: Key, value: ShopDraft[Key]) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function showFlash(tone: FlashState["tone"], message: string) {
    setFlashState({ tone, message });
  }

  function openFolderPicker() {
    const draftMissionId =
      missionCatalog.find((mission) => mission.label === draft.mission)?.id ?? activeMissionId;
    setPickerMissionId(draftMissionId);
    setIsFolderPickerOpen(true);
  }

  function applyFolderSelection(missionId: string, categoryId: string) {
    const mission = getMissionDefinition(missionId);
    const category = getCategoryDefinition(missionId, categoryId);

    setDraft((current) => ({
      ...current,
      mission: mission.label,
      category: category?.label ?? "Unsorted",
    }));
    startCategoryMission({ missionId, categoryId });
    setIsFolderPickerOpen(false);
  }

  async function handlePinLocation() {
    setIsPinningLocation(true);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        showFlash("error", "Location permission is required.");
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

      updateField("location", {
        ...coordinates,
        formattedAddress: locationDetails.formattedAddress,
      });
      updateField("neighborhood", locationDetails.neighborhood);
      await playPinSuccessHaptic();
      showFlash("success", "Location locked");
    } catch (error) {
      showFlash(
        "error",
        error instanceof Error ? error.message : "Unable to lock location.",
      );
    } finally {
      setIsPinningLocation(false);
    }
  }

  async function requestCameraAndCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert("Camera access needed", "Allow camera access to take photos.");
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
      Alert.alert("Photo access needed", "Allow library access to add photos.");
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
      showFlash("error", "Pin the location first.");
      return;
    }

    setIsSaving(true);

    try {
      const completedDraft = draft;
      const result = await saveCapture(completedDraft);

      startTransition(() => {
        setDraft(createEmptyDraft(completedDraft.mission, completedDraft.category));
      });

      nameRef.current?.focus();
      setShowSavedCheck(true);
      void playMissionAccomplishedHaptic();

      showFlash(
        result.status === "saved" ? "success" : "warning",
        result.status === "saved" ? "Lead saved" : result.reason,
      );
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  const saveDisabled = isSaving || !draft.name.trim() || !draft.location;
  const selectedCategoryId =
    getCategoryIdFromLabel(pickerMissionId, draft.category) ??
    (pickerMissionId === activeMissionId ? activeCategoryId : null);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 96 : 0}
      style={styles.container}
    >
      <View style={[styles.screen, { paddingBottom: insets.bottom + spacing.sm }]}>
        {flashState ? (
          <View
            style={[
              styles.toast,
              flashState.tone === "success" && styles.toastSuccess,
              flashState.tone === "warning" && styles.toastWarning,
              flashState.tone === "error" && styles.toastError,
            ]}
          >
            <Text style={styles.toastText}>{flashState.message}</Text>
          </View>
        ) : null}

        <View style={styles.utilityRow}>
          <View style={styles.utilityPill}>
            {isOnline ? (
              <SignalHigh color={palette.success} size={13} />
            ) : (
              <SignalZero color={palette.warning} size={13} />
            )}
            <Text style={styles.utilityText}>{isOnline ? "Live" : "Queued"}</Text>
          </View>

          <Pressable
            accessibilityLabel="Choose destination folder"
            accessibilityRole="button"
            onPress={() => {
              void playSelectionHaptic();
              openFolderPicker();
            }}
            style={({ pressed }) => [styles.folderPill, pressed && styles.folderPillPressed]}
          >
            <FolderOpen color={palette.ink} size={14} />
            <Text numberOfLines={1} style={styles.folderPillText}>
              {draft.category || "Unsorted"}
            </Text>
            <ChevronDown color={palette.mutedInk} size={14} />
          </Pressable>

          <View style={styles.queuePill}>
            <Text style={styles.queuePillText}>{pendingCount}</Text>
          </View>
        </View>

        <Pressable
          accessibilityLabel="Pin current location"
          accessibilityRole="button"
          onPress={() => void handlePinLocation()}
          style={({ pressed }) => [
            styles.locationBar,
            pressed && !isPinningLocation && styles.locationBarPressed,
          ]}
        >
          <View style={styles.locationGlyph}>
            {isPinningLocation ? (
              <ActivityIndicator color={palette.accent} size="small" />
            ) : draft.location ? (
              <Check color={palette.success} size={16} />
            ) : (
              <MapPinned color={palette.accent} size={16} />
            )}
          </View>
          <View style={styles.locationCopy}>
            <Text style={styles.locationPrimary}>
              {draft.location ? getLocationLabel(draft.location) : "Pin Location"}
            </Text>
            <Text numberOfLines={1} style={styles.locationSecondary}>
              {draft.location
                ? draft.neighborhood || formatCoordinates(draft.location)
                : draft.category || defaultMission.label}
            </Text>
          </View>
          {draft.location ? (
            <Text style={styles.locationMeta}>{formatCoordinates(draft.location)}</Text>
          ) : null}
        </Pressable>

        <View style={styles.formGrid}>
          <View style={styles.fieldRow}>
            <CompactField
              autoFocus
              containerStyle={styles.fieldHalf}
              label="Shop"
              onChangeText={(value) => updateField("name", value)}
              onSubmitEditing={() => phoneRef.current?.focus()}
              placeholder="Al Noor Grocery"
              ref={nameRef}
              returnKeyType="next"
              value={draft.name}
            />
            <CompactField
              containerStyle={styles.fieldHalf}
              keyboardType="phone-pad"
              label="Phone"
              onChangeText={(value) => updateField("phone", value)}
              onSubmitEditing={() => contactRef.current?.focus()}
              placeholder="+971..."
              ref={phoneRef}
              returnKeyType="next"
              value={draft.phone}
            />
          </View>

          <View style={styles.fieldRow}>
            <CompactField
              containerStyle={styles.fieldHalf}
              keyboardType="default"
              label="Contact"
              onChangeText={(value) => updateField("contactPerson", value)}
              onSubmitEditing={() => referredByRef.current?.focus()}
              placeholder="Manager"
              ref={contactRef}
              returnKeyType="next"
              value={draft.contactPerson}
            />
            <CompactField
              containerStyle={styles.fieldHalf}
              keyboardType="default"
              label="Referred"
              onChangeText={(value) => updateField("referredBy", value)}
              onSubmitEditing={() => {
                void handleSave();
              }}
              placeholder="Source"
              ref={referredByRef}
              returnKeyType="done"
              value={draft.referredBy}
            />
          </View>
        </View>

        <View style={styles.mediaRow}>
          <UtilityActionButton
            icon={<Camera color={palette.ink} size={18} />}
            label="Camera"
            onPress={() => {
              void playSelectionHaptic();
              void requestCameraAndCapture();
            }}
          />
          <UtilityActionButton
            icon={<Images color={palette.ink} size={18} />}
            label="Photos"
            onPress={() => {
              void playSelectionHaptic();
              void requestLibraryAndPick();
            }}
          />
        </View>

        <PhotoStrip images={draft.images} onRemove={removeImage} />

        <View style={styles.flexSpacer} />

        <View style={styles.footer}>
          <View style={styles.footerMeta}>
            <Text numberOfLines={1} style={styles.footerTitle}>
              {draft.location ? getLocationLabel(draft.location) : draft.category || "Unsorted"}
            </Text>
            <Text style={styles.footerSubtitle}>{draft.mission || defaultMission.label}</Text>
          </View>
          <Pressable
            accessibilityLabel="Save lead"
            accessibilityRole="button"
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
            ) : showSavedCheck ? (
              <Check color={palette.white} size={18} />
            ) : (
              <Text style={styles.saveButtonText}>Save</Text>
            )}
          </Pressable>
        </View>

        <FolderPickerSheet
          activeMissionId={pickerMissionId}
          onClose={() => setIsFolderPickerOpen(false)}
          onMissionChange={setPickerMissionId}
          onSelect={applyFolderSelection}
          selectedCategoryId={selectedCategoryId}
          visible={isFolderPickerOpen}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const CompactField = forwardRef<
  TextInput,
  React.ComponentProps<typeof TextInput> & {
    containerStyle?: object;
    label: string;
  }
>(function CompactField({ containerStyle, label, style, ...textInputProps }, ref) {
  return (
    <View style={[styles.fieldCard, containerStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={palette.mutedInk}
        ref={ref}
        style={[styles.fieldInput, style]}
        {...textInputProps}
      />
    </View>
  );
});

function UtilityActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.utilityAction, pressed && styles.utilityActionPressed]}
    >
      {icon}
      <Text style={styles.utilityActionLabel}>{label}</Text>
    </Pressable>
  );
}

function FolderPickerSheet({
  activeMissionId,
  onClose,
  onMissionChange,
  onSelect,
  selectedCategoryId,
  visible,
}: {
  activeMissionId: string;
  onClose: () => void;
  onMissionChange: (missionId: string) => void;
  onSelect: (missionId: string, categoryId: string) => void;
  selectedCategoryId: string | null;
  visible: boolean;
}) {
  const mission = getMissionDefinition(activeMissionId);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable
        onPress={() => {
          void playSelectionHaptic();
          onClose();
        }}
        style={styles.sheetBackdrop}
      >
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <Text style={styles.sheetEyebrow}>Folder</Text>
          <View style={styles.sheetMissionRow}>
            {missionCatalog.map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  void playSelectionHaptic();
                  onMissionChange(option.id);
                }}
                style={({ pressed }) => [
                  styles.sheetMissionChip,
                  option.id === activeMissionId && styles.sheetMissionChipActive,
                  pressed && option.id !== activeMissionId && styles.sheetMissionChipPressed,
                ]}
              >
                <Text
                  style={[
                    styles.sheetMissionChipText,
                    option.id === activeMissionId && styles.sheetMissionChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sheetCategoryList}>
            {mission.categories.map((category) => (
              <Pressable
                key={category.id}
                onPress={() => {
                  void playSelectionHaptic();
                  onSelect(activeMissionId, category.id);
                }}
                style={({ pressed }) => [
                  styles.sheetCategoryButton,
                  category.id === selectedCategoryId && styles.sheetCategoryButtonActive,
                  pressed && category.id !== selectedCategoryId && styles.sheetCategoryButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.sheetCategoryButtonText,
                    category.id === selectedCategoryId && styles.sheetCategoryButtonTextActive,
                  ]}
                >
                  {category.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  screen: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  toast: {
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toastSuccess: {
    backgroundColor: palette.successSoft,
  },
  toastWarning: {
    backgroundColor: palette.warningSoft,
  },
  toastError: {
    backgroundColor: palette.dangerSoft,
  },
  toastText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  utilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  utilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: palette.syncBadge,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  utilityText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.ink,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  folderPill: {
    flex: 1,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
  },
  folderPillPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  folderPillText: {
    flex: 1,
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  queuePill: {
    minWidth: 34,
    minHeight: 34,
    borderRadius: radii.pill,
    backgroundColor: palette.backgroundMuted,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  queuePillText: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.ink,
  },
  locationBar: {
    minHeight: 62,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  locationBarPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  locationGlyph: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.backgroundMuted,
  },
  locationCopy: {
    flex: 1,
    gap: 2,
  },
  locationPrimary: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  locationSecondary: {
    fontSize: 12,
    color: palette.mutedInk,
  },
  locationMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.mutedInk,
  },
  formGrid: {
    gap: spacing.xs,
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  fieldHalf: {
    flex: 1,
  },
  fieldCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: 2,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  fieldInput: {
    minHeight: 28,
    paddingVertical: 0,
    fontSize: typography.body,
    color: palette.ink,
  },
  mediaRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  utilityAction: {
    flex: 1,
    minHeight: 56,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  utilityActionPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  utilityActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.ink,
  },
  flexSpacer: {
    flex: 1,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: palette.line,
    paddingTop: spacing.sm,
  },
  footerMeta: {
    flex: 1,
    gap: 2,
  },
  footerTitle: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  footerSubtitle: {
    fontSize: 12,
    color: palette.mutedInk,
  },
  saveButton: {
    minWidth: 108,
    minHeight: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
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
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28, 28, 30, 0.32)",
  },
  sheetCard: {
    gap: spacing.md,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    backgroundColor: palette.surface,
    padding: spacing.lg,
  },
  sheetEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sheetMissionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sheetMissionChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  sheetMissionChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  sheetMissionChipPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  sheetMissionChipText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  sheetMissionChipTextActive: {
    color: palette.white,
  },
  sheetCategoryList: {
    gap: spacing.xs,
  },
  sheetCategoryButton: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sheetCategoryButtonActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accentSoft,
  },
  sheetCategoryButtonPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  sheetCategoryButtonText: {
    fontSize: typography.body,
    fontWeight: "700",
    color: palette.ink,
  },
  sheetCategoryButtonTextActive: {
    color: palette.accentStrong,
  },
});
