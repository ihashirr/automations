import * as Location from "expo-location";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Coffee,
  FolderOpen,
  LocateFixed,
  RefreshCcw,
  Search,
  ShoppingBasket,
  Sparkles,
  Star,
  Store,
  Target,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import {
  ComponentType,
  ReactNode,
  memo,
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  InteractionManager,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ViewStyle,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { AppBottomSheet } from "../components/AppBottomSheet";
import { AppTip } from "../components/AppTip";
import { ScreenErrorBoundary } from "../components/ScreenErrorBoundary";
import { ShopCard } from "../components/ShopCard";
import { getVisitOutcomeLabel } from "../constants/visit-outcomes";
import {
  getMissionDefinition,
  MissionDefinition,
} from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { buildSearchText, formatDistance, normalizeSearchText } from "../lib/format";
import { playMissionAccomplishedHaptic, playSelectionHaptic } from "../lib/haptics";
import { calculateDistanceMeters, getLocationLabel, resolveLocationDetails } from "../lib/location";
import { HomeTabParamList, MissionsStackParamList, RootStackParamList } from "../navigation/types";
import { CapturedLocation, PendingCapture, ShopSummary } from "../types/shops";

type SortMode = "latest" | "nearest";
type FocusFilter = "all" | "hot" | "follow_up" | "unknown";
type DashboardNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<MissionsStackParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;
type LeadTarget = { kind: "pending"; capture: PendingCapture } | { kind: "remote"; shop: ShopSummary };
type DashboardRow = { distanceMeters: number | null; row: LeadTarget };
type MissionCategory = { id: string; label: string };
type MissionIcon = ComponentType<{ color: string; size: number }>;
type LeadEditDraft = {
  contactPerson: string;
  name: string;
  nextStep: string;
  phone: string;
  role: string;
};

const categoryIcons = {
  cafes: Coffee,
  groceries: ShoppingBasket,
  "perfume-shops": Sparkles,
  unsorted: FolderOpen,
} as const;

function useEntranceMotion(delay: number, distance = 16, duration = 260) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(distance)).current;

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(distance);

    const animation = Animated.parallel([
      Animated.timing(opacity, {
        duration,
        easing: Easing.out(Easing.cubic),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: duration + 30,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]);

    const timeoutId = setTimeout(() => {
      animation.start();
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      animation.stop();
    };
  }, [delay, distance, duration, opacity, translateY]);

  return { opacity, translateY };
}

function usePressScale() {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = useCallback(
    (toValue: number) => {
      Animated.spring(scale, {
        bounciness: toValue < 1 ? 0 : 6,
        speed: 28,
        toValue,
        useNativeDriver: true,
      }).start();
    },
    [scale],
  );

  const handlePressIn = useCallback(() => {
    animateTo(0.986);
  }, [animateTo]);

  const handlePressOut = useCallback(() => {
    animateTo(1);
  }, [animateTo]);

  return { handlePressIn, handlePressOut, scale };
}

