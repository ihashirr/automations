import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { startTransition, useEffect, useRef, useState, ReactNode } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  Check,
  ChevronDown,
  FolderOpen,
  Images,
  MapPinned,
  Navigation,
  SignalHigh,
  SignalZero,
  Trash2,
} from "lucide-react-native";
import { CaptureMapPicker } from "../components/CaptureMapPicker";
import { getMissionDefinition, missionCatalog } from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { formatCoordinates } from "../lib/format";
import { playMissionAccomplishedHaptic, playPinSuccessHaptic, playSelectionHaptic } from "../lib/haptics";
import { mapPickerAssetsToDraftImages } from "../lib/images";
import { getLocationLabel, resolveLocationDetails } from "../lib/location";
import { DraftImage, ShopDraft } from "../types/shops";

type FlashState = { tone: "success" | "warning" | "error"; message: string };
type Coordinates = { lat: number; lng: number };

const DEFAULT_MAP_COORDINATES: Coordinates = { lat: 24.4539, lng: 54.3773 };

const COLORS = {
  bg: "#090A0C",
  card: "#161719",
  text: "#FFFFFF",
  textMuted: "#8E8E93",
  border: "rgba(255,255,255,0.08)",
  inputBg: "rgba(255,255,255,0.04)",
  accent: palette.accent,
  accentStrong: palette.accentStrong,
  success: "#1f8a5b",
  successSoft: "rgba(31, 138, 91, 0.2)",
  warning: "#a16207",
  warningSoft: "rgba(161, 98, 7, 0.2)",
  danger: palette.danger,
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
  return !draft.name && !draft.phone && !draft.contactPerson && !draft.referredBy && !draft.location && draft.images.length === 0;
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
  const [draft, setDraft] = useState<ShopDraft>(() => createEmptyDraft(activeMissionLabel, activeCategoryLabel));
  const [flashState, setFlashState] = useState<FlashState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isPreparingMap, setIsPreparingMap] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapCoordinates, setMapCoordinates] = useState<Coordinates | null>(null);
  const [pickerMissionId, setPickerMissionId] = useState(activeMissionId);
  const phoneRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const referredByRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!flashState) return;
    const timeout = setTimeout(() => setFlashState(null), 1800);
    return () => clearTimeout(timeout);
  }, [flashState]);

  useEffect(() => {
    setDraft((current) => (isDraftPristine(current) ? createEmptyDraft(activeMissionLabel, activeCategoryLabel) : current));
  }, [activeCategoryLabel, activeMissionLabel]);

  useEffect(() => {
    if (!isFolderPickerOpen) {
      setPickerMissionId(activeMissionId);
    }
  }, [activeMissionId, isFolderPickerOpen]);

  function updateField<Key extends keyof ShopDraft>(key: Key, value: ShopDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function showFlash(tone: FlashState["tone"], message: string) {
    setFlashState({ tone, message });
  }

  function openFolderPicker() {
    const missionId = missionCatalog.find((mission) => mission.label === draft.mission)?.id ?? activeMissionId;
    setPickerMissionId(missionId);
    setIsFolderPickerOpen(true);
  }

  function applyFolderSelection(missionId: string, categoryId: string) {
    const mission = getMissionDefinition(missionId);
    const category = getCategoryById(missionId, categoryId);
    setDraft((current) => ({ ...current, mission: mission.label, category: category?.label ?? "Unsorted" }));
    startCategoryMission({ missionId, categoryId });
    setIsFolderPickerOpen(false);
  }

  async function getCurrentCoordinates() {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    const permission = existingPermission.status === "granted" ? existingPermission : await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") {
      throw new Error("Location permission is required.");
    }
    const currentLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { lat: currentLocation.coords.latitude, lng: currentLocation.coords.longitude };
  }

  async function resolveAndApplyLocation(coordinates: Coordinates) {
    setIsResolvingLocation(true);
    try {
      const details = await resolveLocationDetails({
        allowReverseGeocode: Platform.OS !== "web",
        coordinates,
        reverseGeocode: () => Location.reverseGeocodeAsync({ latitude: coordinates.lat, longitude: coordinates.lng }),
      });
      updateField("location", { ...coordinates, formattedAddress: details.formattedAddress });
      updateField("neighborhood", details.neighborhood);
      await playPinSuccessHaptic();
      showFlash("success", "Location saved");
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to save this location.");
    } finally {
      setIsResolvingLocation(false);
    }
  }

  async function handleUseCurrentLocation() {
    try {
      await resolveAndApplyLocation(await getCurrentCoordinates());
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Unable to get your current location.");
    }
  }

  async function handleOpenMapPicker() {
    setIsPreparingMap(true);
    try {
      if (draft.location) {
        setMapCoordinates({ lat: draft.location.lat, lng: draft.location.lng });
      } else {
        try {
          setMapCoordinates(await getCurrentCoordinates());
        } catch {
          setMapCoordinates(DEFAULT_MAP_COORDINATES);
          showFlash("warning", "Map opened without current GPS lock.");
        }
      }
      setIsMapPickerOpen(true);
    } finally {
      setIsPreparingMap(false);
    }
  }

  function appendImages(nextImages: DraftImage[]) {
    const available = Math.max(0, 6 - draft.images.length);
    if (available === 0) {
      showFlash("warning", "Maximum 6 images per lead.");
      return;
    }
    const accepted = nextImages.slice(0, available);
    if (accepted.length === 0) return;
    updateField("images", [...draft.images, ...accepted]);
    showFlash("success", accepted.length === 1 ? "Image added" : `${accepted.length} images added`);
  }

  async function requestCameraAndCapture() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Camera access needed", "Allow camera access to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!result.canceled) appendImages(mapPickerAssetsToDraftImages(result.assets));
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
      selectionLimit: Math.max(1, 6 - draft.images.length),
    });
    if (!result.canceled) appendImages(mapPickerAssetsToDraftImages(result.assets));
  }

  async function handleSave() {
    if (!draft.name.trim()) {
      showFlash("error", "Shop name is required.");
      nameRef.current?.focus();
      return;
    }
    if (!draft.location) {
      showFlash("error", "Choose a location first.");
      return;
    }

    setIsSaving(true);
    try {
      const completedDraft = draft;
      const result = await saveCapture(completedDraft);
      startTransition(() => setDraft(createEmptyDraft(completedDraft.mission, completedDraft.category)));
      nameRef.current?.focus();
      void playMissionAccomplishedHaptic();
      showFlash(result.status === "saved" ? "success" : "warning", result.status === "saved" ? "Lead saved" : result.reason);
    } catch (error) {
      showFlash("error", error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
    }
  }

  const saveDisabled = isSaving || !draft.name.trim() || !draft.location;
  const selectedCategoryId = getCategoryIdFromLabel(pickerMissionId, draft.category) ?? (pickerMissionId === activeMissionId ? activeCategoryId : null);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.header}>
            <View style={styles.row}>
              <View style={styles.badgeLine}>
                {isOnline ? <SignalHigh color={COLORS.success} size={14} /> : <SignalZero color={COLORS.warning} size={14} />}
                <Text style={styles.badgeText}>{isOnline ? "Live" : "Queueing"}</Text>
              </View>
              {pendingCount > 0 && (
                <Text style={styles.badgeCount}>{pendingCount} pending</Text>
              )}
            </View>
            <Text style={styles.heroTitle}>Fast Lead Capture</Text>
            <Pressable onPress={() => { void playSelectionHaptic(); openFolderPicker(); }} style={({ pressed }) => [styles.folderPill, pressed && styles.pressedOpacity]}>
              <Text style={styles.folderLabel}>Saving into:</Text>
              <Text style={styles.folderValue}>{draft.mission} / {draft.category || "Unsorted"}</Text>
              <ChevronDown color={COLORS.textMuted} size={14} />
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Images</Text>
            {draft.images.length === 0 ? (
              <Pressable onPress={() => { void playSelectionHaptic(); void requestCameraAndCapture(); }} style={({ pressed }) => [styles.captureAreaSmall, pressed && styles.pressedBg]}>
                <Camera color={COLORS.text} size={28} />
                <Text style={styles.capturePrimaryText}>Open Camera</Text>
              </Pressable>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
                <Pressable onPress={() => { void playSelectionHaptic(); void requestCameraAndCapture(); }} style={({ pressed }) => [styles.thumbnailAddTile, pressed && styles.pressedOpacity]}>
                  <Camera color={COLORS.text} size={24} />
                </Pressable>
                {draft.images.map((img, idx) => (
                  <View key={`${img.localUri}-${idx}`} style={styles.thumbnailFrame}>
                    <Image source={{ uri: img.localUri }} style={styles.thumbnailImage} />
                    <Pressable onPress={() => { void playSelectionHaptic(); updateField("images", draft.images.filter((_, i) => i !== idx)); }} style={styles.thumbnailRemove}>
                      <Trash2 color={COLORS.bg} size={14} />
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
            <Pressable onPress={() => { void playSelectionHaptic(); void requestLibraryAndPick(); }} style={({ pressed }) => [styles.ghostActionRow, pressed && styles.pressedOpacity]}>
              <Images color={COLORS.textMuted} size={16} />
              <Text style={styles.ghostActionText}>Choose Images</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Business Details</Text>
            <View style={styles.inputsBlock}>
              <TextInput
                autoCapitalize="words"
                autoFocus
                blurOnSubmit={false}
                onChangeText={(value) => updateField("name", value)}
                onSubmitEditing={() => phoneRef.current?.focus()}
                placeholder="Shop Name"
                placeholderTextColor={COLORS.textMuted}
                ref={nameRef}
                returnKeyType="next"
                style={styles.inputLarge}
                value={draft.name}
              />
              <View style={styles.actionRowTight}>
                <TextInput
                  keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                  onChangeText={(value) => updateField("phone", value)}
                  onSubmitEditing={() => contactRef.current?.focus()}
                  placeholder="Phone"
                  placeholderTextColor={COLORS.textMuted}
                  ref={phoneRef}
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  style={[styles.inputDense, styles.flex]}
                  value={draft.phone}
                />
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(value) => updateField("contactPerson", value)}
                  onSubmitEditing={() => referredByRef.current?.focus()}
                  placeholder="Manager"
                  placeholderTextColor={COLORS.textMuted}
                  ref={contactRef}
                  returnKeyType="next"
                  style={[styles.inputDense, styles.flex]}
                  value={draft.contactPerson}
                />
              </View>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("referredBy", value)}
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder="Referred By"
                placeholderTextColor={COLORS.textMuted}
                ref={referredByRef}
                returnKeyType="done"
                style={styles.inputDense}
                value={draft.referredBy}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>Location</Text>
              <View style={[styles.statusBadge, draft.location ? styles.statusConfirmed : styles.statusPending]}>
                <Text style={[styles.statusBadgeText, draft.location ? styles.statusConfirmedText : styles.statusPendingText]}>
                  {draft.location ? "Confirmed" : "Pending"}
                </Text>
              </View>
            </View>
            
            {draft.location ? (
              <View style={styles.locationFoundBlock}>
                <View style={styles.flex}>
                  <Text style={styles.locationAreaName}>{draft.neighborhood || getLocationLabel(draft.location) || "Pinned Location"}</Text>
                  <Text style={styles.locationSecondary}>{formatCoordinates(draft.location)}</Text>
                </View>
                <Pressable onPress={() => void handleOpenMapPicker()} style={({ pressed }) => [styles.changeBtn, pressed && styles.pressedOpacity]}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.emptyLocationText}>No location set</Text>
                <View style={styles.actionRow}>
                  <PrimaryAction label="Use Current Location" icon={<Navigation size={16} color={COLORS.text} />} onPress={() => void handleUseCurrentLocation()} disabled={isResolvingLocation || isPreparingMap} />
                  <SecondaryAction label="Choose on Map" icon={<MapPinned size={16} color={COLORS.text} />} onPress={() => void handleOpenMapPicker()} disabled={isResolvingLocation || isPreparingMap} />
                </View>
              </>
            )}
            
            {draft.location && (
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("neighborhood", value)}
                placeholder="Area/Landmark (Optional)"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.inputDense, { marginTop: spacing.md }]}
                value={draft.neighborhood}
              />
            )}
          </View>
        </ScrollView>

        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={[styles.saveStatus, !saveDisabled && styles.saveStatusReady]}>
            {saveDisabled ? (draft.name ? "Missing: location" : "Missing: shop name") : "Ready to save"}
          </Text>
          <Pressable 
            disabled={saveDisabled} 
            onPress={() => { void playSelectionHaptic(); void handleSave(); }} 
            style={({ pressed }) => [
              styles.saveButton, 
              saveDisabled && styles.saveButtonDisabled, 
              pressed && !saveDisabled && styles.pressedOpacity
            ]}
          >
            {isSaving ? <ActivityIndicator color={COLORS.text} /> : <Text style={styles.saveButtonText}>Save Lead</Text>}
          </Pressable>
        </View>

        {flashState && (
          <View style={[styles.toast, flashState.tone === "success" && styles.toastSuccess, flashState.tone === "warning" && styles.toastWarning, flashState.tone === "error" && styles.toastError, { bottom: insets.bottom + 84 }]}>
            <Text style={[styles.toastText, flashState.tone === "warning" && { color: COLORS.bg }]}>{flashState.message}</Text>
          </View>
        )}

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

        <CaptureMapPicker
          initialCoordinates={mapCoordinates}
          onClose={() => setIsMapPickerOpen(false)}
          onConfirm={async (coordinates) => {
            setIsMapPickerOpen(false);
            await resolveAndApplyLocation(coordinates);
          }}
          visible={isMapPickerOpen}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

