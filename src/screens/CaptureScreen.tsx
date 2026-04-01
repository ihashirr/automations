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
    addMissionCategory,
    activeMissionId,
    activeMissionLabel,
    getCategoryById,
    getCategoryIdFromLabel,
    getMissionCategories,
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
    const category = getCategoryById(missionId, categoryId);

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
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.container}
    >
      <View style={styles.screen}>
        {/* Top 40%: Camera Preview Placeholder */}
        <View style={styles.cameraPreview}>
          <View style={styles.cameraPlaceholder}>
            <Camera color={palette.mutedInk} size={48} strokeWidth={1} />
            <Text style={styles.cameraPlaceholderText}>Live Preview</Text>
          </View>
          
          <View style={styles.cameraOverlays}>
            <View style={styles.utilityPill}>
              {isOnline ? (
                <SignalHigh color={palette.success} size={13} />
              ) : (
                <SignalZero color={palette.warning} size={13} />
              )}
              <Text style={styles.utilityText}>{isOnline ? "Live" : "Queued"}</Text>
            </View>

            <Pressable
              onPress={() => {
                void playSelectionHaptic();
                openFolderPicker();
              }}
              style={styles.folderPill}
            >
              <FolderOpen color={palette.white} size={14} />
              <Text numberOfLines={1} style={styles.folderPillText}>
                {draft.category || "Unsorted"}
              </Text>
            </Pressable>
          </View>

          <View style={styles.cameraFooter}>
             <PhotoStrip images={draft.images} onRemove={removeImage} />
             <View style={styles.mediaActions}>
                <Pressable onPress={() => { void playSelectionHaptic(); void requestCameraAndCapture(); }} style={styles.mediaButton}>
                  <Camera color={palette.white} size={20} />
                </Pressable>
                <Pressable onPress={() => { void playSelectionHaptic(); void requestLibraryAndPick(); }} style={styles.mediaButton}>
                  <Images color={palette.white} size={20} />
                </Pressable>
             </View>
          </View>
        </View>

        {/* Bottom 60%: Input Cluster */}
        <View style={styles.inputCluster}>
          <TextInput
            autoFocus
            onChangeText={(value) => updateField("name", value)}
            placeholder="SHOP NAME"
            placeholderTextColor="#C7C1B5"
            ref={nameRef}
            style={styles.largeInput}
            value={draft.name}
          />

          <View style={styles.fieldRow}>
            <View style={styles.fieldHalf}>
              <Text style={styles.inputLabel}>PHONE</Text>
              <TextInput
                keyboardType="phone-pad"
                onChangeText={(value) => updateField("phone", value)}
                placeholder="+971..."
                placeholderTextColor={palette.mutedInk}
                ref={phoneRef}
                style={styles.simpleInput}
                value={draft.phone}
              />
            </View>
            <View style={styles.fieldHalf}>
              <Text style={styles.inputLabel}>MANAGER</Text>
              <TextInput
                onChangeText={(value) => updateField("contactPerson", value)}
                placeholder="Name"
                placeholderTextColor={palette.mutedInk}
                ref={contactRef}
                style={styles.simpleInput}
                value={draft.contactPerson}
              />
            </View>
          </View>

          <View style={styles.locationSection}>
            <View style={styles.locationHeader}>
              <Text style={styles.inputLabel}>NEIGHBORHOOD</Text>
              <Pressable onPress={() => void handlePinLocation()} style={styles.pinButton}>
                {isPinningLocation ? (
                  <ActivityIndicator color={palette.accent} size="small" />
                ) : (
                  <MapPinned color={draft.location ? palette.success : palette.accent} size={18} />
                )}
              </Pressable>
            </View>
            <TextInput
              onChangeText={(value) => updateField("neighborhood", value)}
              placeholder="Detecting..."
              placeholderTextColor={palette.mutedInk}
              style={styles.neighborhoodInput}
              value={draft.neighborhood}
            />
          </View>
        </View>

        {/* Floating SAVE FAB */}
        <Pressable
          disabled={saveDisabled}
          onPress={() => {
            void playSelectionHaptic();
            void handleSave();
          }}
          style={({ pressed }) => [
            styles.saveFab,
            saveDisabled && styles.saveFabDisabled,
            pressed && styles.saveFabPressed,
          ]}
        >
          {isSaving ? (
            <ActivityIndicator color={palette.white} />
          ) : showSavedCheck ? (
            <Check color={palette.white} size={28} strokeWidth={3} />
          ) : (
            <Check color={palette.white} size={28} strokeWidth={3} />
          )}
        </Pressable>

        {flashState ? (
          <View
            style={[
              styles.toast,
              flashState.tone === "success" && styles.toastSuccess,
              flashState.tone === "warning" && styles.toastWarning,
              flashState.tone === "error" && styles.toastError,
              { bottom: insets.bottom + 100 },
            ]}
          >
            <Text style={styles.toastText}>{flashState.message}</Text>
          </View>
        ) : null}

        <FolderPickerSheet
          activeMissionId={pickerMissionId}
          getCategoriesForMission={getMissionCategories}
          onClose={() => setIsFolderPickerOpen(false)}
          onCreateCategory={({ label, missionId }) => addMissionCategory({ label, missionId })}
          onMissionChange={setPickerMissionId}
          onSelect={applyFolderSelection}
          selectedCategoryId={selectedCategoryId}
          visible={isFolderPickerOpen}
        />
      </View>
    </KeyboardAvoidingView>
  );
}


