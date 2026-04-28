import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LayoutDashboard, Zap, ArrowRight, Target, Clock, Trash2 } from "lucide-react-native";
import { memo, startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Easing, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MissionDefinition } from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useMissionControl } from "../contexts/MissionControlContext";
import { playSelectionHaptic } from "../lib/haptics";
import { MissionsStackParamList } from "../navigation/types";

type NavigationProp = NativeStackNavigationProp<MissionsStackParamList, "MissionsList">;
type MissionModuleCardProps = {
  deletingMissionId: string | null;
  index: number;
  item: MissionDefinition;
  onDeleteMission: (mission: MissionDefinition) => void;
  onOpenMission: (missionId: string) => void;
};

function useEntranceMotion(delay: number, distance = 18, duration = 300) {
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
        duration: duration + 40,
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
    animateTo(0.985);
  }, [animateTo]);

  const handlePressOut = useCallback(() => {
    animateTo(1);
  }, [animateTo]);

  return { handlePressIn, handlePressOut, scale };
}

const MissionHubHeader = memo(function MissionHubHeader({ missionCount }: { missionCount: number }) {
  const { opacity, translateY } = useEntranceMotion(0, 24, 340);

  return (
    <Animated.View
      style={[
        styles.heroPanel,
        {
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <View style={styles.heroGlow} />
      <View style={styles.heroGlowSecondary} />
      <Text style={styles.heroEyebrow}>Mission SUITE</Text>
      <Text style={styles.heroTitle}>Choose a module and keep the day moving.</Text>
      <Text style={styles.heroBody}>
        Capture fresh leads, keep folders clean, and route the team from one calmer command surface.
      </Text>

      <View style={styles.hubSummary}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{missionCount}</Text>
          <Text style={styles.summaryLabel}>Active Missions</Text>
        </View>
      </View>
    </Animated.View>
  );
});

const MissionModuleCard = memo(function MissionModuleCard({
  deletingMissionId,
  index,
  item,
  onDeleteMission,
  onOpenMission,
}: MissionModuleCardProps) {
  const { opacity, translateY } = useEntranceMotion(120 + index * 70, 22, 300);
  const { handlePressIn, handlePressOut, scale } = usePressScale();
  const handlePress = useCallback(() => {
    onOpenMission(item.id);
  }, [item.id, onOpenMission]);

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.missionCard,
          pressed && styles.missionCardPressed,
        ]}
      >
        <View style={styles.cardEyebrowRow}>
          <Text style={styles.cardEyebrow}>Operational Module</Text>
          <Pressable
            accessibilityLabel={`Delete ${item.label} mission profile`}
            accessibilityRole="button"
            disabled={deletingMissionId !== null}
            hitSlop={8}
            onPress={(event) => {
              event.stopPropagation();
              onDeleteMission(item);
            }}
            style={({ pressed }) => [
              styles.missionDeleteButton,
              pressed && styles.missionDeleteButtonPressed,
              deletingMissionId === item.id && styles.missionDeleteButtonDisabled,
            ]}
          >
            <Trash2 color={palette.danger} size={18} />
          </Pressable>
        </View>

        <View style={styles.cardHeader}>
          <View style={styles.iconBox}>
            <LayoutDashboard color={palette.accent} size={22} />
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.missionTitle}>{item.label}</Text>
            <Text style={styles.missionSubtitle}>{item.categories.length} folders • Field Op</Text>
          </View>
          <ArrowRight color={palette.mutedInk} size={20} />
        </View>

        <View style={styles.cardStats}>
          <View style={styles.statItem}>
            <Target color={palette.mutedInk} size={14} />
            <Text style={styles.statText}>Lead flow</Text>
          </View>
          <View style={styles.statItem}>
            <Clock color={palette.mutedInk} size={14} />
            <Text style={styles.statText}>Field log</Text>
          </View>
        </View>

        <View style={styles.resumeButton}>
          <Text style={styles.resumeButtonText}>Enter Module</Text>
          <Zap color={palette.white} fill={palette.white} size={14} />
        </View>
      </Pressable>
    </Animated.View>
  );
});

