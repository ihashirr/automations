import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useQuery } from "convex/react";
import { startTransition, useEffect, useMemo, useRef, useState, ReactNode } from "react";
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
import { api } from "../../convex/_generated/api";
import { AppBottomSheet } from "../components/AppBottomSheet";
import { AppTip } from "../components/AppTip";
import { CaptureMapPicker } from "../components/CaptureMapPicker";
import { getVisitOutcomeLabel, visitOutcomeOptions } from "../constants/visit-outcomes";
import { getMissionDefinition, missionCatalog } from "../constants/missions";
import { palette, radii, shadows, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { formatCaptureTime, formatCoordinates, normalizeText, sanitizePhoneInput } from "../lib/format";
import { playMissionAccomplishedHaptic, playPinSuccessHaptic, playSelectionHaptic } from "../lib/haptics";
import { mapPickerAssetsToDraftImages } from "../lib/images";
import { getLocationLabel, resolveLocationDetails } from "../lib/location";
import { DraftImage, DuplicateCandidate, ShopDraft } from "../types/shops";

type FlashState = { tone: "success" | "warning" | "error"; message: string };
type Coordinates = { lat: number; lng: number };

const DEFAULT_MAP_COORDINATES: Coordinates = { lat: 24.4539, lng: 54.3773 };

const COLORS = {
  bg: "#F8FAFC",
  card: "#FFFFFF",
  text: "#111827",
  textMuted: "#6B7280",
  border: "#E5E7EB",
  inputBg: "#F9FAFB",
  accent: palette.accent,
  accentStrong: palette.accentStrong,
  success: "#1f8a5b",
  successSoft: "#E8F6EF",
  warning: "#a16207",
  warningSoft: "#FFF3D6",
  danger: palette.danger,
  dangerSoft: "#FDEDEC",
  panel: "#FFF7F2",
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
    outcome: null,
    images: [],
    location: null,
  };
}

