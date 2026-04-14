import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import { useQuery } from "convex/react";
import {
  ReactNode,
  startTransition,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
    role: "",
    referredBy: "",
    nextStep: "",
    outcome: null,
    images: [],
    location: null,
  };
}

function isDraftPristine(draft: ShopDraft) {
  return (
    !draft.name &&
    !draft.phone &&
    !draft.contactPerson &&
    !(draft.role ?? "") &&
    !draft.referredBy &&
    !(draft.nextStep ?? "") &&
    !draft.outcome &&
    !draft.location &&
    draft.images.length === 0
  );
}

export function CaptureScreen() {
  const isFocused = useIsFocused();
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
  const [showValidation, setShowValidation] = useState(false);
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isPreparingMap, setIsPreparingMap] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [mapCoordinates, setMapCoordinates] = useState<Coordinates | null>(null);
  const [pickerMissionId, setPickerMissionId] = useState(activeMissionId);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const contactRef = useRef<TextInput>(null);
  const roleRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const nextStepRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const duplicateNeighborhood = draft.neighborhood || draft.location?.formattedAddress.split(",")[0]?.trim() || "";
  const deferredDuplicateName = useDeferredValue(draft.name);
  const deferredDuplicatePhone = useDeferredValue(draft.phone);
  const deferredDuplicateNeighborhood = useDeferredValue(duplicateNeighborhood);
  const shouldCheckRemoteDuplicates =
    isFocused &&
    (sanitizePhoneInput(deferredDuplicatePhone).length >= 5 ||
      (normalizeText(deferredDuplicateName).length >= 3 &&
        normalizeText(deferredDuplicateNeighborhood).length >= 2));
  const remoteDuplicates = useQuery(
    api.shops.findPotentialDuplicates,
    shouldCheckRemoteDuplicates
      ? {
          name: deferredDuplicateName,
          neighborhood: deferredDuplicateNeighborhood,
          phone: deferredDuplicatePhone,
        }
      : "skip",
  );
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
  const hasPhone = sanitizePhoneInput(draft.phone).length > 0;
  const missingName = !draft.name.trim();
  const missingLocation = !draft.location;
  const missingOutcome = !draft.outcome;
  const isReadyToSave = !missingName && !missingLocation && !missingOutcome;

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

  function handleNumberToggle(nextState: "got" | "none") {
    if (nextState === "got") {
      phoneRef.current?.focus();
      return;
    }

    updateField("phone", "");
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
    setShowValidation(true);

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
      setShowValidation(false);
      nameRef.current?.focus();
      void playMissionAccomplishedHaptic();
      showFlash(result.status === "saved" ? "success" : "warning", result.status === "saved" ? "Visit saved" : result.reason);
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

  const selectedCategoryId = getCategoryIdFromLabel(pickerMissionId, draft.category) ?? (pickerMissionId === activeMissionId ? activeCategoryId : null);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.container}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 156 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.quickStrip}>
            <View style={styles.syncChip}>
              {isOnline ? <SignalHigh color={COLORS.success} size={14} /> : <SignalZero color={COLORS.warning} size={14} />}
              <Text style={styles.syncChipText}>{isOnline ? "Live" : "Queueing"}</Text>
            </View>
            {pendingCount > 0 ? (
              <View style={styles.pendingChip}>
                <Text style={styles.pendingChipText}>{pendingCount} pending</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.priorityCard}>
            <View style={styles.priorityHeader}>
              <View style={styles.priorityCopy}>
                <Text style={styles.eyebrow}>Quick Visit</Text>
                <Text style={styles.priorityTitle}>Shop & Contact</Text>
              </View>
              <Pressable onPress={() => { void playSelectionHaptic(); openFolderPicker(); }} style={({ pressed }) => [styles.destinationCard, pressed && styles.pressedDestinationCard]}>
                <View style={styles.destinationIcon}>
                  <FolderOpen color={COLORS.accentStrong} size={18} />
                </View>
                <View style={styles.destinationCopy}>
                  <Text numberOfLines={1} style={styles.destinationValue}>{draft.mission}</Text>
                  <Text numberOfLines={1} style={styles.destinationMeta}>{draft.category || "Unsorted"} folder</Text>
                </View>
                <ChevronDown color={COLORS.accentStrong} size={14} />
              </Pressable>
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Shop name</Text>
              <TextInput
                autoCapitalize="words"
                autoFocus
                blurOnSubmit={false}
                onChangeText={(value) => updateField("name", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("name")}
                onSubmitEditing={() => contactRef.current?.focus()}
                placeholder="Shop name"
                placeholderTextColor={COLORS.textMuted}
                ref={nameRef}
                returnKeyType="next"
                style={[
                  styles.inputHero,
                  focusedField === "name" && styles.inputFocused,
                  showValidation && missingName && styles.inputError,
                ]}
                value={draft.name}
              />
              {showValidation && missingName ? <Text style={styles.inlineError}>Shop name is required.</Text> : null}
            </View>

            <View style={[styles.locationPanel, showValidation && missingLocation && styles.validationPanel]}>
              <Text style={styles.fieldLabel}>Area or auto-location</Text>
              {draft.location ? (
                <View style={styles.locationFoundBlock}>
                  <View style={styles.flex}>
                    <Text style={styles.locationAreaName}>{draft.neighborhood || getLocationLabel(draft.location) || "Pinned location"}</Text>
                    <Text style={styles.locationSecondary}>{formatCoordinates(draft.location)}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.emptyLocationRow}>
                  <MapPinned color={COLORS.textMuted} size={16} />
                  <Text style={styles.emptyLocationText}>Add the shop location before you move on.</Text>
                </View>
              )}
              <View style={styles.actionRow}>
                <PrimaryAction
                  disabled={isResolvingLocation || isPreparingMap}
                  icon={<Navigation size={16} color={palette.white} />}
                  label={draft.location ? (isResolvingLocation ? "Refreshing..." : "Refresh GPS") : (isResolvingLocation ? "Locating..." : "Use Current")}
                  onPress={() => void handleUseCurrentLocation()}
                />
                <SecondaryAction
                  disabled={isResolvingLocation || isPreparingMap}
                  icon={<MapPinned size={16} color={COLORS.text} />}
                  label={isPreparingMap ? "Opening..." : "Pin on Map"}
                  onPress={() => void handleOpenMapPicker()}
                />
              </View>
              {showValidation && missingLocation ? <Text style={styles.inlineError}>Location is required.</Text> : null}
              {draft.location ? (
                <TextInput
                  autoCapitalize="words"
                  onChangeText={(value) => updateField("neighborhood", value)}
                  onBlur={() => setFocusedField(null)}
                  onFocus={() => setFocusedField("neighborhood")}
                  placeholder="Area / landmark"
                  placeholderTextColor={COLORS.textMuted}
                  style={[styles.inputDense, focusedField === "neighborhood" && styles.inputFocused]}
                  value={draft.neighborhood}
                />
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Decision maker</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("contactPerson", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("contactPerson")}
                onSubmitEditing={() => roleRef.current?.focus()}
                placeholder="Decision maker name"
                placeholderTextColor={COLORS.textMuted}
                ref={contactRef}
                returnKeyType="next"
                style={[styles.inputDense, focusedField === "contactPerson" && styles.inputFocused]}
                value={draft.contactPerson}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Role</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("role", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("role")}
                onSubmitEditing={() => phoneRef.current?.focus()}
                placeholder="Owner / manager / cashier"
                placeholderTextColor={COLORS.textMuted}
                ref={roleRef}
                returnKeyType="next"
                style={[styles.inputDense, focusedField === "role" && styles.inputFocused]}
                value={draft.role ?? ""}
              />
            </View>

            <View style={styles.fieldBlock}>
              <View style={styles.fieldHeaderRow}>
                <Text style={styles.fieldLabel}>Phone</Text>
                <View style={styles.toggleRow}>
                  <Pressable
                    onPress={() => {
                      void playSelectionHaptic();
                      handleNumberToggle("got");
                    }}
                    style={({ pressed }) => [
                      styles.toggleChip,
                      hasPhone && styles.toggleChipActive,
                      pressed && !hasPhone && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={[styles.toggleChipText, hasPhone && styles.toggleChipTextActive]}>Got number</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void playSelectionHaptic();
                      handleNumberToggle("none");
                    }}
                    style={({ pressed }) => [
                      styles.toggleChip,
                      !hasPhone && styles.toggleChipMutedActive,
                      pressed && hasPhone && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={[styles.toggleChipText, !hasPhone && styles.toggleChipTextMutedActive]}>No number</Text>
                  </Pressable>
                </View>
              </View>
              <TextInput
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                onChangeText={(value) => updateField("phone", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("phone")}
                onSubmitEditing={() => nextStepRef.current?.focus()}
                placeholder="Phone number"
                placeholderTextColor={COLORS.textMuted}
                ref={phoneRef}
                returnKeyType="next"
                textContentType="telephoneNumber"
                style={[styles.inputDense, focusedField === "phone" && styles.inputFocused]}
                value={draft.phone}
              />
            </View>
          </View>

          {duplicateCandidates.length > 0 ? (
            <View style={styles.duplicateCard}>
              <Text style={styles.duplicateTitle}>Possible duplicate</Text>
              <Text style={styles.duplicateBody}>Review this before creating another shop record.</Text>
              {duplicateCandidates.map((candidate) => (
                <View key={`${candidate.source}-${candidate.id}`} style={styles.duplicateRow}>
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={styles.duplicateName}>{candidate.name}</Text>
                    <Text numberOfLines={1} style={styles.duplicateMeta}>
                      {candidate.neighborhood || "Unknown area"} • {getVisitOutcomeLabel(candidate.outcome)} • {candidate.source === "live" ? "Live" : "Queued"} • {formatCaptureTime(candidate.createdAt)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : null}

          <View style={[styles.card, showValidation && missingOutcome && styles.validationPanel]}>
            <View style={styles.cardTopRow}>
              <Text style={styles.eyebrow}>Outcome</Text>
              <Text style={styles.cardMeta}>{draft.outcome ? getVisitOutcomeLabel(draft.outcome) : "Pick one"}</Text>
            </View>
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
            {showValidation && missingOutcome ? <Text style={styles.inlineError}>Outcome is required.</Text> : null}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Next step</Text>
              <TextInput
                autoCapitalize="sentences"
                onChangeText={(value) => updateField("nextStep", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => setFocusedField("nextStep")}
                placeholder="Call back, revisit, send WhatsApp..."
                placeholderTextColor={COLORS.textMuted}
                ref={nextStepRef}
                returnKeyType="done"
                style={[styles.inputDense, focusedField === "nextStep" && styles.inputFocused]}
                value={draft.nextStep ?? ""}
              />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTopRow}>
              <Text style={styles.eyebrow}>Photo</Text>
              <Text style={styles.cardMeta}>Optional</Text>
            </View>
            {draft.images.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbnailRow}>
                {draft.images.map((img, idx) => (
                  <View key={`${img.localUri}-${idx}`} style={styles.thumbnailFrame}>
                    <Image source={{ uri: img.localUri }} style={styles.thumbnailImage} />
                    <Pressable onPress={() => { void playSelectionHaptic(); updateField("images", draft.images.filter((_, i) => i !== idx)); }} style={styles.thumbnailRemove}>
                      <Trash2 color={COLORS.bg} size={14} />
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => { void playSelectionHaptic(); void requestCameraAndCapture(); }} style={({ pressed }) => [styles.thumbnailAddTile, pressed && styles.pressedOpacity]}>
                  <Camera color={COLORS.text} size={24} />
                </Pressable>
              </ScrollView>
            ) : (
              <Pressable onPress={() => { void playSelectionHaptic(); void requestCameraAndCapture(); }} style={({ pressed }) => [styles.captureAreaSmall, pressed && styles.pressedBg]}>
                <Camera color={COLORS.text} size={24} />
                <Text style={styles.capturePrimaryText}>Add storefront photo</Text>
              </Pressable>
            )}
            <View style={styles.photoActions}>
              <PrimaryAction icon={<Camera size={16} color={palette.white} />} label="Camera" onPress={() => void requestCameraAndCapture()} />
              <SecondaryAction icon={<Images size={16} color={COLORS.text} />} label="Library" onPress={() => void requestLibraryAndPick()} />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.readinessRow}>
            <ReadinessPill attention={showValidation && missingName} complete={!missingName} label="Shop" />
            <ReadinessPill attention={showValidation && missingLocation} complete={!missingLocation} label="Location" />
            <ReadinessPill attention={showValidation && missingOutcome} complete={!missingOutcome} label="Outcome" />
          </View>
          <Pressable 
            disabled={isSaving} 
            onPress={() => { void playSelectionHaptic(); void handleSave(); }} 
            style={({ pressed }) => [
              styles.saveButton, 
              pressed && !isSaving && styles.saveButtonPressed,
              isSaving && styles.actionDisabled,
            ]}
          >
            {isSaving ? <ActivityIndicator color={palette.white} /> : <Text style={styles.saveButtonText}>{isReadyToSave ? "Save Visit" : "Save Visit"}</Text>}
          </Pressable>
        </View>

        {flashState && (
          <View style={[styles.toast, flashState.tone === "success" && styles.toastSuccess, flashState.tone === "warning" && styles.toastWarning, flashState.tone === "error" && styles.toastError, { bottom: insets.bottom + 112 }]}>
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

function ReadinessPill({
  attention,
  complete,
  label,
}: {
  attention: boolean;
  complete: boolean;
  label: string;
}) {
  return (
    <View
      style={[
        styles.readinessPill,
        complete && styles.readinessPillComplete,
        attention && styles.readinessPillAttention,
      ]}
    >
      <Text
        style={[
          styles.readinessPillText,
          complete && styles.readinessPillTextComplete,
          attention && styles.readinessPillTextAttention,
        ]}
      >
        {label}
      </Text>
    </View>
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
      description="Choose the module and folder for this visit."
      onClose={onClose}
      title="Save Destination"
      visible={visible}
    >
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
  actionRow: { flexDirection: "row", gap: spacing.sm },
  actionRowTight: { flexDirection: "row", gap: spacing.xs },
  content: { gap: spacing.md, paddingHorizontal: spacing.md, paddingTop: spacing.md },

  quickStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  syncChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  syncChipText: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  pendingChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: COLORS.warningSoft,
  },
  pendingChipText: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.warning,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  priorityCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: spacing.md,
    ...shadows.card,
  },
  priorityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  priorityCopy: {
    flex: 1,
    gap: 2,
  },
  priorityTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: COLORS.text,
  },
  destinationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 54,
    minWidth: 170,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.panel,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
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
  destinationValue: {
    fontSize: typography.label,
    fontWeight: "800",
    color: COLORS.text,
  },
  destinationMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
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

  fieldBlock: { gap: 6 },
  fieldHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  fieldLabel: { fontSize: typography.overline, fontWeight: "800", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: 0.9 },
  inputHero: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: spacing.md,
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  inputDense: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    fontWeight: "600",
    color: COLORS.text,
  },
  inputFocused: { borderColor: "#3B82F6" },
  inputError: { borderColor: COLORS.danger },
  inlineError: { fontSize: 12, fontWeight: "700", color: COLORS.danger },

  locationPanel: {
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    padding: spacing.md,
  },
  validationPanel: { borderColor: COLORS.danger },
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
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  cardMeta: {
    fontSize: typography.label,
    fontWeight: "700",
    color: COLORS.textMuted,
  },

  toggleRow: { flexDirection: "row", gap: 6 },
  toggleChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.card,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
  },
  toggleChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: "#FFF3EC",
  },
  toggleChipMutedActive: {
    borderColor: "#CBD5E1",
    backgroundColor: "#F1F5F9",
  },
  toggleChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  toggleChipTextActive: {
    color: COLORS.accentStrong,
  },
  toggleChipTextMutedActive: {
    color: COLORS.text,
  },

  emptyLocationRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  emptyLocationText: { flex: 1, fontSize: typography.body, color: COLORS.textMuted, fontWeight: "600" },
  locationFoundBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, padding: spacing.sm, borderRadius: radii.sm },
  locationAreaName: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  locationSecondary: { fontSize: typography.label, color: COLORS.textMuted, marginTop: 2 },

  captureAreaSmall: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 72, borderRadius: radii.sm, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", backgroundColor: COLORS.inputBg },
  capturePrimaryText: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  thumbnailRow: { gap: spacing.xs, paddingRight: spacing.xs },
  thumbnailAddTile: { width: 72, height: 72, borderRadius: radii.sm, borderWidth: 1, borderColor: COLORS.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.inputBg },
  thumbnailFrame: { width: 72, height: 72, borderRadius: radii.sm, overflow: "hidden", backgroundColor: COLORS.border },
  thumbnailImage: { width: "100%", height: "100%" },
  thumbnailRemove: { position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.card, alignItems: "center", justifyContent: "center" },

  saveBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    gap: spacing.sm,
    backgroundColor: COLORS.card,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
  },
  readinessRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  readinessPill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.inputBg,
    paddingVertical: 7,
  },
  readinessPillComplete: {
    borderColor: "#B7E2C9",
    backgroundColor: COLORS.successSoft,
  },
  readinessPillAttention: {
    borderColor: "#F2B8B5",
    backgroundColor: COLORS.dangerSoft,
  },
  readinessPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  readinessPillTextComplete: {
    color: COLORS.success,
  },
  readinessPillTextAttention: {
    color: COLORS.danger,
  },
  saveButton: { minHeight: 54, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.accent },
  saveButtonPressed: { backgroundColor: COLORS.accentStrong },
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