export function MissionHubScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { deleteMissionProfile, getMissionProfiles, setActiveMissionId, setActiveCategoryId } = useMissionControl();
  const [deletingMissionId, setDeletingMissionId] = useState<string | null>(null);
  const missionProfiles = getMissionProfiles();

  const handleOpenMission = useCallback(
    (missionId: string) => {
      void playSelectionHaptic();
      startTransition(() => {
        setActiveMissionId(missionId);
        setActiveCategoryId(null);
      });
      navigation.navigate("MissionsList");
    },
    [navigation, setActiveCategoryId, setActiveMissionId],
  );

  const handleDeleteMission = useCallback(
    (mission: MissionDefinition) => {
      if (deletingMissionId) {
        return;
      }

      Alert.alert(
        "Delete mission profile?",
        `${mission.label} will be removed from Mission Hub and mission pickers. Saved leads stay in Convex.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              setDeletingMissionId(mission.id);
              void deleteMissionProfile({
                label: mission.label,
                missionId: mission.id,
              })
                .catch((error) => {
                  Alert.alert(
                    "Mission was not deleted",
                    error instanceof Error ? error.message : "Try again.",
                  );
                })
                .finally(() => {
                  setDeletingMissionId(null);
                });
            },
          },
        ],
      );
    },
    [deleteMissionProfile, deletingMissionId],
  );

  const renderMission = useCallback(
    ({ index, item }: { index: number; item: MissionDefinition }) => (
      <MissionModuleCard
        deletingMissionId={deletingMissionId}
        index={index}
        item={item}
        onDeleteMission={handleDeleteMission}
        onOpenMission={handleOpenMission}
      />
    ),
    [deletingMissionId, handleDeleteMission, handleOpenMission],
  );

  const listHeader = useMemo(
    () => <MissionHubHeader missionCount={missionProfiles.length} />,
    [missionProfiles.length],
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={missionProfiles}
        initialNumToRender={3}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No mission profiles</Text>
            <Text style={styles.emptyBody}>Deleted mission profiles are hidden from this workspace.</Text>
          </View>
        }
        maxToRenderPerBatch={4}
        removeClippedSubviews
        renderItem={renderMission}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        windowSize={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heroPanel: {
    position: "relative",
    overflow: "hidden",
    borderRadius: radii.lg,
    backgroundColor: palette.hero,
    padding: spacing.xl,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  heroGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    top: -24,
    right: -32,
    backgroundColor: "rgba(240, 181, 143, 0.18)",
  },
  heroGlowSecondary: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66,
    bottom: -28,
    left: -12,
    backgroundColor: "rgba(240, 181, 143, 0.1)",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#F4C8B0",
    textTransform: "uppercase",
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: palette.white,
    maxWidth: "88%",
  },
  heroBody: {
    fontSize: typography.label,
    lineHeight: 22,
    color: "rgba(255,255,255,0.7)",
    maxWidth: "84%",
  },
  hubSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: radii.md,
    padding: spacing.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.white,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  cardEyebrowRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.mutedInk,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  cardPulse: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: palette.accentSoft,
  },
  cardPulseText: {
    fontSize: 10,
    fontWeight: "800",
    color: palette.accentStrong,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  missionDeleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.dangerSoft,
  },
  missionDeleteButtonPressed: {
    opacity: 0.72,
  },
  missionDeleteButtonDisabled: {
    opacity: 0.45,
  },
  missionCard: {
    backgroundColor: palette.card,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.xl,
    gap: spacing.lg,
    shadowColor: "#18161D",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 22,
    elevation: 6,
  },
  missionCardPressed: {
    backgroundColor: "#FFF5EE",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  missionTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: palette.ink,
  },
  missionSubtitle: {
    fontSize: 14,
    color: palette.mutedInk,
    fontWeight: "600",
  },
  cardStats: {
    flexDirection: "row",
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statText: {
    fontSize: 12,
    fontWeight: "700",
    color: palette.mutedInk,
  },
  resumeButton: {
    height: 52,
    borderRadius: radii.md,
    backgroundColor: palette.hero,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  resumeButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: palette.white,
  },
  emptyState: {
    minHeight: 180,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.ink,
  },
  emptyBody: {
    fontSize: typography.label,
    lineHeight: 20,
    textAlign: "center",
    color: palette.mutedInk,
  },
});
