import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useIsFocused } from "@react-navigation/native";
import { useConvex } from "convex/react";
import {
  ReactNode,
  RefObject,
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
  findNodeHandle,
  Keyboard,
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
  Trash2,
} from "lucide-react-native";
import { api } from "../../convex/_generated/api";
import { AppBottomSheet } from "../components/AppBottomSheet";
import { ConfirmationSheet } from "../components/ConfirmationSheet";
import { CaptureMapPicker } from "../components/CaptureMapPicker";
import { getVisitOutcomeLabel, visitOutcomeOptions } from "../constants/visit-outcomes";
import { getMissionDefinition, MissionDefinition } from "../constants/missions";
import { palette, radii, shadows, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { formatCaptureTime, formatCoordinates, normalizeText, sanitizePhoneInput } from "../lib/format";
import { playMissionAccomplishedHaptic, playPinSuccessHaptic, playSelectionHaptic } from "../lib/haptics";
import { mapPickerAssetsToDraftImages } from "../lib/images";
import { getLocationAreaLabel, getLocationLabel, resolveLocationDetails } from "../lib/location";
import { DraftImage, DuplicateCandidate, ShopDraft } from "../types/shops";

type FlashState = { tone: "success" | "warning" | "error"; message: string };
type Coordinates = { lat: number; lng: number };

const DEFAULT_MAP_COORDINATES: Coordinates = { lat: 24.4539, lng: 54.3773 };
const KEYBOARD_SCROLL_DELAY_MS = Platform.OS === "android" ? 180 : 80;
const KEYBOARD_SCROLL_EXTRA_OFFSET = Platform.OS === "android" ? 220 : 128;

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
  const convex = useConvex();
  const {
    activeCategoryId,
    activeCategoryLabel,
    addMissionCategory,
    activeMissionId,
    activeMissionLabel,
    deleteMissionCategory,
    getCategoryById,
    getCategoryIdFromLabel,
    getMissionCategories,
    getMissionProfiles,
    startCategoryMission,
  } = useMissionControl();
  const { pendingCaptures, pendingCount, saveCapture } = useCaptureQueue();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<ShopDraft>(() => createEmptyDraft(activeMissionLabel, activeCategoryLabel));
  const missionProfiles = getMissionProfiles();
  const [flashState, setFlashState] = useState<FlashState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const [showAdvancedDetails, setShowAdvancedDetails] = useState(false);
  const [phoneState, setPhoneState] = useState<"got" | "none">("got");
  const [isResolvingLocation, setIsResolvingLocation] = useState(false);
  const [isPreparingMap, setIsPreparingMap] = useState(false);
  const [isFolderPickerOpen, setIsFolderPickerOpen] = useState(false);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isDuplicateSheetOpen, setIsDuplicateSheetOpen] = useState(false);
  const [isDeleteFolderSheetOpen, setIsDeleteFolderSheetOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<{ missionId: string; category: { id: string; label: string } } | null>(null);
  const [mapCoordinates, setMapCoordinates] = useState<Coordinates | null>(null);
  const [pickerMissionId, setPickerMissionId] = useState(activeMissionId);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [remoteDuplicates, setRemoteDuplicates] = useState<
    Awaited<ReturnType<typeof convex.query<typeof api.shops.findPotentialDuplicates>>> | undefined
  >(undefined);
  const [remoteDuplicateCheckEnabled, setRemoteDuplicateCheckEnabled] = useState(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const contactRef = useRef<TextInput>(null);
  const neighborhoodRef = useRef<TextInput>(null);
  const roleRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);
  const nextStepRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const duplicateNeighborhood = draft.neighborhood || getLocationAreaLabel(draft.location)?.split(",")[0]?.trim() || "";
  const deferredDuplicateName = useDeferredValue(draft.name);
  const deferredDuplicatePhone = useDeferredValue(draft.phone);
  const deferredDuplicateNeighborhood = useDeferredValue(duplicateNeighborhood);
  const shouldCheckRemoteDuplicates =
    isFocused &&
    (sanitizePhoneInput(deferredDuplicatePhone).length >= 5 ||
      (normalizeText(deferredDuplicateName).length >= 3 &&
        normalizeText(deferredDuplicateNeighborhood).length >= 2));
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
  const shouldHideTransientOverlays = false;
  const completedRequiredCount = Number(!missingName) + Number(!missingLocation) + Number(!missingOutcome);
  const remainingRequiredCount = 3 - completedRequiredCount;
  const nextRequiredAction = missingName
    ? "Add shop name"
    : missingLocation
      ? "Pin shop location"
      : missingOutcome
        ? "Select visit outcome"
        : "All required fields completed";
  const captureProgressPercent = Math.round((completedRequiredCount / 3) * 100);
  const displayAdvancedDetails = showAdvancedDetails || draft.outcome === "follow_up_later";

  useEffect(() => {
    if (!flashState) return;
    const timeout = setTimeout(() => setFlashState(null), 1800);
    return () => clearTimeout(timeout);
  }, [flashState]);

  useEffect(() => {
    const showListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!shouldCheckRemoteDuplicates || !remoteDuplicateCheckEnabled) {
      setRemoteDuplicates(undefined);
      return () => {
        cancelled = true;
      };
    }

    setRemoteDuplicates(undefined);

    void convex
      .query(api.shops.findPotentialDuplicates, {
        name: deferredDuplicateName,
        neighborhood: deferredDuplicateNeighborhood,
        phone: deferredDuplicatePhone,
      })
      .then((results) => {
        if (!cancelled) {
          setRemoteDuplicates(results);
        }
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setRemoteDuplicates([]);
        setRemoteDuplicateCheckEnabled(false);
        setFlashState({
          message: "Live duplicate lookup is unavailable. Local queued duplicate checks are still active.",
          tone: "warning",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    convex,
    deferredDuplicateName,
    deferredDuplicateNeighborhood,
    deferredDuplicatePhone,
    remoteDuplicateCheckEnabled,
    shouldCheckRemoteDuplicates,
  ]);

  useEffect(() => {
    setDraft((current) => (isDraftPristine(current) ? createEmptyDraft(activeMissionLabel, activeCategoryLabel) : current));
    setPhoneState("got");
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

  function scrollInputIntoView(inputRef: RefObject<TextInput | null>) {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    setTimeout(() => {
      const nodeHandle = findNodeHandle(input);
      const scrollResponder = (scrollRef.current as unknown as {
        getScrollResponder?: () => {
          scrollResponderScrollNativeHandleToKeyboard?: (
            nodeHandle: number,
            extraHeight: number,
            preventNegativeScrollOffset?: boolean,
          ) => void;
        };
      } | null)?.getScrollResponder?.();

      if (!nodeHandle || !scrollResponder?.scrollResponderScrollNativeHandleToKeyboard) {
        return;
      }

      scrollResponder.scrollResponderScrollNativeHandleToKeyboard(
        nodeHandle,
        KEYBOARD_SCROLL_EXTRA_OFFSET,
        true,
      );
    }, KEYBOARD_SCROLL_DELAY_MS);
  }

  function focusTextField(field: string, inputRef: RefObject<TextInput | null>) {
    setFocusedField(field);
    scrollInputIntoView(inputRef);
  }

  function openFolderPicker() {
    const missionId = missionProfiles.find((mission) => mission.label === draft.mission)?.id ?? activeMissionId;
    setPickerMissionId(missionId);
    setIsFolderPickerOpen(true);
  }

  function handleNumberToggle(nextState: "got" | "none") {
    if (nextState === "got") {
      setPhoneState("got");
      phoneRef.current?.focus();
      return;
    }

    setPhoneState("none");
    updateField("phone", "");
    phoneRef.current?.blur();
  }

  function applyFolderSelection(missionId: string, categoryId: string) {
    const mission = getMissionDefinition(missionId);
    const category = getCategoryById(missionId, categoryId);
    setDraft((current) => ({ ...current, mission: mission.label, category: category?.label ?? "Unsorted" }));
    startCategoryMission({ missionId, categoryId });
    setIsFolderPickerOpen(false);
  }

  function deleteFolderFromPicker(missionId: string, category: { id: string; label: string }) {
    const normalizedLabel = category.label.trim().toLowerCase();

    if (normalizedLabel === "unsorted" || deletingFolderId) {
      return;
    }

    setFolderToDelete({ missionId, category });
    setIsDeleteFolderSheetOpen(true);
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
      updateField("location", {
        ...coordinates,
        addressLabel: details.addressLabel,
        formattedAddress: details.formattedAddress,
      });
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
      setIsDuplicateSheetOpen(true);
      return;
    }

    await persistDraft();
  }

  const selectedCategoryId = getCategoryIdFromLabel(pickerMissionId, draft.category) ?? (pickerMissionId === activeMissionId ? activeCategoryId : null);
  const flashToneMeta = flashState
    ? flashState.tone === "success"
      ? { title: "Saved", toneStyle: styles.toastToneSuccess, indicatorStyle: styles.toastIndicatorSuccess }
      : flashState.tone === "warning"
        ? { title: "Heads up", toneStyle: styles.toastToneWarning, indicatorStyle: styles.toastIndicatorWarning }
        : { title: "Action needed", toneStyle: styles.toastToneError, indicatorStyle: styles.toastIndicatorError }
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 168 }]}
          keyboardShouldPersistTaps="handled"
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.completionCard}>
            <View style={styles.completionHeader}>
              <Text style={styles.completionTitle}>Complete the basics</Text>
              <Text accessibilityLabel={`${pendingCount} queued capture${pendingCount === 1 ? "" : "s"}`} style={styles.completionMeta}>
                {pendingCount}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${captureProgressPercent}%` }]} />
            </View>
            <View style={styles.readinessRow}>
              <ReadinessPill attention={showValidation && missingName} complete={!missingName} label="Shop name" />
              <ReadinessPill attention={showValidation && missingLocation} complete={!missingLocation} label="Location" />
              <ReadinessPill attention={showValidation && missingOutcome} complete={!missingOutcome} label="Outcome" />
            </View>
            <Text style={styles.completionHint}>
              {remainingRequiredCount > 0
                ? `${remainingRequiredCount} required ${remainingRequiredCount === 1 ? "item" : "items"} left: ${nextRequiredAction}`
                : "Ready to save and continue to your next visit."}
            </Text>
          </View>

          <View style={styles.priorityCard}>
            <View style={styles.priorityHeader}>
              <View style={styles.priorityCopy}>
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
              <Text style={styles.fieldLabel}>Location</Text>
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
                  onFocus={() => focusTextField("neighborhood", neighborhoodRef)}
                  placeholder="Area / landmark"
                  placeholderTextColor={COLORS.textMuted}
                  ref={neighborhoodRef}
                  style={[styles.inputDense, focusedField === "neighborhood" && styles.inputFocused]}
                  value={draft.neighborhood}
                />
              ) : null}
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Contact name</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("contactPerson", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => focusTextField("contactPerson", contactRef)}
                onSubmitEditing={() => roleRef.current?.focus()}
                placeholder="Who to speak with"
                placeholderTextColor={COLORS.textMuted}
                ref={contactRef}
                returnKeyType="next"
                style={[styles.inputDense, focusedField === "contactPerson" && styles.inputFocused]}
                value={draft.contactPerson}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Their role</Text>
              <TextInput
                autoCapitalize="words"
                onChangeText={(value) => updateField("role", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => focusTextField("role", roleRef)}
                onSubmitEditing={() => phoneRef.current?.focus()}
                placeholder="Owner, manager, cashier…"
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
                      phoneState === "got" && styles.toggleChipActive,
                      pressed && phoneState !== "got" && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={[styles.toggleChipText, phoneState === "got" && styles.toggleChipTextActive]}>Have number</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      void playSelectionHaptic();
                      handleNumberToggle("none");
                    }}
                    style={({ pressed }) => [
                      styles.toggleChip,
                      phoneState === "none" && styles.toggleChipMutedActive,
                      pressed && phoneState !== "none" && styles.pressedOpacity,
                    ]}
                  >
                    <Text style={[styles.toggleChipText, phoneState === "none" && styles.toggleChipTextMutedActive]}>Skip</Text>
                  </Pressable>
                </View>
              </View>
              <TextInput
                keyboardType={Platform.OS === "ios" ? "number-pad" : "numeric"}
                onChangeText={(value) => updateField("phone", value)}
                onBlur={() => setFocusedField(null)}
                onFocus={() => {
                  setPhoneState("got");
                  focusTextField("phone", phoneRef);
                }}
                onSubmitEditing={() => nextStepRef.current?.focus()}
                editable={phoneState !== "none"}
                placeholder={phoneState === "none" ? "No phone number selected" : "Phone number"}
                placeholderTextColor={COLORS.textMuted}
                ref={phoneRef}
                returnKeyType="next"
                textContentType={phoneState === "none" ? undefined : "telephoneNumber"}
                style={[
                  styles.inputDense,
                  phoneState === "none" && styles.inputDisabled,
                  focusedField === "phone" && styles.inputFocused,
                ]}
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
            <Pressable
              onPress={() => {
                void playSelectionHaptic();
                setShowAdvancedDetails((current) => !current);
              }}
              style={({ pressed }) => [styles.moreDetailsToggle, pressed && styles.pressedOpacity]}
            >
              <View>
                <Text style={styles.moreDetailsTitle}>{displayAdvancedDetails ? "Hide additional info" : "+ Show more options"}</Text>
                <Text style={styles.moreDetailsMeta}>Photo and notes optional</Text>
              </View>
              <ChevronDown color={COLORS.textMuted} size={16} style={displayAdvancedDetails ? styles.chevronOpen : undefined} />
            </Pressable>

            {displayAdvancedDetails ? (
              <View style={styles.extraDetailsCard}>
                <View style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>Next step <Text style={styles.fieldOptionalLabel}>(optional)</Text></Text>
                  <TextInput
                    autoCapitalize="sentences"
                    onChangeText={(value) => updateField("nextStep", value)}
                    onBlur={() => setFocusedField(null)}
                    onFocus={() => focusTextField("nextStep", nextStepRef)}
                    placeholder="What happens next?"
                    placeholderTextColor={COLORS.textMuted}
                    ref={nextStepRef}
                    returnKeyType="done"
                    style={[styles.inputDense, focusedField === "nextStep" && styles.inputFocused]}
                    value={draft.nextStep ?? ""}
                  />
                </View>

                <View style={styles.card}>
                  <View style={styles.cardTopRow}>
                    <Text style={styles.fieldLabel}>Photo <Text style={styles.fieldOptionalLabel}>(optional)</Text></Text>
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
              </View>
            ) : null}
          </View>
        </ScrollView>

        {keyboardHeight === 0 ? (
          <View
            style={[
              styles.saveBar,
              shouldHideTransientOverlays && styles.saveBarCompact,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
            {!shouldHideTransientOverlays ? (
              <Text style={styles.saveBarHint}>
                {isReadyToSave ? "Ready to save this lead." : `Complete ${remainingRequiredCount} more ${remainingRequiredCount === 1 ? "field" : "fields"} to save.`}
              </Text>
            ) : null}
            <Pressable
              disabled={isSaving}
              onPress={() => { void playSelectionHaptic(); void handleSave(); }}
              style={({ pressed }) => [
                styles.saveButton,
                pressed && !isSaving && styles.saveButtonPressed,
                isSaving && styles.actionDisabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={palette.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isReadyToSave ? "Save lead" : `Complete ${remainingRequiredCount} more ${remainingRequiredCount === 1 ? "field" : "fields"}`}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {flashState && !shouldHideTransientOverlays ? (
          <View style={[styles.toastShell, { bottom: insets.bottom + 112 }]}>
            <View style={[styles.toastCard, flashToneMeta?.toneStyle]}>
              <View style={[styles.toastIndicator, flashToneMeta?.indicatorStyle]} />
              <View style={styles.toastCopy}>
                <Text style={styles.toastTitle}>{flashToneMeta?.title}</Text>
                <Text style={styles.toastText}>{flashState.message}</Text>
              </View>
            </View>
          </View>
        ) : null}

        <FolderPickerSheet
          activeMissionId={pickerMissionId}
          deletingCategoryId={deletingFolderId}
          getCategoriesForMission={getMissionCategories}
          missionProfiles={missionProfiles}
          onClose={() => setIsFolderPickerOpen(false)}
          onCreateCategory={({ label, missionId }) => addMissionCategory({ label, missionId })}
          onDeleteCategory={deleteFolderFromPicker}
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
        <ConfirmationSheet
          visible={isDuplicateSheetOpen}
          onClose={() => setIsDuplicateSheetOpen(false)}
          title="Possible duplicate"
          description={`Review this before creating another shop record:\n\n${duplicateCandidates.map((c) => `${c.name} • ${c.neighborhood || "Unknown"} • ${c.source === "live" ? "Live" : "Queued"}`).join("\n")}\n\nSave anyway?`}
          confirmLabel="Save Anyway"
          onConfirm={() => { void persistDraft(); }}
          isDestructive={true}
        />

        {folderToDelete && (
          <ConfirmationSheet
            visible={isDeleteFolderSheetOpen}
            onClose={() => setIsDeleteFolderSheetOpen(false)}
            title="Delete folder?"
            description={`${folderToDelete.category.label} will be removed. Leads already saved in this folder will move to Unsorted.`}
            confirmLabel="Delete"
            onConfirm={() => {
              const mission = getMissionDefinition(folderToDelete.missionId);
              setDeletingFolderId(folderToDelete.category.id);
              void deleteMissionCategory({
                categoryId: folderToDelete.category.id,
                label: folderToDelete.category.label,
                missionId: folderToDelete.missionId,
              })
                .then(() => {
                  const selectedMissionId = missionProfiles.find((option) => option.label === draft.mission)?.id ?? activeMissionId;
                  const selectedCategoryId =
                    getCategoryIdFromLabel(selectedMissionId, draft.category) ??
                    (selectedMissionId === activeMissionId ? activeCategoryId : null);

                  if (selectedMissionId === mission.id && selectedCategoryId === folderToDelete.category.id) {
                    setDraft((current) => ({ ...current, mission: mission.label, category: "Unsorted" }));
                    startCategoryMission({ missionId: mission.id, categoryId: "unsorted" });
                  }
                })
                .catch((error) => {
                  Alert.alert(
                    "Folder was not deleted",
                    error instanceof Error ? error.message : "Try again after the connection is ready.",
                  );
                })
                .finally(() => {
                  setDeletingFolderId(null);
                });
            }}
            isDestructive={true}
          />
        )}
      </View>
    </View>
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
  deletingCategoryId,
  getCategoriesForMission,
  missionProfiles,
  onClose,
  onCreateCategory,
  onDeleteCategory,
  onMissionChange,
  onSelect,
  selectedCategoryId,
  visible,
}: {
  activeMissionId: string;
  deletingCategoryId: string | null;
  getCategoriesForMission: (missionId: string) => { id: string; label: string }[];
  missionProfiles: MissionDefinition[];
  onClose: () => void;
  onCreateCategory: (options: { label: string; missionId?: string }) => { id: string; label: string } | null;
  onDeleteCategory: (missionId: string, category: { id: string; label: string }) => void;
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
          {missionProfiles.map((option) => (
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
              accessibilityLabel={`${category.label} folder`}
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
                <Text
                  ellipsizeMode="tail"
                  numberOfLines={1}
                  style={[styles.sheetItemText, category.id === selectedCategoryId && styles.sheetItemTextActive]}
                >
                  {category.label}
                </Text>
                <Text style={styles.sheetItemMeta}>
                  {category.id === selectedCategoryId ? "Current destination" : "Tap to save into this folder"}
                </Text>
              </View>
              <View style={styles.sheetItemActions}>
                {category.id === selectedCategoryId ? <Text style={styles.sheetItemBadge}>Selected</Text> : null}
                {category.label.toLowerCase() !== "unsorted" ? (
                  <Pressable
                    accessibilityLabel={`Delete ${category.label} folder`}
                    accessibilityRole="button"
                    disabled={deletingCategoryId !== null}
                    hitSlop={10}
                    onPress={(event) => {
                      event.stopPropagation();
                      void playSelectionHaptic();
                      onDeleteCategory(activeMissionId, category);
                    }}
                    style={({ pressed }) => [
                      styles.sheetDeleteButton,
                      deletingCategoryId === category.id && styles.actionDisabled,
                      pressed && deletingCategoryId === null && styles.pressedOpacity,
                    ]}
                  >
                    <Trash2 color={COLORS.danger} size={17} />
                  </Pressable>
                ) : null}
              </View>
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

  completionCard: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#D9E0E8",
    backgroundColor: COLORS.card,
    padding: spacing.lg,
  },
  completionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  completionTitle: {
    fontSize: typography.label,
    fontWeight: "800",
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  completionMeta: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  progressTrack: {
    width: "100%",
    height: 10,
    borderRadius: radii.pill,
    backgroundColor: "#E9EDF2",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: radii.pill,
    backgroundColor: COLORS.accent,
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
    paddingVertical: 8,
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
  completionHint: {
    fontSize: typography.label,
    color: COLORS.textMuted,
    lineHeight: 20,
    fontWeight: "600",
  },

  priorityCard: {
    gap: spacing.lg,
    borderRadius: radii.lg,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: "#D9E0E8",
    padding: spacing.lg,
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
  fieldLabel: { fontSize: 12, fontWeight: "800", color: COLORS.text, textTransform: "uppercase", letterSpacing: 0.8 },
  fieldOptionalLabel: { fontSize: 12, fontWeight: "400", color: COLORS.textMuted, textTransform: "none", letterSpacing: 0 },
  inputHero: {
    minHeight: 58,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#C9D2DD",
    backgroundColor: COLORS.card,
    paddingHorizontal: spacing.md,
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  inputDense: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#C9D2DD",
    backgroundColor: COLORS.card,
    paddingHorizontal: spacing.md,
    fontSize: typography.body,
    fontWeight: "600",
    color: COLORS.text,
  },
  inputFocused: { borderColor: COLORS.accent, shadowColor: COLORS.accent, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  inputError: { borderColor: COLORS.danger },
  inputDisabled: { backgroundColor: "#F2F4F7", color: COLORS.textMuted },
  inlineError: { fontSize: 12, fontWeight: "700", color: COLORS.danger },

  locationPanel: {
    gap: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#D9E0E8",
    backgroundColor: COLORS.card,
    padding: spacing.md,
  },
  validationPanel: { borderColor: COLORS.danger },
  outcomeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
  },
  outcomeChip: {
    minHeight: 44,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D0D7E2",
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
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "#D0D7E2",
    backgroundColor: COLORS.card,
    paddingHorizontal: spacing.md,
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
    fontWeight: "800",
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
  locationFoundBlock: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: COLORS.card, borderWidth: 1, borderColor: "#D0D7E2", padding: spacing.sm, borderRadius: radii.md },
  locationAreaName: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  locationSecondary: { fontSize: typography.label, color: COLORS.textMuted, marginTop: 2 },

  captureAreaSmall: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.sm, height: 72, borderRadius: radii.md, borderWidth: 1, borderColor: "#D0D7E2", borderStyle: "dashed", backgroundColor: "#FBFCFE" },
  capturePrimaryText: { fontSize: typography.body, fontWeight: "800", color: COLORS.text },
  photoActions: { flexDirection: "row", gap: spacing.sm },
  thumbnailRow: { gap: spacing.xs, paddingRight: spacing.xs },
  thumbnailAddTile: { width: 72, height: 72, borderRadius: radii.md, borderWidth: 1, borderColor: "#D0D7E2", borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.card },
  thumbnailFrame: { width: 72, height: 72, borderRadius: radii.md, overflow: "hidden", backgroundColor: COLORS.border },
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
    borderTopColor: "#D9E0E8",
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 20,
  },
  saveBarCompact: {
    paddingTop: spacing.sm,
  },
  saveBarHint: {
    fontSize: typography.label,
    color: COLORS.textMuted,
    fontWeight: "600",
  },
  saveButton: { minHeight: 54, borderRadius: radii.md, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6, backgroundColor: COLORS.accent },
  saveButtonPressed: { backgroundColor: COLORS.accentStrong },
  saveButtonText: { fontSize: typography.body, fontWeight: "800", color: palette.white },

  moreDetailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: "#D0D7E2",
    backgroundColor: COLORS.card,
  },
  moreDetailsTitle: {
    fontSize: typography.label,
    fontWeight: "800",
    color: COLORS.text,
  },
  moreDetailsMeta: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  extraDetailsCard: {
    gap: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "#D9E0E8",
    backgroundColor: "#FBFCFE",
    padding: spacing.md,
  },

  primaryAction: { flex: 1, height: 48, borderRadius: radii.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.accent },
  primaryActionText: { fontSize: typography.label, fontWeight: "800", color: palette.white },
  secondaryAction: { flex: 1, height: 48, borderRadius: radii.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  secondaryActionText: { fontSize: typography.label, fontWeight: "700", color: COLORS.text },

  actionDisabled: { opacity: 0.5 },
  pressedOpacity: { opacity: 0.7 },
  pressedBg: { backgroundColor: COLORS.border },

  toastShell: {
    position: "absolute",
    left: spacing.lg,
    right: spacing.lg,
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: COLORS.card,
    shadowColor: "#18161D",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 10,
  },
  toastToneSuccess: {
    borderColor: "#9BD8B9",
    backgroundColor: COLORS.successSoft,
  },
  toastToneWarning: {
    borderColor: "#F3CC88",
    backgroundColor: COLORS.warningSoft,
  },
  toastToneError: {
    borderColor: "#E8A9A1",
    backgroundColor: COLORS.dangerSoft,
  },
  toastIndicator: {
    marginTop: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.textMuted,
  },
  toastIndicatorSuccess: {
    backgroundColor: COLORS.success,
  },
  toastIndicatorWarning: {
    backgroundColor: COLORS.warning,
  },
  toastIndicatorError: {
    backgroundColor: COLORS.danger,
  },
  toastCopy: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: COLORS.text,
    textTransform: "uppercase",
    letterSpacing: 0.9,
  },
  toastText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: COLORS.text,
    lineHeight: 20,
  },

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
    minWidth: 0,
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
  sheetItemActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  sheetDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.dangerSoft,
  },
});
