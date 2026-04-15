import { ReactNode, useState } from "react";
import {
  NavigationContainer,
  Theme as NavigationTheme,
  useNavigationContainerRef,
  useNavigationState,
} from "@react-navigation/native";
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ArrowLeft, FolderOpen, Map, Plus } from "lucide-react-native";
import { Image, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radii, spacing } from "../constants/theme";
import { useCaptureQueue } from "../contexts/CaptureQueueContext";
import { useMissionControl } from "../contexts/MissionControlContext";
import { playSelectionHaptic } from "../lib/haptics";
import { HomeTabParamList, MissionsStackParamList, RootStackParamList } from "../navigation/types";
import { CaptureScreen } from "../screens/CaptureScreen";
import { MapScreen } from "../screens/MapScreen";
import { ShopDetailScreen } from "../screens/ShopDetailScreen";
import { ShopsListScreen } from "../screens/ShopsListScreen";

const navigationTheme: NavigationTheme = {
  dark: false,
  colors: {
    primary: palette.accent,
    background: palette.background,
    card: palette.background,
    text: palette.ink,
    border: palette.line,
    notification: palette.accent,
  },
  fonts: {
    regular: {
      fontFamily: "System",
      fontWeight: "400",
    },
    medium: {
      fontFamily: "System",
      fontWeight: "500",
    },
    bold: {
      fontFamily: "System",
      fontWeight: "700",
    },
    heavy: {
      fontFamily: "System",
      fontWeight: "800",
    },
  },
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const MissionsStackStack = createNativeStackNavigator<MissionsStackParamList>();
const Tabs = createBottomTabNavigator<HomeTabParamList>();

type NavigationStateSnapshot = {
  index: number;
  routes: Array<{
    name: string;
    state?: {
      index: number;
      routes: Array<{
        name: string;
      }>;
    };
  }>;
};

function CommandTabBar({ descriptors, navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { setActiveCategoryId } = useMissionControl();
  const missionsRoute = state.routes.find((route) => route.name === "Missions");
  const captureRoute = state.routes.find((route) => route.name === "Capture");
  const mapRoute = state.routes.find((route) => route.name === "Map");

  if (!missionsRoute || !captureRoute || !mapRoute) {
    return null;
  }

  return (
    <View style={[styles.tabBarShell, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBarSurface}>
        <CommandTabButton
          focused={state.index === state.routes.findIndex((route) => route.key === missionsRoute.key)}
          icon={<FolderOpen color={state.index === state.routes.findIndex((route) => route.key === missionsRoute.key) ? palette.ink : palette.mutedInk} size={20} />}
          label="Missions"
          onPress={() => {
            setActiveCategoryId(null);
            const isFocused = state.index === state.routes.findIndex((route) => route.key === missionsRoute.key);
            if (isFocused) {
              navigation.navigate("Missions", { screen: "MissionHub" });
            } else {
              handleTabPress({ navigation, route: missionsRoute, state });
            }
          }}
        />
        <View style={styles.captureSlot}>
          <CaptureTabButton
            focused={state.index === state.routes.findIndex((route) => route.key === captureRoute.key)}
            onPress={() => handleTabPress({ navigation, route: captureRoute, state })}
          />
        </View>
        <CommandTabButton
          focused={state.index === state.routes.findIndex((route) => route.key === mapRoute.key)}
          icon={<Map color={state.index === state.routes.findIndex((route) => route.key === mapRoute.key) ? palette.ink : palette.mutedInk} size={20} />}
          label="Map"
          onPress={() => handleTabPress({ navigation, route: mapRoute, state })}
        />
      </View>
    </View>
  );
}

type NavigationRefLike = {
  isReady: () => boolean;
  canGoBack: () => boolean;
  goBack: () => void;
};

function AppHeader({
  navigationReady,
  navigationRef,
}: {
  navigationReady: boolean;
  navigationRef: NavigationRefLike;
}) {
  const insets = useSafeAreaInsets();
  const { activeCategoryLabel, activeMissionLabel } = useMissionControl();
  const { isOnline, pendingCount } = useCaptureQueue();
  const navigationState = useNavigationState((state) => state as unknown as NavigationStateSnapshot);

  const rootRoute = navigationState.routes[navigationState.index];
  const activeTabRoute = rootRoute.name === "Home" ? rootRoute.state?.routes[rootRoute.state.index] : null;
  const activeTabName = activeTabRoute?.name ?? rootRoute.name;

  let eyebrow = "FIELD SUITE";
  let title = "Field Command";
  let subtitle = activeMissionLabel;

  if (rootRoute.name === "ShopDetail") {
    eyebrow = "LEAD DETAIL";
    title = "Review Lead";
    subtitle = pendingCount > 0 ? `${pendingCount} queued capture${pendingCount === 1 ? "" : "s"}` : "Lead inspection";
  } else if (activeTabName === "MissionHub") {
    eyebrow = "FIELD HUB";
    title = "Operational Modules";
    subtitle = "Choose a module and keep the day moving.";
  } else if (activeTabName === "MissionsList") {
    eyebrow = activeMissionLabel.toUpperCase();
    title = activeCategoryLabel ?? "Mission Feed";
    subtitle = activeCategoryLabel ? `${activeMissionLabel} / ${activeCategoryLabel}` : "All folders";
  } else if (activeTabName === "MissionDetail") {
    eyebrow = activeMissionLabel.toUpperCase();
    title = activeCategoryLabel ?? "Folder Detail";
    subtitle = `${isOnline ? "Connected" : "Offline"} • ${pendingCount} queued`;
  } else if (activeTabName === "Capture") {
    eyebrow = "CAPTURE";
    title = "New Lead";
    subtitle = activeMissionLabel;
  } else if (activeTabName === "Map") {
    eyebrow = "MAP";
    title = "Field Map";
    subtitle = activeMissionLabel;
  }

  const canGoBack = navigationReady && navigationRef.isReady() ? navigationRef.canGoBack() : false;

  return (
    <View style={[styles.appHeader, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.appHeaderTopRow}>
        {canGoBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go back"
            onPress={() => {
              if (navigationReady && navigationRef.isReady() && navigationRef.canGoBack()) {
                navigationRef.goBack();
              }
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <ArrowLeft color={palette.ink} size={18} />
          </Pressable>
        ) : (
          <View style={styles.backButtonSpacer} />
        )}

        <View style={styles.statusStack}>
          <View style={[styles.statusPill, isOnline ? styles.statusPillConnected : styles.statusPillOffline]}>
            <View style={[styles.statusDot, { backgroundColor: isOnline ? palette.success : palette.warning }]} />
            <Text style={styles.statusPillText}>{isOnline ? "Connected" : "Offline"}</Text>
          </View>
          <View style={styles.secondaryPill}>
            <Text style={styles.secondaryPillText}>{pendingCount > 0 ? `${pendingCount} queued` : "Queue clear"}</Text>
          </View>
        </View>
      </View>

      <View style={styles.appHeaderCopy}>
        <View style={styles.brandRow}>
          <Image source={require("../../assets/leadit-mark.png")} style={styles.brandMark} />
          <Text style={styles.brandName}>Leadit</Text>
        </View>
        <Text style={styles.appHeaderEyebrow}>{eyebrow}</Text>
        <Text numberOfLines={1} style={styles.appHeaderTitle}>
          {title}
        </Text>
        <Text numberOfLines={1} style={styles.appHeaderSubtitle}>
          {subtitle}
        </Text>
      </View>
    </View>
  );
}

function handleTabPress({
  navigation,
  route,
  state,
}: {
  navigation: BottomTabBarProps["navigation"];
  route: BottomTabBarProps["state"]["routes"][number];
  state: BottomTabBarProps["state"];
}) {
  const event = navigation.emit({
    canPreventDefault: true,
    target: route.key,
    type: "tabPress",
  });

  if (!event.defaultPrevented) {
    navigation.navigate(route.name, route.params);
  }
}

function CommandTabButton({
  focused,
  icon,
  label,
  onPress,
}: {
  focused: boolean;
  icon: ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={() => {
        void playSelectionHaptic();
        onPress();
      }}
      style={({ pressed }) => [
        styles.sideTabButton,
        focused && styles.sideTabButtonActive,
        pressed && styles.sideTabButtonPressed,
      ]}
    >
      <View style={[styles.sideTabIconWrap, focused && styles.sideTabIconWrapActive]}>{icon}</View>
      <Text style={[styles.sideTabLabel, focused && styles.sideTabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function CaptureTabButton({
  focused,
  onPress,
}: {
  focused: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.captureTabWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open capture"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          void playSelectionHaptic();
          onPress();
        }}
        style={({ pressed }) => [
          styles.captureTabButton,
          focused && styles.captureTabButtonActive,
          pressed && styles.captureTabButtonPressed,
        ]}
      >
        <Plus color={palette.white} size={24} />
      </Pressable>
    </View>
  );
}

import { MissionHubScreen } from "../screens/MissionHubScreen";

function MissionsStack() {
  return (
    <MissionsStackStack.Navigator
      initialRouteName="MissionHub"
      screenOptions={{
        headerShown: false,
      }}
    >
      <MissionsStackStack.Screen
        component={MissionHubScreen}
        name="MissionHub"
      />
      <MissionsStackStack.Screen
        component={ShopsListScreen}
        name="MissionsList"
      />
      <MissionsStackStack.Screen
        component={ShopsListScreen}
        name="MissionDetail"
      />
    </MissionsStackStack.Navigator>
  );
}

function HomeTabs({
  navigationReady,
  navigationRef,
}: {
  navigationReady: boolean;
  navigationRef: NavigationRefLike;
}) {
  return (
    <View style={styles.appShell}>
      <AppHeader navigationReady={navigationReady} navigationRef={navigationRef} />
      <View style={styles.appBody}>
        <Tabs.Navigator
          initialRouteName="Capture"
          tabBar={(props) => <CommandTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            tabBarHideOnKeyboard: true,
            sceneStyle: {
              backgroundColor: palette.background,
            },
          }}
        >
          <Tabs.Screen component={MissionsStack} name="Missions" />
          <Tabs.Screen component={CaptureScreen} name="Capture" />
          <Tabs.Screen component={MapScreen} name="Map" />
        </Tabs.Navigator>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: palette.background,
  },
  appBody: {
    flex: 1,
  },
  appHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(24, 22, 29, 0.08)",
    backgroundColor: "rgba(244, 238, 230, 0.96)",
  },
  appHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  backButtonSpacer: {
    width: 40,
    height: 40,
  },
  statusStack: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: palette.syncBadge,
  },
  statusPillConnected: {
    backgroundColor: palette.successSoft,
  },
  statusPillOffline: {
    backgroundColor: palette.warningSoft,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.ink,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  secondaryPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.pill,
    backgroundColor: palette.card,
    borderWidth: 1,
    borderColor: palette.line,
  },
  secondaryPillText: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.mutedInk,
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  appHeaderCopy: {
    gap: 2,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
  },
  brandName: {
    fontSize: 18,
    fontWeight: "900",
    color: palette.ink,
    letterSpacing: 0.2,
  },
  appHeaderEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.accentStrong,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  appHeaderTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: palette.ink,
  },
  appHeaderSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: palette.mutedInk,
  },
  tabBarShell: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tabBarSurface: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.08)",
    backgroundColor: "rgba(255, 249, 242, 0.96)",
    paddingHorizontal: spacing.sm,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 22px 40px rgba(24, 22, 29, 0.14)",
        }
      : {
          shadowColor: "#18161D",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.14,
          shadowRadius: 28,
          elevation: 18,
        }),
  },
  sideTabButton: {
    flex: 1,
    minHeight: 58,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radii.md,
  },
  sideTabButtonActive: {
    backgroundColor: "rgba(217, 102, 58, 0.08)",
  },
  sideTabIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sideTabIconWrapActive: {
    backgroundColor: palette.accentSoft,
  },
  sideTabButtonPressed: {
    opacity: 0.8,
  },
  sideTabLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.mutedInk,
    letterSpacing: 0.3,
  },
  sideTabLabelActive: {
    color: palette.ink,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.ink,
  },
  captureSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  captureTabWrap: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: -28,
  },
  captureTabButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: palette.background,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 18px 28px rgba(24, 22, 29, 0.22)",
        }
      : {
          shadowColor: "#18161D",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
          elevation: 12,
        }),
  },
  captureTabButtonActive: {
    backgroundColor: palette.accentStrong,
  },
  captureTabButtonPressed: {
    backgroundColor: palette.accentStrong,
  },
});

export function AppRoot() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const [navigationReady, setNavigationReady] = useState(false);

  return (
    <NavigationContainer
      onReady={() => setNavigationReady(true)}
      ref={navigationRef}
      theme={navigationTheme}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: palette.background,
          },
        }}
      >
        <Stack.Screen name="Home">
          {() => <HomeTabs navigationReady={navigationReady} navigationRef={navigationRef} />}
        </Stack.Screen>
        <Stack.Screen component={ShopDetailScreen} name="ShopDetail" />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
