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
        <View style={styles.cardEyebrowRow}>
          <Text style={styles.cardEyebrow}>Operational Module</Text>
          <View style={styles.cardPulse}>
            <Text style={styles.cardPulseText}>Open</Text>
          </View>
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
          <Zap color={palette.white} size={14} fill={palette.white} />
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={missionCatalog}
        keyExtractor={(item) => item.id}
        renderItem={renderMission}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 100 }
        ]}
        ListHeaderComponent={
          <View style={styles.heroPanel}>
            <View style={styles.heroGlow} />
            <Text style={styles.heroEyebrow}>FIELD SUITE</Text>
            <Text style={styles.heroTitle}>Choose a module and keep the day moving.</Text>
            <Text style={styles.heroBody}>
              Capture fresh leads, keep folders clean, and route the team from one calmer command surface.
            </Text>

            <View style={styles.hubSummary}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{missionCatalog.length}</Text>
                <Text style={styles.summaryLabel}>Active Missions</Text>
              </View>
              <View style={styles.summaryDivider} />
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>24/7</Text>
                <Text style={styles.summaryLabel}>Queue Control</Text>
              </View>
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
    transform: [{ scale: 0.98 }],
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
});