function isDraftPristine(draft: ShopDraft) {
  return !draft.name && !draft.phone && !draft.contactPerson && !draft.referredBy && !draft.outcome && !draft.location && draft.images.length === 0;
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
  const { isOnline, pendingCaptures, pendingCount, saveCapture } = useCaptureQueue();
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
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const phoneRef = useRef<TextInput>(null);
  const contactRef = useRef<TextInput>(null);
  const referredByRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const duplicateNeighborhood = draft.neighborhood || draft.location?.formattedAddress.split(",")[0]?.trim() || "";
  const remoteDuplicates = useQuery(api.shops.findPotentialDuplicates, {
    name: draft.name,
    neighborhood: duplicateNeighborhood,
    phone: draft.phone,
  });
  const localDuplicates = useMemo<DuplicateCandidate[]>(() => {
    const normalizedName = normalizeText(draft.name).toLowerCase();
    const normalizedNeighborhood = normalizeText(duplicateNeighborhood).toLowerCase();
    const normalizedPhone = sanitizePhoneInput(draft.phone);

    if (!normalizedName && !normalizedPhone) {
      return [];
    }

    return pendingCaptures
      .filter((capture) => {
        const samePhone = normalizedPhone && sanitizePhoneInput(capture.phone) === normalizedPhone;
        const sameNameAndArea =
          normalizedName &&
          normalizedNeighborhood &&
          normalizeText(capture.name).toLowerCase() === normalizedName &&
          normalizeText(capture.neighborhood).toLowerCase() === normalizedNeighborhood;

        return Boolean(samePhone || sameNameAndArea);
      })
      .slice(0, 3)
      .map((capture) => ({
        id: capture.localId,
        category: capture.category,
        mission: capture.mission,
        name: capture.name,
        neighborhood: capture.neighborhood,
        phone: capture.phone,
        outcome: capture.outcome ?? "unknown",
        createdAt: capture.createdAt,
        source: "queued",
      }));
  }, [draft.name, draft.phone, duplicateNeighborhood, pendingCaptures]);
  const duplicateCandidates = useMemo<DuplicateCandidate[]>(() => {
    const liveDuplicates = (remoteDuplicates ?? []).map((candidate) => ({
      id: candidate._id,
      category: candidate.category,
      mission: candidate.mission,
      name: candidate.name,
      neighborhood: candidate.neighborhood,
      phone: candidate.phone,
      outcome: candidate.outcome,
      createdAt: candidate.createdAt,
      source: "live" as const,
    }));
    const merged = new Map<string, DuplicateCandidate>();

    for (const candidate of [...localDuplicates, ...liveDuplicates]) {
      merged.set(String(candidate.id), candidate);
    }

    return [...merged.values()].sort((left, right) => right.createdAt - left.createdAt).slice(0, 3);
  }, [localDuplicates, remoteDuplicates]);

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

  async function persistDraft() {
    if (!draft.name.trim()) {
      showFlash("error", "Shop name is required.");
      nameRef.current?.focus();
      return;
    }
    if (!draft.location) {
      showFlash("error", "Choose a location first.");
      return;
    }
    if (!draft.outcome) {
      showFlash("error", "Select the visit outcome.");
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

  async function handleSave() {
    if (duplicateCandidates.length > 0) {
      const duplicateSummary = duplicateCandidates
        .map((candidate) => `${candidate.name} • ${candidate.neighborhood || "Unknown area"} • ${candidate.source === "live" ? "Live" : "Queued"}`)
        .join("\n");

      Alert.alert(
        "Possible duplicate",
        `${duplicateSummary}\n\nSave anyway?`,
        [
          { text: "Review", style: "cancel" },
          {
            text: "Save Anyway",
            style: "destructive",
            onPress: () => {
              void persistDraft();
            },
          },
        ],
      );
      return;
    }

    await persistDraft();
  }

  const saveDisabled = isSaving || !draft.name.trim() || !draft.location || !draft.outcome;
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
            <Text style={styles.heroTitle}>Quick Visit</Text>
            <Pressable onPress={() => { void playSelectionHaptic(); openFolderPicker(); }} style={({ pressed }) => [styles.destinationCard, pressed && styles.pressedDestinationCard]}>
              <View style={styles.destinationIcon}>
                <FolderOpen color={COLORS.accentStrong} size={18} />
              </View>
              <View style={styles.destinationCopy}>
                <Text style={styles.destinationLabel}>Saving Into</Text>
                <Text style={styles.destinationValue}>{draft.mission}</Text>
                <Text style={styles.destinationMeta}>{draft.category || "Unsorted"} folder</Text>
              </View>
              <View style={styles.destinationAction}>
                <Text style={styles.destinationActionText}>Change</Text>
                <ChevronDown color={COLORS.accentStrong} size={14} />
              </View>
            </Pressable>
            <AppTip
              message="Default is quick save into your current folder. Change it only when this visit belongs somewhere else."
              title="Save Destination"
            />
          </View>

          {duplicateCandidates.length > 0 ? (
            <View style={styles.duplicateCard}>
              <Text style={styles.duplicateTitle}>Possible duplicate</Text>
              <Text style={styles.duplicateBody}>
                This shop may already exist. Review before saving another record.
              </Text>
              {duplicateCandidates.map((candidate) => (
                <View key={`${candidate.source}-${candidate.id}`} style={styles.duplicateRow}>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.duplicateName}>
                      {candidate.name}
                    </Text>
                    <Text numberOfLines={1} style={styles.duplicateMeta}>
                      {candidate.neighborhood || "Unknown area"} • {getVisitOutcomeLabel(candidate.outcome)} • {candidate.source === "live" ? "Live" : "Queued"} • {formatCaptureTime(candidate.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Images</Text>
            <AppTip
              message="Capture a quick storefront shot first. It becomes the visual reference for this lead across the app."
              tone="info"
            />
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
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("name")}
                onSubmitEditing={() => phoneRef.current?.focus()}
                placeholder="Shop Name"
                placeholderTextColor={COLORS.textMuted}
                ref={nameRef}
                returnKeyType="next"
                style={[styles.inputLarge, focusedField === "name" && styles.inputFocused]}
                value={draft.name}
              />
              <View style={styles.actionRowTight}>
                <TextInput
                  keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                  onChangeText={(value) => updateField("phone", value)}
                  onBlur={() => setFocusedField(null)}
                  onFocus={() => setFocusedField("phone")}
                  onSubmitEditing={() => contactRef.current?.focus()}
                  placeholder="Phone"
                  placeholderTextColor={COLORS.textMuted}
                  ref={phoneRef}
                  returnKeyType="next"
                  textContentType="telephoneNumber"
                  style={[styles.inputDense, styles.flex, focusedField === "phone" && styles.inputFocused]}
                  value={draft.phone}
                />
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(value) => updateField("contactPerson", value)}
                  onBlur={() => setFocusedField(null)}
                  onFocus={() => setFocusedField("contactPerson")}
                  onSubmitEditing={() => referredByRef.current?.focus()}
                  placeholder="Manager"
                  placeholderTextColor={COLORS.textMuted}
                  ref={contactRef}
                  returnKeyType="next"
                  style={[styles.inputDense, styles.flex, focusedField === "contactPerson" && styles.inputFocused]}
                  value={draft.contactPerson}
                />
              </View>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("referredBy", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("referredBy")}
                onSubmitEditing={() => Keyboard.dismiss()}
                placeholder="Referred By"
                placeholderTextColor={COLORS.textMuted}
                ref={referredByRef}
                returnKeyType="done"
                style={[styles.inputDense, focusedField === "referredBy" && styles.inputFocused]}
                value={draft.referredBy}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.eyebrow}>Visit Outcome</Text>
              <View style={[styles.statusBadge, draft.outcome ? styles.statusConfirmed : styles.statusPending]}>
                <Text style={[styles.statusBadgeText, draft.outcome ? styles.statusConfirmedText : styles.statusPendingText]}>
                  {draft.outcome ? "Selected" : "Required"}
                </Text>
              </View>
            </View>
            <AppTip
              message="Every visit should end with one clear outcome so you can review the day without guessing what happened."
              tone="info"
            />
            <View style={styles.outcomeGrid}>
              {visitOutcomeOptions.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    void playSelectionHaptic();
                    updateField("outcome", option.id);
                  }}
                  style={({ pressed }) => [
                    styles.outcomeChip,
                    draft.outcome === option.id && styles.outcomeChipActive,
                    pressed && draft.outcome !== option.id && styles.pressedOpacity,
                  ]}
                >
                  <Text style={[styles.outcomeChipText, draft.outcome === option.id && styles.outcomeChipTextActive]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
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
            <AppTip
              message="Use current GPS for speed, or open the map when you need to place the lead precisely."
              tone="info"
            />
            
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
                <View style={styles.emptyLocationRow}>
                  <MapPinned color={COLORS.textMuted} size={16} />
                  <Text style={styles.emptyLocationText}>Location not set</Text>
                </View>
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
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("neighborhood")}
                placeholder="Area/Landmark (Optional)"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.inputDense, { marginTop: spacing.md }, focusedField === "neighborhood" && styles.inputFocused]}
                value={draft.neighborhood}
              />
            )}
          </View>
        </ScrollView>

        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Text style={[styles.saveStatus, !saveDisabled && styles.saveStatusReady]}>
            {saveDisabled
              ? !draft.name.trim()
                ? "Missing: shop name"
                : !draft.outcome
                  ? "Missing: visit outcome"
                  : "Missing: location"
              : "Ready to save"}
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
    <AppBottomSheet
      description="Select the operational module and folder before you save. This same modal pattern is used for lead management flows."
      onClose={onClose}
      title="Save Destination"
      visible={visible}
    >
      <AppTip
        message="Your active destination controls where the lead appears in list views and mission folders right after save."
        tone="info"
      />

      <View style={styles.sheetMissionSection}>
        <Text style={styles.sheetSectionLabel}>Module</Text>
        <View style={styles.sheetChipRow}>
          {missionCatalog.map((option) => (
            <Pressable
              key={option.id}
              onPress={() => {
                void playSelectionHaptic();
                onMissionChange(option.id);
              }}
              style={({ pressed }) => [
                styles.destinationChip,
                option.id === activeMissionId && styles.destinationChipActive,
                pressed && option.id !== activeMissionId && styles.pressedOpacity,
              ]}
            >
              <Text
                style={[
                  styles.destinationChipText,
                  option.id === activeMissionId && styles.destinationChipTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.sheetCreatePanel}>
        <View style={styles.sheetCreateHeader}>
          <Text style={styles.sheetSectionLabel}>Create Folder</Text>
          <Text style={styles.sheetCreateHint}>Custom folders stay inside the selected module.</Text>
        </View>
        <View style={styles.actionRowTight}>
          <TextInput
            onChangeText={setNewFolderName}
            placeholder="New folder name"
            placeholderTextColor={COLORS.textMuted}
            style={styles.sheetInput}
            value={newFolderName}
          />
          <Pressable
            onPress={() => {
              void playSelectionHaptic();
              const created = onCreateCategory({ label: newFolderName, missionId: activeMissionId });
              if (created) {
                setNewFolderName("");
                onSelect(activeMissionId, created.id);
              }
            }}
            style={({ pressed }) => [
              styles.sheetAdd,
              !newFolderName.trim() && styles.actionDisabled,
              pressed && newFolderName.trim() && styles.pressedOpacity,
            ]}
          >
            <Text style={styles.sheetAddText}>Add</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sheetCategorySection}>
        <Text style={styles.sheetSectionLabel}>Folder</Text>
        <View style={styles.sheetList}>
          {missionCategories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => {
                void playSelectionHaptic();
                onSelect(activeMissionId, category.id);
              }}
              style={({ pressed }) => [
                styles.sheetItem,
                category.id === selectedCategoryId && styles.sheetItemActive,
                pressed && category.id !== selectedCategoryId && styles.pressedOpacity,
              ]}
            >
              <View style={styles.sheetItemCopy}>
                <Text style={[styles.sheetItemText, category.id === selectedCategoryId && styles.sheetItemTextActive]}>
                  {category.label}
                </Text>
                <Text style={styles.sheetItemMeta}>
                  {category.id === selectedCategoryId ? "Current destination" : "Tap to save into this folder"}
                </Text>
              </View>
              {category.id === selectedCategoryId ? <Text style={styles.sheetItemBadge}>Selected</Text> : null}
            </Pressable>
          ))}
        </View>
      </View>
    </AppBottomSheet>
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
  
  header: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    ...shadows.card,
  },
  badgeLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  badgeText: { fontSize: typography.overline, fontWeight: "800", color: COLORS.text, textTransform: "uppercase" },
  badgeCount: { fontSize: typography.overline, fontWeight: "800", color: COLORS.warning, textTransform: "uppercase" },
  heroTitle: { fontSize: 28, fontWeight: "900", color: COLORS.text },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    padding: spacing.md,
  },
  pressedDestinationCard: {
    backgroundColor: COLORS.inputBg,
  },
  destinationIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.panel,
  },
  destinationCopy: {
    flex: 1,
    gap: 2,
  },
  destinationLabel: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  destinationValue: {
    fontSize: typography.body,
    fontWeight: "800",
    color: COLORS.text,
  },
  destinationMeta: {
    fontSize: typography.label,
    color: COLORS.textMuted,
  },
  destinationAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  destinationActionText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: COLORS.accentStrong,
  },

  card: {
    gap: spacing.md,
    borderRadius: radii.md,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: spacing.md,
    ...shadows.card,
  },
  duplicateCard: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#F1B08F",
    backgroundColor: "#FFF7F2",
    padding: spacing.md,
    ...shadows.card,
  },
  duplicateTitle: {
    fontSize: typography.body,
    fontWeight: "800",
    color: COLORS.warning,
  },
  duplicateBody: {
    fontSize: typography.label,
    color: COLORS.textMuted,
  },
  duplicateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  duplicateName: {
    fontSize: typography.label,
    fontWeight: "700",
    color: COLORS.text,
  },
  duplicateMeta: {
    fontSize: typography.label,
    color: COLORS.textMuted,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { fontSize: typography.overline, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  
  captureAreaSmall: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 80, borderRadius: radii.sm, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.inputBg },
  capturePrimaryText: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  
  thumbnailRow: { gap: spacing.xs, paddingRight: spacing.xs },
  thumbnailAddTile: { width: 70, height: 70, borderRadius: radii.sm, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.inputBg },
  thumbnailFrame: { width: 70, height: 70, borderRadius: radii.sm, overflow: "hidden", backgroundColor: COLORS.border },
  thumbnailImage: { width: "100%", height: "100%" },
  thumbnailRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },
  ghostActionRow: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 },
  ghostActionText: { fontSize: typography.label, fontWeight: "600", color: COLORS.textMuted },

  inputsBlock: { gap: 10 },
  inputLarge: { height: 56, fontSize: 24, fontWeight: "800", color: COLORS.text, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  inputDense: { height: 46, fontSize: typography.body, fontWeight: "600", color: COLORS.text, borderBottomWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  inputFocused: { borderColor: "#3B82F6" },
  outcomeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  outcomeChip: {
    minHeight: 42,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    alignItems: "center",
    justifyContent: "center",
  },
  outcomeChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "#FFF3EC",
  },
  outcomeChipText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: COLORS.text,
  },
  outcomeChipTextActive: {
    color: COLORS.accentStrong,
  },

  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  statusPending: { backgroundColor: COLORS.warningSoft },
  statusConfirmed: { backgroundColor: COLORS.successSoft },
  statusBadgeText: { fontSize: typography.overline, fontWeight: "800", textTransform: "uppercase" },
  statusPendingText: { color: COLORS.warning },
  statusConfirmedText: { color: COLORS.success },

  emptyLocationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  emptyLocationText: { fontSize: typography.body, color: COLORS.textMuted, fontWeight: "600" },
  locationFoundBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border, padding: spacing.sm, borderRadius: radii.sm },
  locationAreaName: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  locationSecondary: { fontSize: typography.label, color: COLORS.textMuted, marginTop: 2 },
  changeBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: radii.pill },
  changeBtnText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text },

  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.card,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  saveStatus: { fontSize: typography.body, fontWeight: "700", color: COLORS.textMuted },
  saveStatusReady: { color: COLORS.success },
  saveButton: { minWidth: 120, height: 48, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.accent },
  saveButtonDisabled: { backgroundColor: "#D1D5DB" },
  saveButtonText: { fontSize: typography.body, fontWeight: "800", color: palette.white },

  primaryAction: { flex: 1, height: 48, borderRadius: radii.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.accent },
  primaryActionText: { fontSize: typography.label, fontWeight: "800", color: palette.white },
  secondaryAction: { flex: 1, height: 48, borderRadius: radii.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  secondaryActionText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text },

  actionDisabled: { opacity: 0.5 },
  pressedOpacity: { opacity: 0.7 },
  pressedBg: { backgroundColor: COLORS.border },

  toast: { position: "absolute", left: spacing.lg, right: spacing.lg, borderRadius: radii.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  toastSuccess: { backgroundColor: COLORS.successSoft },
  toastWarning: { backgroundColor: COLORS.warningSoft },
  toastError: { backgroundColor: COLORS.dangerSoft },
  toastText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text, textAlign: "center" },

  sheetMissionSection: {
    gap: spacing.sm,
  },
  sheetCategorySection: {
    gap: spacing.sm,
  },
  sheetSectionLabel: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  sheetChipRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  destinationChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  destinationChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "#FFF3EC",
  },
  destinationChipText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  destinationChipTextActive: {
    color: COLORS.accentStrong,
  },
  sheetCreatePanel: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    padding: spacing.md,
  },
  sheetCreateHeader: {
    gap: 2,
  },
  sheetCreateHint: {
    fontSize: typography.label,
    color: COLORS.textMuted,
  },
  sheetInput: { flex: 1, backgroundColor: COLORS.inputBg, borderRadius: radii.sm, paddingHorizontal: spacing.md, height: 44, fontSize: typography.body, color: COLORS.text },
  sheetAdd: { minWidth: 80, borderRadius: radii.sm, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border },
  sheetAddText: { color: COLORS.text, fontWeight: "700" },
  sheetList: { gap: 4 },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
  },
  sheetItemActive: { backgroundColor: "#FFF3EC", borderColor: COLORS.accent },
  sheetItemCopy: {
    flex: 1,
    gap: 2,
  },
  sheetItemText: { fontSize: typography.body, fontWeight: "600", color: COLORS.text },
  sheetItemTextActive: { color: COLORS.text, fontWeight: "700" },
  sheetItemMeta: {
    fontSize: typography.label,
    color: COLORS.textMuted,
  },
  sheetItemBadge: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