const RevealBlock = memo(function RevealBlock({
  children,
  delay,
  style,
}: {
  children: ReactNode;
  delay: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { opacity, translateY } = useEntranceMotion(delay, 18, 280);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
});

const RecentActivityCard = memo(function RecentActivityCard({
  index,
  onPress,
  row,
}: {
  index: number;
  onPress: (row: LeadTarget) => void;
  row: LeadTarget;
}) {
  const { opacity, translateY } = useEntranceMotion(70 + index * 45, 14, 220);
  const { handlePressIn, handlePressOut, scale } = usePressScale();
  const handleCardPress = useCallback(() => {
    onPress(row);
  }, [onPress, row]);

  return (
    <Animated.View
      style={[
        styles.recentCardWrap,
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Pressable
        onPress={handleCardPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [styles.recentCard, pressed && styles.recentCardPressed]}
      >
        <View style={styles.recentIconBox}>
          <Sparkles color={palette.accent} size={16} />
        </View>
        <Text numberOfLines={1} style={styles.recentName}>{getRowName(row)}</Text>
        <Text style={styles.recentMeta}>{getRowNeighborhood(row) || "Unknown"}</Text>
      </Pressable>
    </Animated.View>
  );
});

const MissionFolderCard = memo(function MissionFolderCard({
  canDelete,
  category,
  count,
  icon: Icon,
  index,
  isPinned,
  onCreateLead,
  onDelete,
  onPress,
  onTogglePin,
  width,
}: {
  canDelete: boolean;
  category: MissionCategory;
  count: number;
  icon: MissionIcon;
  index: number;
  isPinned: boolean;
  onCreateLead: (categoryId: string) => void;
  onDelete: (category: MissionCategory, count: number) => void;
  onPress: (categoryId: string) => void;
  onTogglePin: (categoryId: string) => void;
  width: "48%" | "100%";
}) {
  const { opacity, translateY } = useEntranceMotion(110 + index * 50, 18, 240);
  const { handlePressIn, handlePressOut, scale } = usePressScale();
  const handleCardPress = useCallback(() => {
    onPress(category.id);
  }, [category.id, onPress]);

  return (
    <Animated.View
      style={[
        styles.folderCardWrap,
        { width },
        {
          opacity,
          transform: [{ translateY }, { scale }],
        },
      ]}
    >
      <Pressable
        accessibilityLabel={`${category.label}, ${count} lead${count === 1 ? "" : "s"}`}
        onPress={handleCardPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [styles.folderCard, pressed && styles.folderCardPressed]}
      >
        <Pressable
          accessibilityLabel={`${isPinned ? "Unpin" : "Pin"} ${category.label}`}
          accessibilityRole="button"
          hitSlop={10}
          onPress={(event) => {
            event.stopPropagation();
            onTogglePin(category.id);
          }}
          style={({ pressed }) => [
            styles.folderPinButton,
            isPinned && styles.folderPinButtonActive,
            pressed && styles.folderIconButtonPressed,
          ]}
        >
          <Star
            color={isPinned ? palette.accentStrong : palette.mutedInk}
            fill={isPinned ? palette.accentStrong : "transparent"}
            size={16}
          />
        </Pressable>
        <View style={styles.folderIcon}>
          <Icon color={palette.accent} size={20} />
        </View>
        <View style={styles.folderInfo}>
          <Text
            accessibilityLabel={category.label}
            ellipsizeMode="tail"
            numberOfLines={1}
            style={styles.folderName}
          >
            {category.label}
          </Text>
          <Text style={[styles.folderCount, count === 0 && styles.folderCountEmpty]}>
            {count === 0 ? "No leads yet" : `${count} lead${count === 1 ? "" : "s"}`}
          </Text>
        </View>
        {count === 0 ? (
          <Pressable
            accessibilityLabel={`Create first lead in ${category.label}`}
            accessibilityRole="button"
            onPress={(event) => {
              event.stopPropagation();
              onCreateLead(category.id);
            }}
            style={({ pressed }) => [styles.folderCreateButton, pressed && styles.folderCreateButtonPressed]}
          >
            <Text style={styles.folderCreateText}>Create first lead</Text>
          </Pressable>
        ) : null}
        {canDelete ? (
          <Pressable
            accessibilityLabel={`Delete ${category.label} folder`}
            accessibilityRole="button"
            hitSlop={10}
            onPress={(event) => {
              event.stopPropagation();
              onDelete(category, count);
            }}
            style={({ pressed }) => [styles.folderDeleteButton, pressed && styles.folderIconButtonPressed]}
          >
            <Trash2 color={palette.danger} size={17} />
          </Pressable>
        ) : null}
      </Pressable>
    </Animated.View>
  );
});

export function ShopsListScreen() {
  return (
    <ScreenErrorBoundary
      body="This mission view depends on Convex data. If the configured deployment is missing the latest functions, keep the app open and retry after the backend is updated."
      title="Mission Feed Unavailable"
    >
      <ShopsListScreenContent />
    </ScreenErrorBoundary>
  );
}

function ShopsListScreenContent() {
  const isFocused = useIsFocused();
  const navigation = useNavigation<DashboardNavigation>();
  const moveShop = useMutation(api.shops.moveShop);
  const updateShopLead = useMutation(api.shops.updateShopLead);
  const deleteShopLead = useMutation(api.shops.deleteShopLead);
  const { width: screenWidth } = useWindowDimensions();
  const {
    activeCategoryId,
    activeCategoryLabel,
    activeMissionId,
    activeMissionLabel,
    deleteMissionCategory,
    getMissionCategories,
    getMissionProfiles,
    setActiveCategoryId,
  } = useMissionControl();
  const {
    flushQueue,
    isFlushing,
    pendingCaptures,
    pendingCount,
    queueReady,
    deletePendingCapture,
    reclassifyPendingCapture,
    updatePendingCapture,
  } = useCaptureQueue();
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CapturedLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationIssue, setLocationIssue] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadTarget | null>(null);
  const [editingLead, setEditingLead] = useState<LeadTarget | null>(null);
  const [editDraft, setEditDraft] = useState<LeadEditDraft>({
    contactPerson: "",
    name: "",
    nextStep: "",
    phone: "",
    role: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingCategoryId, setDeletingCategoryId] = useState<string | null>(null);
  const [pinnedCategoryIds, setPinnedCategoryIds] = useState<string[]>([]);
  const [screenReady, setScreenReady] = useState(false);
  const normalizedSearch = normalizeSearchText(useDeferredValue(searchText));
  const normalizedActiveMissionLabel = useMemo(
    () => normalizeSearchText(activeMissionLabel),
    [activeMissionLabel],
  );
  const missionCategories = useMemo(
    () => getMissionCategories(activeMissionId),
    [activeMissionId, getMissionCategories],
  );
  const missionProfiles = getMissionProfiles();
  const folderCardWidth: "48%" | "100%" = screenWidth < 380 ? "100%" : "48%";
  const orderedMissionCategories = useMemo(() => {
    return [...missionCategories].sort((left, right) => {
      const leftPinned = pinnedCategoryIds.includes(left.id);
      const rightPinned = pinnedCategoryIds.includes(right.id);

      if (leftPinned !== rightPinned) {
        return leftPinned ? -1 : 1;
      }

      return 0;
    });
  }, [missionCategories, pinnedCategoryIds]);

  useEffect(() => {
    if (!isFocused) {
      setScreenReady(false);
      return;
    }

    setScreenReady(false);
    const task = InteractionManager.runAfterInteractions(() => {
      setScreenReady(true);
    });

    return () => {
      task.cancel();
    };
  }, [isFocused]);

  const feed = useQuery(
    api.shops.listMissionFeed,
    isFocused && screenReady ? { mission: activeMissionLabel, limit: 200 } : "skip",
  );

  useEffect(() => {
    setActiveNeighborhood(null);
    setSearchText("");
    setFocusFilter("all");
  }, [activeCategoryId, activeMissionId]);

  useEffect(() => {
    if (sortMode === "nearest" && !currentLocation && !isLocating) {
      void refreshCurrentLocation();
    }
  }, [currentLocation, isLocating, sortMode]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (selectedLead) {
          setSelectedLead(null);
          return true;
        }

        if (searchText) {
          setSearchText("");
          return true;
        }

        if (activeNeighborhood) {
          setActiveNeighborhood(null);
          return true;
        }

        if (activeCategoryId) {
          setActiveCategoryId(null);
          return true;
        }

        return false;
      });

      return () => {
        subscription.remove();
      };
    }, [activeCategoryId, activeNeighborhood, searchText, selectedLead, setActiveCategoryId]),
  );

  async function refreshCurrentLocation() {
    setIsLocating(true);
    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();
      const permission =
        existingPermission.status === "granted"
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        setLocationIssue("Location permission is needed for nearest sorting.");
        setSortMode("latest");
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinates = { lat: position.coords.latitude, lng: position.coords.longitude };
      const details = await resolveLocationDetails({
        allowReverseGeocode: Platform.OS !== "web",
        coordinates,
        reverseGeocode: () =>
          Location.reverseGeocodeAsync({ latitude: coordinates.lat, longitude: coordinates.lng }),
      });
      setCurrentLocation({
        ...coordinates,
        addressLabel: details.addressLabel,
        formattedAddress: details.formattedAddress,
      });
      setLocationIssue(null);
    } catch (error) {
      setLocationIssue(error instanceof Error ? error.message : "Unable to locate you right now.");
      setSortMode("latest");
    } finally {
      setIsLocating(false);
    }
  }

  const missionRows = useMemo(() => {
    const pendingRows = pendingCaptures
      .filter((capture) => normalizeSearchText(capture.mission) === normalizedActiveMissionLabel)
      .map<LeadTarget>((capture) => ({ kind: "pending", capture }));
    const remoteRows = (feed ?? []).map<LeadTarget>((shop: ShopSummary) => ({ kind: "remote", shop }));
    return [...pendingRows, ...remoteRows];
  }, [feed, normalizedActiveMissionLabel, pendingCaptures]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const category of missionCategories) counts.set(category.label, 0);
    for (const row of missionRows) {
      const categoryLabel = getRowCategory(row);
      counts.set(categoryLabel, (counts.get(categoryLabel) ?? 0) + 1);
    }
    return counts;
  }, [missionCategories, missionRows]);

  const categoryRows = useMemo(
    () => (activeCategoryLabel ? missionRows.filter((row) => getRowCategory(row) === activeCategoryLabel) : []),
    [activeCategoryLabel, missionRows],
  );

  const neighborhoods = useMemo(() => {
    const unique = new Set<string>();
    for (const row of categoryRows) {
      const neighborhood = getRowNeighborhood(row);
      if (neighborhood) unique.add(neighborhood);
    }
    return [...unique].sort((left, right) => left.localeCompare(right));
  }, [categoryRows]);

  const filteredRows = useMemo(() => {
    return categoryRows
      .filter((row) => {
        if (activeNeighborhood && getRowNeighborhood(row) !== activeNeighborhood) return false;
        if (!normalizedSearch) return true;
        return buildSearchText([
          getRowName(row),
          getRowPhone(row),
          getRowContact(row),
          getRowCategory(row),
          getRowNeighborhood(row) ?? "",
          getLocationLabel(getRowLocation(row)) ?? "",
        ]).includes(normalizedSearch);
      })
      .map<DashboardRow>((row) => ({
        row,
        distanceMeters:
          sortMode === "nearest" && currentLocation && getRowLocation(row)
            ? calculateDistanceMeters(currentLocation, getRowLocation(row) as CapturedLocation)
            : null,
      }))
      .sort((left, right) => {
        if (sortMode === "nearest" && currentLocation) {
          if (left.distanceMeters == null) return 1;
          if (right.distanceMeters == null) return -1;
          if (left.distanceMeters !== right.distanceMeters) return left.distanceMeters - right.distanceMeters;
        }
        return getRowCreatedAt(right.row) - getRowCreatedAt(left.row);
      });
  }, [activeNeighborhood, categoryRows, currentLocation, normalizedSearch, sortMode]);

  const rows = useMemo(() => {
    if (focusFilter === "all") {
      return filteredRows;
    }

    return filteredRows.filter(({ row }) => {
      const outcome = getRowOutcome(row);

      if (focusFilter === "hot") {
        return outcome === "got_manager_number" || outcome === "met_decision_maker";
      }

      if (focusFilter === "follow_up") {
        return outcome === "follow_up_later" || outcome === "spoke_to_staff";
      }

      return outcome === "unknown" || outcome === "no_answer";
    });
  }, [filteredRows, focusFilter]);

  const focusCounts = useMemo(() => {
    let hot = 0;
    let followUp = 0;
    let unknown = 0;

    for (const { row } of filteredRows) {
      const outcome = getRowOutcome(row);
      if (outcome === "got_manager_number" || outcome === "met_decision_maker") {
        hot += 1;
      } else if (outcome === "follow_up_later" || outcome === "spoke_to_staff") {
        followUp += 1;
      } else if (outcome === "unknown" || outcome === "no_answer") {
        unknown += 1;
      }
    }

    return {
      all: filteredRows.length,
      followUp,
      hot,
      unknown,
    };
  }, [filteredRows]);

  const emptyLeadState = useMemo(() => {
    if (focusFilter === "hot") {
      return {
        title: "No hot leads right now.",
        body: "View all leads or check back after more visits.",
        canClearFocus: true,
      };
    }

    if (focusFilter === "follow_up") {
      return {
        title: "No follow-up leads right now.",
        body: "View all leads or add more follow-up outcomes.",
        canClearFocus: true,
      };
    }

    if (focusFilter === "unknown") {
      return {
        title: "No leads need review.",
        body: "View all leads or keep capturing new visits.",
        canClearFocus: true,
      };
    }

    if (searchText.trim() || activeNeighborhood) {
      return {
        title: "No matching leads.",
        body: "Clear search or area filters to see more results.",
        canClearFocus: false,
      };
    }

    return {
      title: "No leads yet.",
      body: "Create the first lead in this folder.",
      canClearFocus: false,
    };
  }, [activeNeighborhood, focusFilter, searchText]);

  const isLoading =
    !queueReady ||
    (isFocused && activeCategoryId !== null && (!screenReady || feed === undefined));

  const visibleRecentRows = useMemo(() => missionRows.slice(0, 5), [missionRows]);

  async function handleMoveLead(missionLabel: string, categoryLabel: string) {
    if (!selectedLead) return;
    if (selectedLead.kind === "pending") {
      await reclassifyPendingCapture({
        localId: selectedLead.capture.localId,
        mission: missionLabel,
        category: categoryLabel,
      });
    } else {
      await moveShop({ shopId: selectedLead.shop._id, mission: missionLabel, category: categoryLabel });
    }
    setSelectedLead(null);
    void playMissionAccomplishedHaptic();
  }

  function openEditLead(row: LeadTarget) {
    setEditDraft({
      contactPerson: getRowContact(row),
      name: getRowName(row),
      nextStep: getRowNextStep(row),
      phone: getRowPhone(row),
      role: getRowRole(row),
    });
    setEditingLead(row);
  }

  async function saveLeadEdit() {
    if (!editingLead || isSavingEdit) {
      return;
    }

    const trimmedName = editDraft.name.trim();

    if (!trimmedName) {
      Alert.alert("Name is required", "Add a lead or shop name before saving.");
      return;
    }

    setIsSavingEdit(true);

    try {
      if (editingLead.kind === "pending") {
        await updatePendingCapture({
          contactPerson: editDraft.contactPerson,
          localId: editingLead.capture.localId,
          name: trimmedName,
          nextStep: editDraft.nextStep,
          phone: editDraft.phone,
          role: editDraft.role,
        });
      } else {
        await updateShopLead({
          contactPerson: editDraft.contactPerson,
          name: trimmedName,
          nextStep: editDraft.nextStep,
          phone: editDraft.phone,
          role: editDraft.role,
          shopId: editingLead.shop._id,
        });
      }

      setEditingLead(null);
    } catch (error) {
      Alert.alert("Lead was not updated", error instanceof Error ? error.message : "Try again.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  function confirmDeleteLead(row: LeadTarget) {
    Alert.alert(
      "Delete lead?",
      `${getRowName(row)} will be removed from this folder.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteLead(row);
          },
        },
      ],
    );
  }

  async function deleteLead(row: LeadTarget) {
    try {
      if (row.kind === "pending") {
        await deletePendingCapture(row.capture.localId);
      } else {
        await deleteShopLead({ shopId: row.shop._id });
      }

      setSelectedLead((current) => (current === row ? null : current));
      setEditingLead((current) => (current === row ? null : current));
    } catch (error) {
      Alert.alert("Lead was not deleted", error instanceof Error ? error.message : "Try again.");
    }
  }

  function returnToFolderGrid() {
    void playSelectionHaptic();
    startTransition(() => {
      setActiveCategoryId(null);
    });
    navigation.navigate("MissionsList");
  }

  function openCaptureScreen() {
    void playSelectionHaptic();
    // Use the root navigator to switch tabs if necessary
    (navigation as any).getParent()?.navigate("Capture");
  }

  const openRecentActivity = useCallback(
    (row: LeadTarget) => {
      void playSelectionHaptic();
      if (row.kind === "remote") {
        navigation.navigate("ShopDetail", { shopId: row.shop._id });
      }
    },
    [navigation],
  );

  const openCategory = useCallback(
    (categoryId: string) => {
      void playSelectionHaptic();
      startTransition(() => {
        setActiveCategoryId(categoryId);
      });
      navigation.navigate("MissionDetail", {
        missionId: activeMissionId,
        categoryId,
      });
    },
    [activeMissionId, navigation, setActiveCategoryId],
  );

  const createLeadInCategory = useCallback(
    (categoryId: string) => {
      void playSelectionHaptic();
      startTransition(() => {
        setActiveCategoryId(categoryId);
      });
      (navigation as any).getParent()?.navigate("Capture");
    },
    [navigation, setActiveCategoryId],
  );

  const togglePinnedCategory = useCallback((categoryId: string) => {
    void playSelectionHaptic();
    setPinnedCategoryIds((current) => {
      if (current.includes(categoryId)) {
        return current.filter((id) => id !== categoryId);
      }

      return [categoryId, ...current].slice(0, 3);
    });
  }, []);

  const deleteCategory = useCallback(
    async (category: MissionCategory, count: number) => {
      const normalizedLabel = category.label.trim().toLowerCase();

      if (normalizedLabel === "unsorted" || deletingCategoryId) {
        return;
      }

      Alert.alert(
        "Delete folder?",
        count > 0
          ? `${category.label} has ${count} lead${count === 1 ? "" : "s"}. They will move to Unsorted.`
          : `${category.label} will be removed from this mission.`,
        [
          { style: "cancel", text: "Cancel" },
          {
            style: "destructive",
            text: "Delete",
            onPress: () => {
              setDeletingCategoryId(category.id);
              void deleteMissionCategory({
                categoryId: category.id,
                label: category.label,
                missionId: activeMissionId,
              })
                .catch((error) => {
                  Alert.alert(
                    "Folder was not deleted",
                    error instanceof Error ? error.message : "Try again after the connection is ready.",
                  );
                })
                .finally(() => {
                  setDeletingCategoryId(null);
                });
            },
          },
        ],
      );
    },
    [activeMissionId, deleteMissionCategory, deletingCategoryId],
  );

  function renderLead({ item }: { item: DashboardRow }) {
    const row = item.row;
    const commonProps = {
      contactPerson: getRowContact(row),
      createdAt: getRowCreatedAt(row),
      distanceLabel: sortMode === "nearest" ? formatDistance(item.distanceMeters) : null,
      location: getRowLocation(row),
      name: getRowName(row),
      neighborhood: getRowNeighborhood(row),
      onDelete: () => confirmDeleteLead(row),
      onEdit: () => openEditLead(row),
      onLongPress: () => setSelectedLead(row),
      outcome: getRowOutcome(row),
      phone: getRowPhone(row),
    };

    if (row.kind === "pending") {
      return (
        <ShopCard
          {...commonProps}
          previewImageUrl={row.capture.images[0]?.localUri ?? null}
          statusLabel="Queued"
          statusTone="queued"
        />
      );
    }

    return (
      <ShopCard
        {...commonProps}
        onPress={() => {
          void playSelectionHaptic();
          navigation.navigate("ShopDetail", { shopId: row.shop._id });
        }}
        previewImageUrl={row.shop.previewImageUrl}
        statusLabel="Active"
        statusTone="live"
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          activeCategoryLabel ? styles.contentCompact : null,
          { paddingTop: spacing.md, paddingBottom: spacing.xxl + 120 },
        ]}
        keyboardDismissMode="on-drag"
        refreshControl={<RefreshControl onRefresh={() => void flushQueue()} refreshing={isFlushing} />}
        showsVerticalScrollIndicator={false}
      >

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : !activeCategoryId ? (
          <View style={styles.dashboard}>
            <RevealBlock delay={0} style={styles.statsRibbon}>
              <View style={styles.ribbonCard}>
                <Text style={styles.ribbonValue}>{feed?.length || 0}</Text>
                <Text style={styles.ribbonLabel}>ACTIVE LEADS</Text>
              </View>
              <View style={[styles.ribbonCard, styles.ribbonCardDark]}>
                <Text style={[styles.ribbonValue, styles.ribbonValueDark]}>{pendingCount}</Text>
                <Text style={[styles.ribbonLabel, styles.ribbonLabelDark]}>PENDING</Text>
              </View>
            </RevealBlock>

            <RevealBlock delay={70} style={styles.section}>
              <Text style={styles.sectionHeaderLabel}>RECENT ACTIVITY</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.recentCarousel}
              >
                {visibleRecentRows.map((row, idx) => (
                  <RecentActivityCard
                    index={idx}
                    key={row.kind === "pending" ? row.capture.localId : row.shop._id}
                    onPress={openRecentActivity}
                    row={row}
                  />
                ))}
                {visibleRecentRows.length === 0 && (
                  <View style={styles.emptyRecent}>
                    <Text style={styles.emptyRecentText}>No recent activity</Text>
                  </View>
                )}
              </ScrollView>
            </RevealBlock>

            <RevealBlock delay={120} style={styles.section}>
              <Text style={styles.sectionHeaderLabel}>YOUR FOLDERS</Text>
              <Text style={styles.sectionHelperText}>Tap a folder to see leads.</Text>
              <View style={styles.folderGrid}>
                {orderedMissionCategories.map((category, index) => {
                  const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? Store;

                  return (
                    <MissionFolderCard
                      canDelete={category.id !== deletingCategoryId && category.label.toLowerCase() !== "unsorted"}
                      category={category}
                      count={categoryCounts.get(category.label) ?? 0}
                      icon={Icon}
                      index={index}
                      isPinned={pinnedCategoryIds.includes(category.id)}
                      key={category.id}
                      onCreateLead={createLeadInCategory}
                      onDelete={deleteCategory}
                      onPress={openCategory}
                      onTogglePin={togglePinnedCategory}
                      width={folderCardWidth}
                    />
                  );
                })}
              </View>
            </RevealBlock>

            <Pressable 
              onPress={() => {
                void playSelectionHaptic();
                navigation.navigate("MissionHub");
              }}
              style={styles.changeMissionButton}
            >
              <ArrowLeft color={palette.mutedInk} size={16} />
              <Text style={styles.changeMissionText}>Switch workspace</Text>
            </Pressable>
          </View>
        ) : (
          <RevealBlock delay={0} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{activeCategoryLabel}</Text>
              <Text style={styles.sectionMeta}>{rows.length} leads</Text>
            </View>

            <View style={styles.commandCard}>
              <View style={styles.commandHeader}>
                <Target color={palette.accentStrong} size={16} />
                <Text style={styles.commandTitle}>Quick filters</Text>
              </View>
              <Text style={styles.commandText}>
                {focusFilter === "all"
                  ? "See all leads, or use quick filters to focus on hot and follow-up items."
                  : `Showing ${rows.length} ${focusFilter === "hot" ? "hot" : focusFilter === "follow_up" ? "follow-up" : "review"} leads.`}
              </Text>
            </View>

            <View style={styles.controlStack}>
              <View style={styles.searchRow}>
                <View style={styles.searchBox}>
                  <Search color={palette.mutedInk} size={18} />
                  <TextInput
                    onChangeText={setSearchText}
                    placeholder="Search leads"
                    placeholderTextColor={palette.mutedInk}
                    style={styles.searchInput}
                    value={searchText}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    void playSelectionHaptic();
                    void flushQueue();
                  }}
                  style={styles.refreshButton}
                >
                  <RefreshCcw color={palette.ink} size={18} />
                </Pressable>
              </View>
              <View style={styles.toolbar}>
                <View style={styles.segmentedControl}>
                  <Segment active={sortMode === "latest"} label="Newest" onPress={() => setSortMode("latest")} />
                  <Segment active={sortMode === "nearest"} label="Closest" onPress={() => setSortMode("nearest")} />
                </View>
                <Pressable
                  onPress={() => {
                    void playSelectionHaptic();
                    void refreshCurrentLocation();
                  }}
                  style={styles.locateButton}
                >
                  <LocateFixed color={palette.ink} size={16} />
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <AreaChip active={activeNeighborhood === null} label="All Areas" onPress={() => setActiveNeighborhood(null)} />
                {neighborhoods.map((neighborhood) => (
                  <AreaChip
                    key={neighborhood}
                    active={activeNeighborhood === neighborhood}
                    label={neighborhood}
                    onPress={() => setActiveNeighborhood(neighborhood)}
                  />
                ))}
              </ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <FocusChip
                  active={focusFilter === "all"}
                  label={`All (${focusCounts.all})`}
                  onPress={() => setFocusFilter("all")}
                />
                <FocusChip
                  active={focusFilter === "hot"}
                  label={`Hot (${focusCounts.hot})`}
                  onPress={() => setFocusFilter("hot")}
                />
                <FocusChip
                  active={focusFilter === "follow_up"}
                  label={`Follow-up (${focusCounts.followUp})`}
                  onPress={() => setFocusFilter("follow_up")}
                />
                <FocusChip
                  active={focusFilter === "unknown"}
                  label={`Unknown (${focusCounts.unknown})`}
                  onPress={() => setFocusFilter("unknown")}
                />
              </ScrollView>
            </View>
            <View style={styles.listContent}>
              {rows.length === 0 ? (
                <View style={styles.centerState}>
                  <Text style={styles.emptyTitle}>{emptyLeadState.title}</Text>
                  <Text style={styles.centerText}>{emptyLeadState.body}</Text>
                  {emptyLeadState.canClearFocus ? (
                    <Pressable
                      accessibilityLabel="View all leads"
                      accessibilityRole="button"
                      onPress={() => {
                        void playSelectionHaptic();
                        setFocusFilter("all");
                      }}
                      style={({ pressed }) => [
                        styles.startMissionButton,
                        pressed && styles.startMissionButtonPressed,
                      ]}
                    >
                      <Text style={styles.startMissionButtonText}>View All</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      accessibilityLabel={`Start mission in ${activeCategoryLabel}`}
                      accessibilityRole="button"
                      onPress={openCaptureScreen}
                      style={({ pressed }) => [
                        styles.startMissionButton,
                        pressed && styles.startMissionButtonPressed,
                      ]}
                    >
                      <Text style={styles.startMissionButtonText}>Start Mission</Text>
                    </Pressable>
                  )}
                </View>
              ) : (
                rows.map((item, index) => {
                  const rowKey =
                    item.row.kind === "pending" ? item.row.capture.localId : item.row.shop._id;

                  return (
                    <View key={rowKey}>
                      {index > 0 ? <View style={styles.separator} /> : null}
                      {renderLead({ item })}
                    </View>
                  );
                })
              )}
            </View>
          </RevealBlock>
        )}
      </ScrollView>

      <LeadEditSheet
        draft={editDraft}
        isSaving={isSavingEdit}
        onChange={setEditDraft}
        onClose={() => setEditingLead(null)}
        onSave={saveLeadEdit}
        visible={editingLead !== null}
      />

      <MoveSheet
        activeMissionId={activeMissionId}
        deletingCategoryId={deletingCategoryId}
        getMissionCategories={getMissionCategories}
        missionProfiles={missionProfiles}
        onClose={() => setSelectedLead(null)}
        onDeleteCategory={(category) => deleteCategory(category, categoryCounts.get(category.label) ?? 0)}
        onMove={handleMoveLead}
        selectedLead={selectedLead}
      />
    </View>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void playSelectionHaptic();
        startTransition(() => {
          onPress();
        });
      }}
      style={({ pressed }) => [styles.segment, active && styles.segmentActive, pressed && !active && styles.segmentPressed]}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </Pressable>
  );
}

function AreaChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  const isPrimary = label === "All Areas";

  return (
    <Pressable
      onPress={() => {
        void playSelectionHaptic();
        startTransition(() => {
          onPress();
        });
      }}
      style={({ pressed }) => [
        styles.areaChip,
        isPrimary && !active && styles.areaChipPrimary,
        active && styles.areaChipActive,
        pressed && !active && styles.areaChipPressed,
      ]}
    >
      <Text
        style={[
          styles.areaChipText,
          isPrimary && !active && styles.areaChipTextPrimary,
          active && styles.areaChipTextActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function FocusChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityHint={`Show ${label.replace(/\s*\(\d+\)/, "").toLowerCase()} leads`}
      accessibilityRole="button"
      onPress={() => {
        void playSelectionHaptic();
        startTransition(() => {
          onPress();
        });
      }}
      style={({ pressed }) => [
        styles.focusChip,
        active && styles.focusChipActive,
        pressed && !active && styles.focusChipPressed,
      ]}
    >
      <Text style={[styles.focusChipText, active && styles.focusChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LeadEditSheet({
  draft,
  isSaving,
  onChange,
  onClose,
  onSave,
  visible,
}: {
  draft: LeadEditDraft;
  isSaving: boolean;
  onChange: (draft: LeadEditDraft) => void;
  onClose: () => void;
  onSave: () => void;
  visible: boolean;
}) {
  function patchDraft(patch: Partial<LeadEditDraft>) {
    onChange({ ...draft, ...patch });
  }

  return (
    <AppBottomSheet
      description="Edit the lead details shown on the card."
      onClose={onClose}
      title="Edit Lead"
      visible={visible}
    >
      <View style={styles.editSheetStack}>
        <TextInput
          onChangeText={(name) => patchDraft({ name })}
          placeholder="Lead or shop name"
          placeholderTextColor={palette.mutedInk}
          style={styles.editInput}
          value={draft.name}
        />
        <TextInput
          onChangeText={(contactPerson) => patchDraft({ contactPerson })}
          placeholder="Decision maker"
          placeholderTextColor={palette.mutedInk}
          style={styles.editInput}
          value={draft.contactPerson}
        />
        <TextInput
          keyboardType="phone-pad"
          onChangeText={(phone) => patchDraft({ phone })}
          placeholder="Phone"
          placeholderTextColor={palette.mutedInk}
          style={styles.editInput}
          value={draft.phone}
        />
        <TextInput
          onChangeText={(role) => patchDraft({ role })}
          placeholder="Role"
          placeholderTextColor={palette.mutedInk}
          style={styles.editInput}
          value={draft.role}
        />
        <TextInput
          multiline
          onChangeText={(nextStep) => patchDraft({ nextStep })}
          placeholder="Next step"
          placeholderTextColor={palette.mutedInk}
          style={[styles.editInput, styles.editInputMultiline]}
          value={draft.nextStep}
        />
        <View style={styles.editActionRow}>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.editSecondaryButton, pressed && styles.sheetDeleteButtonPressed]}
          >
            <Text style={styles.editSecondaryText}>Cancel</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={isSaving}
            onPress={onSave}
            style={({ pressed }) => [
              styles.editPrimaryButton,
              isSaving && styles.actionDisabled,
              pressed && !isSaving && styles.startMissionButtonPressed,
            ]}
          >
            <Text style={styles.editPrimaryText}>{isSaving ? "Saving..." : "Save"}</Text>
          </Pressable>
        </View>
      </View>
    </AppBottomSheet>
  );
}

function MoveSheet({
  activeMissionId,
  deletingCategoryId,
  getMissionCategories,
  missionProfiles,
  onClose,
  onDeleteCategory,
  onMove,
  selectedLead,
}: {
  activeMissionId: string;
  deletingCategoryId: string | null;
  getMissionCategories: (missionId?: string | null) => { id: string; label: string }[];
  missionProfiles: MissionDefinition[];
  onClose: () => void;
  onDeleteCategory: (category: MissionCategory) => void;
  onMove: (missionLabel: string, categoryLabel: string) => Promise<void>;
  selectedLead: LeadTarget | null;
}) {
  const mission = getMissionDefinition(activeMissionId);
  const categories = getMissionCategories(activeMissionId);

  return (
    <AppBottomSheet
      description="Move the selected lead into another folder or module without leaving the list."
      onClose={onClose}
      title={selectedLead ? getRowName(selectedLead) : "Lead"}
      visible={selectedLead !== null}
    >
      <AppTip
        message="This uses the same modal pattern as capture destination selection, so the move flow stays predictable."
        tone="info"
      />
      <Text style={styles.sheetSectionTitle}>Move To Folder</Text>
      {categories.map((category) => (
        <Pressable
          key={category.id}
          onPress={() => {
            void playSelectionHaptic();
            void onMove(mission.label, category.label);
          }}
          style={styles.sheetButton}
        >
          <Text ellipsizeMode="tail" numberOfLines={1} style={styles.sheetButtonText}>
            {category.label}
          </Text>
          {category.label.toLowerCase() !== "unsorted" ? (
            <Pressable
              accessibilityLabel={`Delete ${category.label} folder`}
              accessibilityRole="button"
              disabled={deletingCategoryId !== null}
              hitSlop={10}
              onPress={(event) => {
                event.stopPropagation();
                void playSelectionHaptic();
                onDeleteCategory(category);
              }}
              style={({ pressed }) => [
                styles.sheetDeleteButton,
                deletingCategoryId === category.id && styles.actionDisabled,
                pressed && deletingCategoryId === null && styles.sheetDeleteButtonPressed,
              ]}
            >
              <Trash2 color={palette.danger} size={17} />
            </Pressable>
          ) : null}
        </Pressable>
      ))}
      <Text style={styles.sheetSectionTitle}>Change Mission</Text>
      {missionProfiles.map((missionOption) => (
        <Pressable
          key={missionOption.id}
          onPress={() => {
            void playSelectionHaptic();
            const missionOptionCategories = getMissionCategories(missionOption.id);
            const fallback =
              missionOptionCategories.find((category) => category.id === "unsorted")?.label ??
              missionOptionCategories[0]?.label ??
              "Unsorted";
            void onMove(missionOption.label, fallback);
          }}
          style={styles.sheetButton}
        >
          <Text style={styles.sheetButtonText}>{missionOption.label}</Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => {
          void playSelectionHaptic();
          onClose();
        }}
        style={styles.sheetClose}
      >
        <Text style={styles.sheetCloseText}>Close</Text>
      </Pressable>
    </AppBottomSheet>
  );
}

function getRowCategory(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.category : row.shop.category;
}

function getRowCreatedAt(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.createdAt : row.shop.createdAt;
}

function getRowContact(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.contactPerson : row.shop.contactPerson;
}

function getRowRole(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.role ?? "" : row.shop.role ?? "";
}

function getRowNextStep(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.nextStep ?? "" : row.shop.nextStep ?? "";
}

function getRowLocation(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.location : row.shop.location;
}

function getRowName(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.name : row.shop.name;
}

function getRowNeighborhood(row: LeadTarget) {
  const value = row.kind === "pending" ? row.capture.neighborhood : row.shop.neighborhood;
  return value.trim() || null;
}

function getRowPhone(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.phone : row.shop.phone;
}

function getRowOutcome(row: LeadTarget) {
  return row.kind === "pending" ? row.capture.outcome ?? "unknown" : row.shop.outcome;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: spacing.lg },
  contentCompact: { gap: spacing.md },
  dashboard: { gap: spacing.lg },
  statsRibbon: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg },
  ribbonCard: { flex: 1, backgroundColor: palette.surface, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, padding: spacing.md, alignItems: "center", gap: 4 },
  ribbonCardDark: { backgroundColor: "#161719" },
  ribbonValue: { fontSize: 22, fontWeight: "800", color: palette.ink },
  ribbonValueDark: { color: palette.white },
  ribbonLabel: { fontSize: 10, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  ribbonLabelDark: { color: "#B4AC9F" },
  sectionHeaderLabel: { fontSize: 11, fontWeight: "800", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: spacing.xs },
  sectionHelperText: { marginTop: -spacing.xs, fontSize: typography.label, color: palette.mutedInk },
  recentCarousel: { gap: spacing.sm, paddingRight: spacing.lg },
  recentCardWrap: { width: 140 },
  recentCard: { width: 140, backgroundColor: palette.surface, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, padding: spacing.sm, gap: 4 },
  recentCardPressed: { backgroundColor: palette.backgroundMuted },
  recentIconBox: { width: 28, height: 28, borderRadius: radii.sm, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  recentName: { fontSize: 14, fontWeight: "700", color: palette.ink },
  recentMeta: { fontSize: 11, color: palette.mutedInk, fontWeight: "600" },
  emptyRecent: { height: 80, justifyContent: "center", paddingHorizontal: spacing.md },
  emptyRecentText: { fontSize: 12, color: palette.mutedInk, fontStyle: "italic" },
  folderInfo: { width: "100%", minWidth: 0, alignItems: "center", gap: 2 },
  folderCardWrap: {},
  changeMissionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, marginTop: spacing.md },
  changeMissionText: { fontSize: 13, fontWeight: "700", color: palette.mutedInk },
  syncBar: { marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderRadius: radii.pill, backgroundColor: palette.backgroundMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  syncRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  syncText: { flex: 1, fontSize: typography.label, fontWeight: "700", color: palette.ink },
  syncMeta: { fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  section: { paddingHorizontal: spacing.lg, gap: spacing.md },
  commandCard: {
    gap: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    padding: spacing.md,
  },
  commandHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  commandTitle: {
    fontSize: typography.overline,
    fontWeight: "800",
    color: palette.accentStrong,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  commandText: {
    fontSize: typography.label,
    color: palette.mutedInk,
    lineHeight: 20,
  },
  controlStack: { gap: spacing.sm },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  sectionMeta: { fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  folderGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.sm },
  folderCard: { width: "100%", minHeight: 126, alignItems: "center", justifyContent: "center", borderRadius: radii.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.sm },
  folderCardPressed: { backgroundColor: palette.backgroundMuted },
  folderIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentSoft },
  folderName: { width: "100%", fontSize: 16, lineHeight: 20, fontWeight: "800", color: palette.ink, textAlign: "center" },
  folderCount: { fontSize: typography.label, color: palette.mutedInk },
  folderCountEmpty: { color: palette.mutedInk },
  folderCreateButton: { minHeight: 34, justifyContent: "center", borderRadius: radii.pill, backgroundColor: palette.accentSoft, paddingHorizontal: spacing.sm },
  folderCreateButtonPressed: { opacity: 0.78 },
  folderCreateText: { fontSize: 12, fontWeight: "800", color: palette.accentStrong },
  folderPinButton: { position: "absolute", top: spacing.sm, left: spacing.sm, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255, 252, 248, 0.72)" },
  folderPinButtonActive: { backgroundColor: palette.accentSoft },
  folderDeleteButton: { position: "absolute", top: spacing.sm, right: spacing.sm, width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: palette.dangerSoft },
  folderIconButtonPressed: { opacity: 0.72 },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, minHeight: 48, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontSize: typography.body, color: palette.ink },
  refreshButton: { width: 48, height: 48, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  segmentedControl: { flex: 1, flexDirection: "row", borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 4 },
  segment: { flex: 1, minHeight: 36, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: palette.accent },
  segmentPressed: { backgroundColor: palette.backgroundMuted },
  segmentText: { fontSize: typography.overline, fontWeight: "800", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 0.8 },
  segmentTextActive: { color: palette.white },
  locateButton: { width: 40, height: 40, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  chipRow: { gap: spacing.xs, paddingRight: spacing.lg },
  areaChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: spacing.sm, paddingVertical: 7 },
  areaChipPrimary: { borderColor: "#232529", backgroundColor: "#232529" },
  areaChipActive: { borderColor: palette.accent, backgroundColor: palette.accent },
  areaChipPressed: { backgroundColor: palette.backgroundMuted },
  areaChipText: { fontSize: typography.label, fontWeight: "700", color: palette.ink },
  areaChipTextPrimary: { color: palette.white },
  areaChipTextActive: { color: palette.white },
  focusChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
  },
  focusChipActive: {
    borderColor: palette.accent,
    backgroundColor: palette.accent,
  },
  focusChipPressed: {
    backgroundColor: palette.backgroundMuted,
  },
  focusChipText: {
    fontSize: typography.label,
    fontWeight: "700",
    color: palette.ink,
  },
  focusChipTextActive: {
    color: palette.white,
  },
  listContent: { paddingBottom: spacing.xl },
  separator: { height: spacing.sm },
  centerState: { alignItems: "center", justifyContent: "center", gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl },
  centerText: { textAlign: "center", fontSize: typography.label, lineHeight: 22, color: palette.mutedInk },
  emptyTitle: { textAlign: "center", fontSize: typography.title, fontWeight: "700", color: palette.ink },
  startMissionButton: {
    minWidth: 180,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
    paddingHorizontal: spacing.lg,
  },
  startMissionButtonPressed: {
    backgroundColor: palette.accentStrong,
  },
  startMissionButtonText: {
    fontSize: typography.body,
    fontWeight: "800",
    color: palette.white,
  },
  editSheetStack: { gap: spacing.sm },
  editInput: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    backgroundColor: palette.card,
    color: palette.ink,
    fontSize: typography.body,
    fontWeight: "700",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  editInputMultiline: {
    minHeight: 86,
    textAlignVertical: "top",
  },
  editActionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  editSecondaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
  },
  editSecondaryText: {
    fontSize: typography.label,
    fontWeight: "800",
    color: palette.ink,
  },
  editPrimaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.accent,
  },
  editPrimaryText: {
    fontSize: typography.label,
    fontWeight: "900",
    color: palette.white,
  },
  sheetSectionTitle: { marginTop: spacing.sm, fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  sheetButton: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  sheetButtonText: { flex: 1, minWidth: 0, fontSize: typography.body, fontWeight: "700", color: palette.ink },
  sheetDeleteButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: palette.dangerSoft },
  sheetDeleteButtonPressed: { opacity: 0.72 },
  actionDisabled: { opacity: 0.5 },
  sheetClose: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  sheetCloseText: { fontSize: typography.label, fontWeight: "700", color: palette.accentStrong },
});