function FolderPickerSheet({
  activeMissionId,
  getCategoriesForMission,
  onClose,
  onCreateCategory,
  onMissionChange,
  onSelect,
  selectedCategoryId,
  visible,
}: {
  activeMissionId: string;
  getCategoriesForMission: (missionId: string) => { id: string; label: string }[];
  onClose: () => void;
  onCreateCategory: (options: { label: string; missionId?: string }) => { id: string; label: string } | null;
  onMissionChange: (missionId: string) => void;
  onSelect: (missionId: string, categoryId: string) => void;
  selectedCategoryId: string | null;
  visible: boolean;
}) {
  const [newFolderName, setNewFolderName] = useState("");
  const missionCategories = getCategoriesForMission(activeMissionId);

  function handleCreateFolder() {
    const created = onCreateCategory({ label: newFolderName, missionId: activeMissionId });

    if (!created) {
      return;
    }

    setNewFolderName("");
    onSelect(activeMissionId, created.id);
  }

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
          <View style={styles.sheetCreateRow}>
            <TextInput
              onChangeText={setNewFolderName}
              placeholder="Create new folder"
              placeholderTextColor={palette.mutedInk}
              style={styles.sheetCreateInput}
              value={newFolderName}
            />
            <Pressable
              onPress={() => {
                void playSelectionHaptic();
                handleCreateFolder();
              }}
              style={({ pressed }) => [
                styles.sheetCreateButton,
                !newFolderName.trim() && styles.sheetCreateButtonDisabled,
                pressed && newFolderName.trim() && styles.sheetCreateButtonPressed,
              ]}
            >
              <Text style={styles.sheetCreateButtonText}>Add</Text>
            </Pressable>
          </View>
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
            {missionCategories.map((category) => (
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
  },
  cameraPreview: {
    height: "40%",
    backgroundColor: "#161719",
    position: "relative",
  },
  cameraPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  cameraPlaceholderText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  cameraOverlays: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cameraFooter: {
    position: "absolute",
    bottom: spacing.md,
    left: spacing.md,
    right: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  mediaActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  mediaButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  inputCluster: {
    height: "60%",
    padding: spacing.xl,
    gap: spacing.lg,
  },
  largeInput: {
    fontSize: 32,
    fontWeight: "800",
    color: palette.ink,
    padding: 0,
  },
  fieldRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  fieldHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  simpleInput: {
    fontSize: 18,
    fontWeight: "600",
    color: palette.ink,
    padding: 0,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
    paddingBottom: 4,
  },
  locationSection: {
    gap: 4,
  },
  locationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pinButton: {
    padding: 4,
  },
  neighborhoodInput: {
    fontSize: 20,
    fontWeight: "700",
    color: palette.accentStrong,
    padding: 0,
  },
  saveFab: {
    position: "absolute",
    bottom: spacing.xl + 20,
    right: spacing.xl,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E96B39",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#E96B39",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  saveFabDisabled: {
    backgroundColor: "#C7C1B5",
    shadowOpacity: 0,
  },
  saveFabPressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: "#D35A2D",
  },
  toast: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    zIndex: 100,
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
    fontSize: 14,
    fontWeight: "700",
    color: palette.ink,
    textAlign: "center",
  },
  utilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  utilityText: {
    fontSize: 11,
    fontWeight: "700",
    color: palette.white,
    textTransform: "uppercase",
  },
  folderPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderRadius: radii.pill,
    backgroundColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  folderPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.white,
  },
  flexSpacer: {
    flex: 1,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheetCard: {
    backgroundColor: palette.surface,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    padding: spacing.xl,
    gap: spacing.lg,
    maxHeight: "80%",
  },
  sheetEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.mutedInk,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sheetCreateRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sheetCreateInput: {
    flex: 1,
    backgroundColor: palette.backgroundMuted,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    height: 48,
    fontSize: 16,
    color: palette.ink,
  },
  sheetCreateButton: {
    backgroundColor: palette.accent,
    borderRadius: radii.md,
    paddingHorizontal: spacing.xl,
    justifyContent: "center",
  },
  sheetCreateButtonDisabled: {
    opacity: 0.5,
  },
  sheetCreateButtonPressed: {
    opacity: 0.8,
  },
  sheetCreateButtonText: {
    color: palette.white,
    fontWeight: "700",
  },
  sheetMissionRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  sheetMissionChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
  },
  sheetMissionChipActive: {
    backgroundColor: palette.accent,
    borderColor: palette.accent,
  },
  sheetMissionChipPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  sheetMissionChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: palette.mutedInk,
  },
  sheetMissionChipTextActive: {
    color: palette.white,
  },
  sheetCategoryList: {
    gap: spacing.xs,
  },
  sheetCategoryButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  sheetCategoryButtonActive: {
    backgroundColor: palette.accentSoft,
  },
  sheetCategoryButtonPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  sheetCategoryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: palette.ink,
  },
  sheetCategoryButtonTextActive: {
    color: palette.accentStrong,
    fontWeight: "700",
  },
});
