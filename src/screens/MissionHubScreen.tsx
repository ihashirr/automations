import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LayoutDashboard, Users, Zap, ArrowRight, Target, Clock } from "lucide-react-native";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { missionCatalog, MissionDefinition } from "../constants/missions";
import { palette, radii, spacing, typography } from "../constants/theme";
import { useMissionControl } from "../contexts/MissionControlContext";
import { playSelectionHaptic } from "../lib/haptics";
import { MissionsStackParamList } from "../navigation/types";

type NavigationProp = NativeStackNavigationProp<MissionsStackParamList, "MissionsList">;

export function MissionHubScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { setActiveMissionId, setActiveCategoryId } = useMissionControl();

  const renderMission = ({ item }: { item: MissionDefinition }) => {
    return (
      <Pressable
        onPress={() => {
          void playSelectionHaptic();
          setActiveMissionId(item.id);
          setActiveCategoryId(null);
          navigation.navigate("MissionsList");
        }}
        style={({ pressed }) => [
          styles.missionCard,
          pressed && styles.missionCardPressed
        ]}
      >
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
             <Text style={styles.statText}>Active Lead Feed</Text>
           </View>
           <View style={styles.statItem}>
             <Clock color={palette.mutedInk} size={14} />
             <Text style={styles.statText}>Updated Just Now</Text>
           </View>
        </View>

        <View style={styles.resumeButton}>
          <Text style={styles.resumeButtonText}>Launch Mission</Text>
          <Zap color={palette.white} size={14} fill={palette.white} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.headerEyebrow}>FIELD HUB</Text>
        <Text style={styles.headerTitle}>Operational Modules</Text>
      </View>

      <FlatList
        data={missionCatalog}
        keyExtractor={(item) => item.id}
        renderItem={renderMission}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        ListHeaderComponent={
          <View style={styles.hubSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{missionCatalog.length}</Text>
              <Text style={styles.summaryLabel}>Active Missions</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>24/7</Text>
              <Text style={styles.summaryLabel}>Sync Engine</Text>
            </View>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.background,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    backgroundColor: palette.surface,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: "800",
    color: palette.accent,
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: palette.ink,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hubSummary: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#161719",
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginBottom: spacing.sm,
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
    color: "#B4AC9F",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  missionCard: {
    backgroundColor: palette.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.line,
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  missionCardPressed: {
    backgroundColor: palette.backgroundMuted,
    transform: [{ scale: 0.98 }],
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  missionTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: palette.ink,
  },
  missionSubtitle: {
    fontSize: 13,
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
    height: 48,
    borderRadius: radii.md,
    backgroundColor: palette.accent,
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
});
