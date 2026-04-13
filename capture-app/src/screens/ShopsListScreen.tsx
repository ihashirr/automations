import * as Location from "expo-location";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  useFocusEffect,
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
  Store,
  Target,
  Wifi,
  WifiOff,
} from "lucide-react-native";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { api } from "../../convex/_generated/api";
import { AppBottomSheet } from "../components/AppBottomSheet";
import { AppTip } from "../components/AppTip";
import { ShopCard } from "../components/ShopCard";
import { getVisitOutcomeLabel } from "../constants/visit-outcomes";
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
import { HomeTabParamList, MissionsStackParamList, RootStackParamList } from "../navigation/types";
import { CapturedLocation, PendingCapture, ShopSummary } from "../types/shops";

type SortMode = "latest" | "nearest";
type DashboardNavigation = CompositeNavigationProp<
  NativeStackNavigationProp<MissionsStackParamList>,
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
  const moveShop = useMutation(api.shops.moveShop);
  const {
    activeCategoryId,
    activeCategoryLabel,
    activeMissionId,
    activeMissionLabel,
    getMissionCategories,
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
  const missionCategories = useMemo(
    () => getMissionCategories(activeMissionId),
    [activeMissionId, getMissionCategories],
  );
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
    for (const category of missionCategories) counts.set(category.label, 0);
    for (const row of missionRows) counts.set(getRowCategory(row), (counts.get(getRowCategory(row)) ?? 0) + 1);
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
    navigation.navigate("MissionsList");
  }

  function openCaptureScreen() {
    void playSelectionHaptic();
    // Use the root navigator to switch tabs if necessary
    (navigation as any).getParent()?.navigate("Capture");
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
        statusLabel="Live"
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
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.syncBar}>
          <View style={styles.syncRow}>
            {isOnline ? <Wifi color={palette.success} size={16} /> : <WifiOff color={palette.warning} size={16} />}
            <Text numberOfLines={1} style={styles.syncText}>
              {currentLocation ? `Sync Live • ${getLocationLabel(currentLocation)}` : "Sync Live"}
            </Text>
          </View>
        </View>

        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : !activeCategoryId ? (
          <View style={styles.dashboard}>
            {/* Layer 1: Mission Stats Ribbon */}
            <View style={styles.statsRibbon}>
              <View style={styles.ribbonCard}>
                <Text style={styles.ribbonValue}>{feed?.length || 0}</Text>
                <Text style={styles.ribbonLabel}>LIVE LEADS</Text>
              </View>
              <View style={[styles.ribbonCard, { backgroundColor: "#161719" }]}>
                <Text style={[styles.ribbonValue, { color: palette.white }]}>{pendingCount}</Text>
                <Text style={[styles.ribbonLabel, { color: "#B4AC9F" }]}>PENDING</Text>
              </View>
            </View>

            {/* Layer 2: Recent Activity Carousel */}
            <View style={styles.section}>
              <Text style={styles.sectionHeaderLabel}>RECENT ACTIVITY</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                contentContainerStyle={styles.recentCarousel}
              >
                {missionRows.slice(0, 5).map((row, idx) => (
                  <Pressable 
                    key={idx} 
                    onPress={() => {
                        void playSelectionHaptic();
                        if (row.kind === "remote") {
                            navigation.navigate("ShopDetail", { shopId: row.shop._id });
                        }
                    }}
                    style={styles.recentCard}
                  >
                    <View style={styles.recentIconBox}>
                       <Sparkles color={palette.accent} size={16} />
                    </View>
                    <Text numberOfLines={1} style={styles.recentName}>{getRowName(row)}</Text>
                    <Text style={styles.recentMeta}>{getRowNeighborhood(row) || "Unknown"}</Text>
                  </Pressable>
                ))}
                {missionRows.length === 0 && (
                  <View style={styles.emptyRecent}>
                    <Text style={styles.emptyRecentText}>No recent activity</Text>
                  </View>
                )}
              </ScrollView>
            </View>

            {/* Layer 3: Folder Grid */}
            <View style={styles.section}>
              <Text style={styles.sectionHeaderLabel}>MISSION FOLDERS</Text>
              <View style={styles.folderGrid}>
                {missionCategories.map((category) => {
                  const Icon = categoryIcons[category.id as keyof typeof categoryIcons] ?? Store;
                  return (
                    <Pressable
                      key={category.id}
                      onPress={() => {
                        void playSelectionHaptic();
                        setActiveCategoryId(category.id);
                        navigation.navigate("MissionDetail", {
                          missionId: activeMissionId,
                          categoryId: category.id,
                        });
                      }}
                      style={({ pressed }) => [styles.folderCard, pressed && styles.folderCardPressed]}
                    >
                      <View style={styles.folderIcon}>
                        <Icon color={palette.accent} size={22} />
                      </View>
                      <View style={styles.folderInfo}>
                        <Text style={styles.folderName}>{category.label}</Text>
                        <Text style={styles.folderCount}>{categoryCounts.get(category.label) ?? 0} leads</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <Pressable 
              onPress={() => {
                void playSelectionHaptic();
                navigation.navigate("MissionHub");
              }}
              style={styles.changeMissionButton}
            >
              <ArrowLeft color={palette.mutedInk} size={16} />
              <Text style={styles.changeMissionText}>Switch Operational Module</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{activeCategoryLabel}</Text>
              <Text style={styles.sectionMeta}>{rows.length} leads</Text>
            </View>
            <View style={styles.controlStack}>
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
            </View>
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

      <MoveSheet
        activeMissionId={activeMissionId}
        getMissionCategories={getMissionCategories}
        onClose={() => setSelectedLead(null)}
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
  getMissionCategories,
  onClose,
  onMove,
  selectedLead,
}: {
  activeMissionId: string;
  getMissionCategories: (missionId?: string | null) => { id: string; label: string }[];
  onClose: () => void;
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
          <Text style={styles.sheetButtonText}>{category.label}</Text>
        </Pressable>
      ))}
      <Text style={styles.sheetSectionTitle}>Change Mission</Text>
      {missionCatalog.map((missionOption) => (
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
  ribbonValue: { fontSize: 22, fontWeight: "800", color: palette.ink },
  ribbonLabel: { fontSize: 10, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  sectionHeaderLabel: { fontSize: 11, fontWeight: "800", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: spacing.xs },
  recentCarousel: { gap: spacing.sm, paddingRight: spacing.lg },
  recentCard: { width: 140, backgroundColor: palette.surface, borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, padding: spacing.sm, gap: 4 },
  recentIconBox: { width: 28, height: 28, borderRadius: radii.sm, backgroundColor: palette.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  recentName: { fontSize: 14, fontWeight: "700", color: palette.ink },
  recentMeta: { fontSize: 11, color: palette.mutedInk, fontWeight: "600" },
  emptyRecent: { height: 80, justifyContent: "center", paddingHorizontal: spacing.md },
  emptyRecentText: { fontSize: 12, color: palette.mutedInk, fontStyle: "italic" },
  folderInfo: { flex: 1, gap: 2 },
  changeMissionButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: palette.line, marginTop: spacing.md },
  changeMissionText: { fontSize: 13, fontWeight: "700", color: palette.mutedInk },
  syncBar: { marginHorizontal: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm, borderRadius: radii.pill, backgroundColor: palette.backgroundMuted, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  syncRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  syncText: { flex: 1, fontSize: typography.label, fontWeight: "700", color: palette.ink },
  syncMeta: { fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  section: { paddingHorizontal: spacing.lg, gap: spacing.md },
  controlStack: { gap: spacing.sm },
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
  sheetSectionTitle: { marginTop: spacing.sm, fontSize: typography.overline, fontWeight: "700", color: palette.mutedInk, textTransform: "uppercase", letterSpacing: 1 },
  sheetButton: { borderRadius: radii.md, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  sheetButtonText: { fontSize: typography.body, fontWeight: "700", color: palette.ink },
  sheetClose: { marginTop: spacing.md, alignItems: "center", paddingVertical: spacing.sm },
  sheetCloseText: { fontSize: typography.label, fontWeight: "700", color: palette.accentStrong },
});
