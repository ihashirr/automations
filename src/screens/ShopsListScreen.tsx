import * as Location from "expo-location";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
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
  Store,
  Target,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { ShopCard } from "../components/ShopCard";
import {
  getMissionDefinition,
  missionCatalog,
} from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { buildSearchText, formatDistance, normalizeSearchText } from "../lib/format";
import { playMissionAccomplishedHaptic, playSelectionHaptic } from "../lib/haptics";
import { calculateDistanceMeters, getLocationLabel, resolveLocationDetails } from "../lib/location";
import { HomeTabParamList, RootStackParamList } from "../navigation/types";
import { CapturedLocation, PendingCapture, ShopSummary } from "../types/shops";

type SortMode = "latest" | "nearest";
type DashboardNavigation = CompositeNavigationProp<
  BottomTabNavigationProp<HomeTabParamList, "Missions">,
  NativeStackNavigationProp<RootStackParamList>
>;
type LeadTarget = { kind: "pending"; capture: PendingCapture } | { kind: "remote"; shop: ShopSummary };
type DashboardRow = { distanceMeters: number | null; row: LeadTarget };

const categoryIcons = {
  cafes: Coffee,
  groceries: ShoppingBasket,
  "perfume-shops": Sparkles,
  unsorted: FolderOpen,
} as const;