function PrimaryAction({ disabled, icon, label, onPress }: { disabled?: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={() => { void playSelectionHaptic(); onPress(); }} style={({ pressed }) => [styles.primaryAction, disabled && styles.actionDisabled, pressed && !disabled && styles.pressedOpacity]}>
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ disabled, icon, label, onPress }: { disabled?: boolean; icon: ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={() => { void playSelectionHaptic(); onPress(); }} style={({ pressed }) => [styles.secondaryAction, disabled && styles.actionDisabled, pressed && !disabled && styles.pressedOpacity]}>
      {icon}
      <Text style={styles.secondaryActionText}>{label}</Text>
    </Pressable>
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

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={() => { void playSelectionHaptic(); onClose(); }} style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <Text style={styles.sheetLabel}>Folder</Text>
          <View style={styles.actionRowTight}>
            <TextInput
              onChangeText={setNewFolderName}
              placeholder="Create new folder"
              placeholderTextColor={COLORS.textMuted}
              style={styles.sheetInput}
              value={newFolderName}
            />
            <Pressable onPress={() => { void playSelectionHaptic(); const created = onCreateCategory({ label: newFolderName, missionId: activeMissionId }); if(created){ setNewFolderName(""); onSelect(activeMissionId, created.id); } }} style={({ pressed }) => [styles.sheetAdd, !newFolderName.trim() && styles.actionDisabled, pressed && newFolderName.trim() && styles.pressedOpacity]}>
              <Text style={styles.sheetAddText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.actionRowTight}>
            {missionCatalog.map((option) => (
              <Pressable key={option.id} onPress={() => { void playSelectionHaptic(); onMissionChange(option.id); }} style={({ pressed }) => [styles.chip, option.id === activeMissionId && styles.chipActive, pressed && option.id !== activeMissionId && styles.pressedOpacity]}>
                <Text style={[styles.chipText, option.id === activeMissionId && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sheetList}>
            {missionCategories.map((category) => (
              <Pressable key={category.id} onPress={() => { void playSelectionHaptic(); onSelect(activeMissionId, category.id); }} style={({ pressed }) => [styles.sheetItem, category.id === selectedCategoryId && styles.sheetItemActive, pressed && category.id !== selectedCategoryId && styles.pressedOpacity]}>
                <Text style={[styles.sheetItemText, category.id === selectedCategoryId && styles.sheetItemTextActive]}>{category.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionRowTight: { flexDirection: "row", gap: spacing.xs },
  content: { gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  
  header: { gap: spacing.sm, paddingHorizontal: spacing.xs, paddingBottom: spacing.sm },
  badgeLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontSize: typography.overline, fontWeight: "800", color: COLORS.text, textTransform: "uppercase" },
  badgeCount: { fontSize: typography.overline, fontWeight: "800", color: COLORS.warning, textTransform: "uppercase" },
  heroTitle: { fontSize: 28, fontWeight: "900", color: COLORS.text },
  folderPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, backgroundColor: COLORS.inputBg, paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  folderLabel: { fontSize: typography.label, color: COLORS.textMuted },
  folderValue: { fontSize: typography.label, fontWeight: "700", color: COLORS.text },

  card: { gap: spacing.md, borderRadius: radii.md, backgroundColor: COLORS.card, padding: spacing.md },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: typography.overline, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  
  captureAreaSmall: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 80, borderRadius: radii.sm, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.inputBg },
  capturePrimaryText: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  
  thumbnailRow: { gap: spacing.xs, paddingRight: spacing.xs },
  thumbnailAddTile: { width: 70, height: 70, borderRadius: radii.sm, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.inputBg },
  thumbnailFrame: { width: 70, height: 70, borderRadius: radii.sm, overflow: "hidden", backgroundColor: COLORS.border },
  thumbnailImage: { width: "100%", height: "100%" },
  thumbnailRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.text, alignItems: "center", justifyContent: "center" },
  ghostActionRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  ghostActionText: { fontSize: typography.label, fontWeight: "600", color: COLORS.textMuted },

  inputsBlock: { gap: 10 },
  inputLarge: { height: 54, fontSize: 22, fontWeight: "800", color: COLORS.text, borderBottomWidth: 1, borderColor: COLORS.border },
  inputDense: { height: 44, fontSize: typography.body, fontWeight: "600", color: COLORS.text, borderBottomWidth: 1, borderColor: COLORS.border },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  statusPending: { backgroundColor: COLORS.warningSoft },
  statusConfirmed: { backgroundColor: COLORS.successSoft },
  statusBadgeText: { fontSize: typography.overline, fontWeight: "800", textTransform: "uppercase" },
  statusPendingText: { color: COLORS.warning },
  statusConfirmedText: { color: COLORS.success },

  emptyLocationText: { fontSize: typography.body, color: COLORS.textMuted, fontStyle: "italic" },
  locationFoundBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.inputBg, padding: spacing.sm, borderRadius: radii.sm },
  locationAreaName: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  locationSecondary: { fontSize: typography.label, color: COLORS.textMuted, marginTop: 2 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.border, borderRadius: radii.pill },
  changeBtnText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text },

  saveBar: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.card, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  saveStatus: { fontSize: typography.body, fontWeight: "700", color: COLORS.textMuted },
  saveStatusReady: { color: COLORS.success },
  saveButton: { minWidth: 120, height: 48, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.accent },
  saveButtonDisabled: { backgroundColor: COLORS.border },
  saveButtonText: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },

  primaryAction: { flex: 1, height: 48, borderRadius: radii.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.accent },
  primaryActionText: { fontSize: typography.label, fontWeight: "800", color: COLORS.text },
  secondaryAction: { flex: 1, height: 48, borderRadius: radii.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "transparent" },
  secondaryActionText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text },

  actionDisabled: { opacity: 0.5 },
  pressedOpacity: { opacity: 0.7 },
  pressedBg: { backgroundColor: COLORS.border },

  toast: { position: "absolute", left: spacing.lg, right: spacing.lg, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toastSuccess: { backgroundColor: COLORS.successSoft },
  toastWarning: { backgroundColor: COLORS.warningSoft },
  toastError: { backgroundColor: "#3a0b08" },
  toastText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text, textAlign: "center" },

  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.7)" },
  sheetCard: { backgroundColor: COLORS.card, borderTopLeftRadius: radii.md, borderTopRightRadius: radii.md, padding: spacing.lg, gap: spacing.md, maxHeight: "80%" },
  sheetLabel: { fontSize: typography.overline, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase" },
  sheetInput: { flex: 1, backgroundColor: COLORS.inputBg, borderRadius: radii.sm, paddingHorizontal: spacing.md, height: 44, fontSize: typography.body, color: COLORS.text },
  sheetAdd: { minWidth: 80, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.accent },
  sheetAddText: { color: COLORS.text, fontWeight: "700" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: COLORS.inputBg, borderColor: COLORS.border },
  chipText: { fontSize: 13, fontWeight: "700", color: COLORS.textMuted },
  chipTextActive: { color: COLORS.text },
  sheetList: { gap: 4 },
  sheetItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.sm, borderRadius: radii.sm },
  sheetItemActive: { backgroundColor: COLORS.inputBg },
  sheetItemText: { fontSize: typography.body, fontWeight: "600", color: COLORS.text },
  sheetItemTextActive: { color: COLORS.text, fontWeight: "700" },
});
