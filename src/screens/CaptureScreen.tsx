import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { startTransition, useEffect, useRef, useState } from "react";
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
} from "lucide-react-native";
import { CaptureField } from "../components/CaptureField";
import { CaptureMapPicker } from "../components/CaptureMapPicker";
import { PhotoStrip } from "../components/PhotoStrip";
import { getMissionDefinition, missionCatalog } from "../constants/missions";
import { palette, radii, shadows, spacing, typography } from "../constants/theme";
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
  const showedReadyRef = useRef(false);

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

  useEffect(() => {
    const ready = Boolean(draft.name.trim() && draft.location);
    if (ready && !showedReadyRef.current) {
      setFlashState({ tone: "success", message: "Ready to save" });
    }
    showedReadyRef.current = ready;
  }, [draft.location, draft.name]);

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
  const locationTitle = isResolvingLocation ? "Getting location..." : draft.location ? "Location confirmed" : "Choose a location";
  const locationLine = draft.location ? draft.neighborhood || getLocationLabel(draft.location) || "Pinned coordinates saved" : "Use current GPS or choose a point on the map.";

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.row}>
              <View style={styles.badge}>
                {isOnline ? <SignalHigh color={palette.success} size={14} /> : <SignalZero color={palette.warning} size={14} />}
                <Text style={styles.badgeText}>{isOnline ? "Live capture" : "Queueing locally"}</Text>
              </View>
              <View style={styles.badgeAlt}>
                <Text style={styles.badgeAltText}>{pendingCount} pending</Text>
              </View>
            </View>
            <Text style={styles.heroTitle}>Fast Lead Capture</Text>
            <Text style={styles.heroSubtitle}>Save the business, lock its exact spot, and keep moving.</Text>
            <Pressable onPress={() => { void playSelectionHaptic(); openFolderPicker(); }} style={({ pressed }) => [styles.folderButton, pressed && styles.folderButtonPressed]}>
              <View style={styles.folderCopy}>
                <Text style={styles.label}>Saving Into</Text>
                <Text style={styles.folderValue}>{draft.mission} / {draft.category || "Unsorted"}</Text>
              </View>
              <View style={styles.row}>
                <FolderOpen color={palette.accentStrong} size={18} />
                <ChevronDown color={palette.accentStrong} size={16} />
              </View>
            </Pressable>
          </View>

          <Card title="Capture the storefront" eyebrow="Images" meta={`${draft.images.length}/6`}>
            <Pressable onPress={() => { void playSelectionHaptic(); void requestCameraAndCapture(); }} style={({ pressed }) => [styles.captureArea, pressed && styles.captureAreaPressed]}>
              <View style={styles.captureIcon}><Camera color={palette.accentStrong} size={22} /></View>
              <Text style={styles.captureTitle}>{draft.images.length > 0 ? "Add another shot" : "Tap to capture"}</Text>
              <Text style={styles.captureText}>Take a photo immediately, then review thumbnails below.</Text>
            </Pressable>
            <View style={styles.actionRow}>
              <PrimaryAction label="Open Camera" icon={<Camera color={palette.white} size={18} />} onPress={() => void requestCameraAndCapture()} />
              <SecondaryAction label="Choose Images" icon={<Images color={palette.ink} size={18} />} onPress={() => void requestLibraryAndPick()} />
            </View>
            <PhotoStrip images={draft.images} onRemove={(index) => updateField("images", draft.images.filter((_, imageIndex) => imageIndex !== index))} />
          </Card>

          <Card title="Move through the form quickly" eyebrow="Business Details">
            <View style={styles.block}>
              <Text style={styles.label}>Shop Name</Text>
              <TextInput
                autoCapitalize="words"
                autoFocus
                blurOnSubmit={false}
                onChangeText={(value) => updateField("name", value)}
                onSubmitEditing={() => phoneRef.current?.focus()}
                placeholder="Business name"
                placeholderTextColor={palette.mutedInk}
                ref={nameRef}
                returnKeyType="next"
                style={styles.bigInput}
                value={draft.name}
              />
            </View>
            <View style={styles.actionRow}>
              <View style={styles.flex}>
                <CaptureField
                  keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                  label="Phone"
                  onChangeText={(value) => updateField("phone", value)}
                  onSubmitEditing={() => contactRef.current?.focus()}
                  placeholder="0501234567"
                  ref={phoneRef}
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  value={draft.phone}
                />
              </View>
              <View style={styles.flex}>
                <CaptureField
                  autoCapitalize="words"
                  label="Manager"
                  onChangeText={(value) => updateField("contactPerson", value)}
                  onSubmitEditing={() => referredByRef.current?.focus()}
                  placeholder="Contact name"
                  ref={contactRef}
                  returnKeyType="next"
                  value={draft.contactPerson}
                />
              </View>
            </View>
            <CaptureField
              autoCapitalize="words"
              label="Referred By"
              onChangeText={(value) => updateField("referredBy", value)}
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder="Referral or source"
              ref={referredByRef}
              returnKeyType="done"
              value={draft.referredBy}
            />
          </Card>

          <Card title={locationTitle} eyebrow="Location">
            <View style={styles.locationStatus}>
              <MapPinned color={draft.location ? palette.success : palette.accentStrong} size={16} />
              <Text style={[styles.locationStatusText, draft.location && styles.locationStatusTextSuccess]}>
                {draft.location ? "Confirmed" : "Pending"}
              </Text>
            </View>
            <View style={styles.locationBox}>
              <Text style={styles.locationTitle}>{locationLine}</Text>
              <Text style={styles.locationText}>{draft.location ? getLocationLabel(draft.location) : "No location saved yet"}</Text>
              {draft.location ? <Text style={styles.coordinates}>{formatCoordinates(draft.location)}</Text> : null}
            </View>
            <View style={styles.actionRow}>
              <PrimaryAction label="Use Current Location" icon={<Navigation color={palette.white} size={18} />} onPress={() => void handleUseCurrentLocation()} disabled={isResolvingLocation || isPreparingMap} />
              <SecondaryAction label="Choose on Map" icon={<MapPinned color={palette.ink} size={18} />} onPress={() => void handleOpenMapPicker()} disabled={isResolvingLocation || isPreparingMap} />
            </View>
            <CaptureField
              autoCapitalize="words"
              label="Area / Landmark"
              onChangeText={(value) => updateField("neighborhood", value)}
              placeholder="Auto-filled after location confirm"
              value={draft.neighborhood}
            />
          </Card>
        </ScrollView>

        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <View style={styles.flex}>
            <Text style={styles.saveTitle}>{saveDisabled ? "Add business name and location" : "Ready to save"}</Text>
            <Text style={styles.saveSubtitle}>{draft.images.length} photos • {draft.location ? locationLine : "Location not locked"}</Text>
          </View>
          <Pressable disabled={saveDisabled} onPress={() => { void playSelectionHaptic(); void handleSave(); }} style={({ pressed }) => [styles.saveButton, saveDisabled && styles.saveButtonDisabled, pressed && !saveDisabled && styles.saveButtonPressed]}>
            {isSaving ? <ActivityIndicator color={palette.white} /> : <><Check color={palette.white} size={18} /><Text style={styles.saveButtonText}>Save Lead</Text></>}
          </Pressable>
        </View>

        {flashState ? (
          <View style={[styles.toast, flashState.tone === "success" && styles.toastSuccess, flashState.tone === "warning" && styles.toastWarning, flashState.tone === "error" && styles.toastError, { bottom: insets.bottom + 84 }]}>
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

function Card({ eyebrow, meta, title, children }: { eyebrow: string; meta?: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.flex}>
          <Text style={styles.label}>{eyebrow}</Text>
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        {meta ? <Text style={styles.cardMeta}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function PrimaryAction({ disabled, icon, label, onPress }: { disabled?: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={() => { void playSelectionHaptic(); onPress(); }} style={({ pressed }) => [styles.primaryAction, disabled && styles.actionDisabled, pressed && !disabled && styles.primaryActionPressed]}>
      {icon}
      <Text style={styles.primaryActionText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({ disabled, icon, label, onPress }: { disabled?: boolean; icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable disabled={disabled} onPress={() => { void playSelectionHaptic(); onPress(); }} style={({ pressed }) => [styles.secondaryAction, disabled && styles.actionDisabled, pressed && !disabled && styles.secondaryActionPressed]}>
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

  function handleCreateFolder() {
    const created = onCreateCategory({ label: newFolderName, missionId: activeMissionId });
    if (!created) return;
    setNewFolderName("");
    onSelect(activeMissionId, created.id);
  }

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <Pressable onPress={() => { void playSelectionHaptic(); onClose(); }} style={styles.sheetBackdrop}>
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <Text style={styles.label}>Folder</Text>
          <View style={styles.actionRow}>
            <TextInput
              onChangeText={setNewFolderName}
              placeholder="Create new folder"
              placeholderTextColor={palette.mutedInk}
              style={styles.sheetInput}
              value={newFolderName}
            />
            <Pressable onPress={() => { void playSelectionHaptic(); handleCreateFolder(); }} style={({ pressed }) => [styles.sheetAdd, !newFolderName.trim() && styles.actionDisabled, pressed && newFolderName.trim() && styles.primaryActionPressed]}>
              <Text style={styles.sheetAddText}>Add</Text>
            </Pressable>
          </View>
          <View style={styles.actionRow}>
            {missionCatalog.map((option) => (
              <Pressable key={option.id} onPress={() => { void playSelectionHaptic(); onMissionChange(option.id); }} style={({ pressed }) => [styles.chip, option.id === activeMissionId && styles.chipActive, pressed && option.id !== activeMissionId && styles.secondaryActionPressed]}>
                <Text style={[styles.chipText, option.id === activeMissionId && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.sheetList}>
            {missionCategories.map((category) => (
              <Pressable key={category.id} onPress={() => { void playSelectionHaptic(); onSelect(activeMissionId, category.id); }} style={({ pressed }) => [styles.sheetItem, category.id === selectedCategoryId && styles.sheetItemActive, pressed && category.id !== selectedCategoryId && styles.secondaryActionPressed]}>
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
  container: { flex: 1, backgroundColor: palette.background },
  screen: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  content: { gap: spacing.lg, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  hero: { gap: spacing.md, borderRadius: radii.lg, backgroundColor: "#161719", padding: spacing.lg, ...shadows.card },
  badge: { flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: spacing.sm, paddingVertical: 6 },
  badgeText: { fontSize: typography.overline, fontWeight: "800", color: palette.white, textTransform: "uppercase", letterSpacing: 0.6 },
  badgeAlt: { borderRadius: radii.pill, backgroundColor: "rgba(233, 107, 57, 0.18)", paddingHorizontal: spacing.sm, paddingVertical: 6 },
  badgeAltText: { fontSize: typography.overline, fontWeight: "800", color: "#FFD6C6", textTransform: "uppercase", letterSpacing: 0.6 },
  heroTitle: { fontSize: 28, fontWeight: "900", color: palette.white },
  heroSubtitle: { fontSize: typography.body, lineHeight: 24, color: "#C7C1B5" },
  folderButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md, borderRadius: radii.md, backgroundColor: "rgba(255,255,255,0.08)", padding: spacing.md },
  folderButtonPressed: { backgroundColor: "rgba(255,255,255,0.14)" },
  folderCopy: { flex: 1, gap: 4 },
  folderValue: { fontSize: typography.body, fontWeight: "700", color: palette.white },
  card: { gap: spacing.md, borderRadius: radii.lg, backgroundColor: palette.card, padding: spacing.lg, ...shadows.card },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  cardTitle: { marginTop: 2, fontSize: typography.title, fontWeight: "800", color: palette.ink },
  cardMeta: { fontSize: typography.label, fontWeight: "700", color: palette.accentStrong },
  label: { fontSize: typography.overline, fontWeight: "800", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  captureArea: { alignItems: "center", justifyContent: "center", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1.5, borderColor: palette.line, borderStyle: "dashed", backgroundColor: palette.backgroundMuted, padding: spacing.xl },
  captureAreaPressed: { backgroundColor: palette.accentSoft, borderColor: "#F2B39A" },
  captureIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", backgroundColor: palette.white },
  captureTitle: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  captureText: { fontSize: typography.label, lineHeight: 20, textAlign: "center", color: palette.mutedInk },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  primaryAction: { flex: 1, minHeight: 52, borderRadius: radii.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, backgroundColor: palette.accent },
  primaryActionPressed: { backgroundColor: palette.accentStrong },
  primaryActionText: { fontSize: typography.body, fontWeight: "800", color: palette.white },
  secondaryAction: { flex: 1, minHeight: 52, borderRadius: radii.md, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface },
  secondaryActionPressed: { backgroundColor: palette.backgroundMuted },
  secondaryActionText: { fontSize: typography.body, fontWeight: "700", color: palette.ink },
  actionDisabled: { opacity: 0.55 },
  block: { gap: spacing.xs },
  bigInput: { minHeight: 64, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: spacing.md, fontSize: 28, fontWeight: "800", color: palette.ink },
  locationStatus: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: palette.accentSoft, paddingHorizontal: spacing.sm, paddingVertical: 6 },
  locationStatusText: { fontSize: typography.overline, fontWeight: "800", color: palette.accentStrong, textTransform: "uppercase", letterSpacing: 0.6 },
  locationStatusTextSuccess: { color: palette.success },
  locationBox: { gap: spacing.xs, borderRadius: radii.md, backgroundColor: palette.backgroundMuted, padding: spacing.md },
  locationTitle: { fontSize: typography.body, fontWeight: "800", color: palette.ink },
  locationText: { fontSize: typography.label, lineHeight: 20, color: palette.mutedInk },
  coordinates: { fontSize: typography.overline, fontWeight: "800", color: palette.accentStrong, textTransform: "uppercase", letterSpacing: 1 },
  saveBar: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: palette.surface, paddingHorizontal: spacing.lg, paddingTop: spacing.md, ...shadows.card },
  saveTitle: { fontSize: typography.body, fontWeight: "800", color: palette.ink },
  saveSubtitle: { fontSize: typography.label, color: palette.mutedInk },
  saveButton: { minWidth: 136, minHeight: 54, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, backgroundColor: palette.accent },
  saveButtonDisabled: { backgroundColor: "#C7C1B5" },
  saveButtonPressed: { backgroundColor: palette.accentStrong },
  saveButtonText: { fontSize: typography.body, fontWeight: "800", color: palette.white },
  toast: { position: "absolute", left: spacing.lg, right: spacing.lg, borderRadius: radii.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, ...shadows.card },
  toastSuccess: { backgroundColor: palette.successSoft },
  toastWarning: { backgroundColor: palette.warningSoft },
  toastError: { backgroundColor: palette.dangerSoft },
  toastText: { fontSize: typography.label, fontWeight: "700", color: palette.ink, textAlign: "center" },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  sheetCard: { backgroundColor: palette.surface, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, padding: spacing.xl, gap: spacing.lg, maxHeight: "80%" },
  sheetInput: { flex: 1, backgroundColor: palette.backgroundMuted, borderRadius: radii.md, paddingHorizontal: spacing.md, height: 48, fontSize: typography.body, color: palette.ink },
  sheetAdd: { minWidth: 88, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: palette.accent },
  sheetAddText: { color: palette.white, fontWeight: "700" },
  chip: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipText: { fontSize: 13, fontWeight: "700", color: palette.mutedInk },
  chipTextActive: { color: palette.white },
  sheetList: { gap: spacing.xs },
  sheetItem: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radii.md },
  sheetItemActive: { backgroundColor: palette.accentSoft },
  sheetItemText: { fontSize: typography.body, fontWeight: "600", color: palette.ink },
  sheetItemTextActive: { color: palette.accentStrong, fontWeight: "700" },
});