export function ShopsListScreen() {
  const navigation = useNavigation<DashboardNavigation>();
  const insets = useSafeAreaInsets();
  const moveShop = useMutation(api.shops.moveShop);
  const {
    activeCategoryId,
    activeCategoryLabel,
    activeMissionId,
    activeMissionLabel,
    setActiveCategoryId,
    setActiveMissionId,
  } = useMissionControl();
  const {
    flushQueue,
    isFlushing,
    isOnline,
    pendingCaptures,
    pendingCount,
    queueReady,
    reclassifyPendingCapture,
  } = useCaptureQueue();
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("latest");
  const [activeNeighborhood, setActiveNeighborhood] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CapturedLocation | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationIssue, setLocationIssue] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadTarget | null>(null);
  const normalizedSearch = normalizeSearchText(useDeferredValue(searchText));
  const mission = getMissionDefinition(activeMissionId);
  const feed = useQuery(api.shops.listMissionFeed, { mission: activeMissionLabel, limit: 200 });

  useEffect(() => {
    setActiveNeighborhood(null);
    setSearchText("");
  }, [activeCategoryId, activeMissionId]);

  useEffect(() => {
    if (sortMode === "nearest" && !currentLocation && !isLocating) {
      void refreshCurrentLocation();
    }
  }, [currentLocation, isLocating, sortMode]);

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
      setCurrentLocation({ ...coordinates, formattedAddress: details.formattedAddress });
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
      .filter((capture) => normalizeSearchText(capture.mission) === normalizeSearchText(activeMissionLabel))
      .map<LeadTarget>((capture) => ({ kind: "pending", capture }));
    const remoteRows = (feed ?? []).map<LeadTarget>((shop: ShopSummary) => ({ kind: "remote", shop }));
    return [...pendingRows, ...remoteRows];
  }, [activeMissionLabel, feed, pendingCaptures]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const category of mission.categories) counts.set(category.label, 0);
    for (const row of missionRows) counts.set(getRowCategory(row), (counts.get(getRowCategory(row)) ?? 0) + 1);
    return counts;
  }, [mission.categories, missionRows]);

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

  const rows = useMemo(() => {
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

  const isLoading = !queueReady || feed === undefined;

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

  function returnToFolderGrid() {
    void playSelectionHaptic();
    setActiveCategoryId(null);
  }

  function openCaptureScreen() {
    void playSelectionHaptic();
    navigation.navigate("Capture");
  }

  function renderLead({ item }: { item: DashboardRow }) {
    const row = item.row;
    const commonProps = {
      contactPerson: getRowContact(row),
      createdAt: getRowCreatedAt(row),
      distanceLabel: sortMode === "nearest" ? formatDistance(item.distanceMeters) : null,
      location: getRowLocation(row),
      name: getRowName(row),
      neighborhood: getRowNeighborhood(row),
      onLongPress: () => setSelectedLead(row),
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
        statusLabel="Live"
        statusTone="live"
      />
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          {activeCategoryLabel ? (
            <>
              <View style={styles.breadcrumbHeader}>
                <Pressable
                  accessibilityLabel="Back to missions"
                  accessibilityRole="button"
                  hitSlop={10}
                  onPress={returnToFolderGrid}
                  style={({ pressed }) => [
                    styles.breadcrumbBackButton,
                    pressed && styles.breadcrumbBackButtonPressed,
                  ]}
                >
                  <ArrowLeft color={palette.white} size={18} />
                </Pressable>
                <View style={styles.breadcrumbCopy}>
                  <Text style={styles.eyebrow}>Strategic Mission Dashboard</Text>
                  <View style={styles.breadcrumbRow}>
                    <Pressable
                      accessibilityLabel="Go to mission folders"
                      accessibilityRole="button"
                      onPress={returnToFolderGrid}
                    >
                      <Text style={styles.breadcrumbLink}>Missions</Text>
                    </Pressable>
                    <Text style={styles.breadcrumbSlash}>/</Text>
                    <Text numberOfLines={1} style={styles.breadcrumbCurrent}>
                      {activeCategoryLabel}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.heroSubtitle}>
                One-thumb folder view for {activeMissionLabel}. Dive in, act, and back out fast.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>Strategic Mission Dashboard</Text>
              <Text style={styles.heroTitle}>{activeMissionLabel}</Text>
              <Text style={styles.heroSubtitle}>
                Open a folder and start capturing territory.
              </Text>
              <View style={styles.heroTag}>
                <Target color={palette.accent} size={14} />
                <Text style={styles.heroTagText}>Folder View</Text>
              </View>
              <View style={styles.missionRow}>
                {missionCatalog.map((option) => (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      void playSelectionHaptic();
                      setActiveMissionId(option.id);
                    }}
                    style={({ pressed }) => [
                      styles.missionChip,
                      option.id === activeMissionId && styles.missionChipActive,
                      pressed && option.id !== activeMissionId && styles.missionChipPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.missionChipText,
                        option.id === activeMissionId && styles.missionChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        <View style={styles.syncBar}>
          <View style={styles.syncRow}>
            {isOnline ? <Wifi color={palette.success} size={16} /> : <WifiOff color={palette.warning} size={16} />}
            <Text numberOfLines={1} style={styles.syncText}>
              {locationIssue
                ? locationIssue
                : currentLocation
                  ? `${isOnline ? "Mission Sync Live" : "Offline queue active"} • ${getLocationLabel(currentLocation)}`
                  : isOnline
                    ? "Mission Sync Live"
                    : "Offline queue active"}
            </Text>
          </View>
          <Text style={styles.syncMeta}>
            {pendingCount > 0 ? `${pendingCount} queued` : isFlushing ? "Syncing" : "Ready"}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={palette.accent} />
            <Text style={styles.centerText}>Loading mission data...</Text>
          </View>
        ) : !activeCategoryId ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Folders</Text>
              <Text style={styles.sectionMeta}>{missionRows.length} leads</Text>
            </View>
            <View style={styles.folderGrid}>
              {mission.categories.map((category) => {
                const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? Store;
                return (
                  <Pressable
                    key={category.id}
                    onPress={() => {
                      void playSelectionHaptic();
                      setActiveCategoryId(category.id);
                    }}
                    style={({ pressed }) => [styles.folderCard, pressed && styles.folderCardPressed]}
                  >
                    <View style={styles.folderIcon}><Icon color={palette.accent} size={22} /></View>
                    <Text style={styles.folderName}>{category.label}</Text>
                    <Text style={styles.folderCount}>{categoryCounts.get(category.label) ?? 0} leads</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{activeCategoryLabel}</Text>
              <Text style={styles.sectionMeta}>{rows.length} leads</Text>
            </View>
            <View style={styles.searchRow}>
              <View style={styles.searchBox}>
                <Search color={palette.mutedInk} size={18} />
                <TextInput
                  onChangeText={setSearchText}
                  placeholder="Search current folder"
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
                <Segment active={sortMode === "latest"} label="Latest Saved" onPress={() => setSortMode("latest")} />
                <Segment active={sortMode === "nearest"} label="Nearest To Me" onPress={() => setSortMode("nearest")} />
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
            <FlatList
              contentContainerStyle={styles.listContent}
              data={rows}
              keyExtractor={(item) => (item.row.kind === "pending" ? item.row.capture.localId : item.row.shop._id)}
              refreshControl={<RefreshControl onRefresh={() => void flushQueue()} refreshing={isFlushing} />}
              renderItem={renderLead}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              ListEmptyComponent={
                <View style={styles.centerState}>
                  <Text style={styles.emptyTitle}>No leads yet.</Text>
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
                </View>
              }
            />
          </View>
        )}
      </ScrollView>

      <MoveSheet activeMissionId={activeMissionId} onClose={() => setSelectedLead(null)} onMove={handleMoveLead} selectedLead={selectedLead} />
    </View>
  );
}

function Segment({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        void playSelectionHaptic();
        onPress();
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
        onPress();
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

function MoveSheet({
  activeMissionId,
  onClose,
  onMove,
  selectedLead,
}: {
  activeMissionId: string;
  onClose: () => void;
  onMove: (missionLabel: string, categoryLabel: string) => Promise<void>;
  selectedLead: LeadTarget | null;
}) {
  const mission = getMissionDefinition(activeMissionId);

  return (
    <Modal animationType="slide" transparent visible={selectedLead !== null} onRequestClose={onClose}>
      <Pressable
        style={styles.sheetBackdrop}
        onPress={() => {
          void playSelectionHaptic();
          onClose();
        }}
      >
        <Pressable style={styles.sheetCard} onPress={() => {}}>
          <Text style={styles.sheetEyebrow}>Move Lead</Text>
          <Text style={styles.sheetTitle}>{selectedLead ? getRowName(selectedLead) : "Lead"}</Text>
          <Text style={styles.sheetSectionTitle}>Move To Folder</Text>
          {mission.categories.map((category) => (
            <Pressable
              key={category.id}
              onPress={() => {
                void playSelectionHaptic();
                void onMove(mission.label, category.label);
              }}
              style={styles.sheetButton}
            >
              <Text style={styles.sheetButtonText}>{category.label}</Text>
            </Pressable>
          ))}
          <Text style={styles.sheetSectionTitle}>Change Mission</Text>
          {missionCatalog.map((missionOption) => (
            <Pressable
              key={missionOption.id}
              onPress={() => {
                void playSelectionHaptic();
                const fallback = missionOption.categories.find((category) => category.id === "unsorted")?.label ?? missionOption.categories[0]?.label ?? "Unsorted";
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
        </Pressable>
      </Pressable>
    </Modal>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.background },
  content: { gap: spacing.lg },
  hero: { gap: spacing.md, backgroundColor: "#161719", paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, paddingTop: spacing.lg },
  eyebrow: { fontSize: typography.overline, fontWeight: "700", color: "#B4AC9F", letterSpacing: 1.2, textTransform: "uppercase" },
  heroTitle: { fontSize: 32, lineHeight: 36, fontWeight: "800", color: palette.white },
  heroSubtitle: { fontSize: typography.body, lineHeight: 22, color: "#E6DFD4" },
  breadcrumbHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  breadcrumbBackButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#232529",
  },
  breadcrumbBackButtonPressed: {
    backgroundColor: "#2E3137",
  },
  breadcrumbCopy: { flex: 1, gap: spacing.xs },
  breadcrumbRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  breadcrumbLink: { fontSize: typography.title, fontWeight: "700", color: "#E6DFD4" },
  breadcrumbSlash: { fontSize: typography.title, fontWeight: "700", color: "#817A70" },
  breadcrumbCurrent: { flex: 1, fontSize: typography.title, fontWeight: "800", color: palette.white },
  heroTag: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.xs, borderRadius: radii.pill, backgroundColor: "#232529", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  heroTagText: { fontSize: typography.overline, fontWeight: "700", color: palette.white, textTransform: "uppercase", letterSpacing: 0.8 },
  missionRow: { flexDirection: "row", gap: spacing.sm },
  missionChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: "#40434A", paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  missionChipActive: { borderColor: palette.accent, backgroundColor: "#2A1F1A" },
  missionChipPressed: { backgroundColor: "#232529" },
  missionChipText: { fontSize: typography.label, fontWeight: "700", color: "#D6CFBF" },
  missionChipTextActive: { color: palette.white },
  syncBar: { marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderRadius: radii.pill, backgroundColor: palette.backgroundMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  syncRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  syncText: { flex: 1, fontSize: typography.label, fontWeight: "700", color: palette.ink },
  syncMeta: { fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  section: { paddingHorizontal: spacing.lg, gap: spacing.md },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  sectionTitle: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  sectionMeta: { fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  folderGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  folderCard: { width: "48%", borderRadius: radii.lg, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: spacing.lg, gap: spacing.sm },
  folderCardPressed: { backgroundColor: palette.backgroundMuted },
  folderIcon: { width: 44, height: 44, borderRadius: radii.md, alignItems: "center", justifyContent: "center", backgroundColor: palette.accentSoft },
  folderName: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  folderCount: { fontSize: typography.label, color: palette.mutedInk },
  searchRow: { flexDirection: "row", gap: spacing.sm },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, minHeight: 52, paddingHorizontal: spacing.md },
  searchInput: { flex: 1, fontSize: typography.body, color: palette.ink },
  refreshButton: { width: 52, height: 52, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  toolbar: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  segmentedControl: { flex: 1, flexDirection: "row", borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, padding: 4 },
  segment: { flex: 1, minHeight: 40, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: palette.accent },
  segmentPressed: { backgroundColor: palette.backgroundMuted },
  segmentText: { fontSize: typography.overline, fontWeight: "800", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 0.8 },
  segmentTextActive: { color: palette.white },
  locateButton: { width: 44, height: 44, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, alignItems: "center", justifyContent: "center" },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  areaChip: { borderRadius: radii.pill, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  areaChipPrimary: { borderColor: "#232529", backgroundColor: "#232529" },
  areaChipActive: { borderColor: palette.accent, backgroundColor: palette.accent },
  areaChipPressed: { backgroundColor: palette.backgroundMuted },
  areaChipText: { fontSize: typography.label, fontWeight: "700", color: palette.ink },
  areaChipTextPrimary: { color: palette.white },
  areaChipTextActive: { color: palette.white },
  listContent: { paddingBottom: spacing.xxl },
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
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(28, 28, 30, 0.32)" },
  sheetCard: { gap: spacing.sm, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, backgroundColor: palette.surface, padding: spacing.lg },
  sheetEyebrow: { fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  sheetTitle: { fontSize: typography.title, fontWeight: "800", color: palette.ink },
  sheetSectionTitle: { marginTop: spacing.sm, fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  sheetButton: { borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  sheetButtonText: { fontSize: typography.body, fontWeight: "700", color: palette.ink },
  sheetClose: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  sheetCloseText: { fontSize: typography.label, fontWeight: "700", color: palette.accentStrong },
});
