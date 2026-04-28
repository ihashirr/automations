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
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
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
const glassBlurMethod = Platform.OS === "android" ? "dimezisBlurView" : "none";
const headerGlassColors = ["rgba(255, 252, 248, 0.90)", "rgba(255, 249, 242, 0.62)"] as const;
const captureGradientColors = ["#D9663A", "#A94628"] as const;

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
  const missionsIndex = state.routes.findIndex((route) => route.key === missionsRoute?.key);
  const captureIndex = state.routes.findIndex((route) => route.key === captureRoute?.key);
  const mapIndex = state.routes.findIndex((route) => route.key === mapRoute?.key);
  const missionsFocused = state.index === missionsIndex;
  const captureFocused = state.index === captureIndex;
  const mapFocused = state.index === mapIndex;

  if (!missionsRoute || !captureRoute || !mapRoute) {
    return null;
  }

  return (
    <View style={[styles.tabBarShell, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={styles.tabBarSurface}>
        <CommandTabButton
          focused={missionsFocused}
          icon={<FolderOpen color={missionsFocused ? palette.accentStrong : palette.mutedInk} size={20} />}
          label="Missions"
          onPress={() => {
            setActiveCategoryId(null);
            if (missionsFocused) {
              navigation.navigate("Missions", { screen: "MissionHub" });
            } else {
              handleTabPress({ navigation, route: missionsRoute, state });
            }
          }}
        />
        <View style={styles.captureSlot}>
          <CaptureTabButton
            focused={captureFocused}
            onPress={() => handleTabPress({ navigation, route: captureRoute, state })}
          />
        </View>
        <CommandTabButton
          focused={mapFocused}
          icon={<Map color={mapFocused ? palette.accentStrong : palette.mutedInk} size={20} />}
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
  const { isOnline, pendingCount, queueReady } = useCaptureQueue();
  const { activeCategoryLabel } = useMissionControl();
  const navigationState = useNavigationState((state) => state as unknown as NavigationStateSnapshot);

  const rootRoute = navigationState.routes[navigationState.index];
  const activeTabRoute = rootRoute.name === "Home" ? rootRoute.state?.routes[rootRoute.state.index] : null;
  const activeTabName = activeTabRoute?.name ?? rootRoute.name;

  let title = "Mission";

  if (rootRoute.name === "ShopDetail") {
    title = "Review Lead";
  } else if (activeTabName === "MissionHub") {
    title = "Operational Modules";
  } else if (activeTabName === "MissionsList") {
    title = activeCategoryLabel ?? "Mission Feed";
  } else if (activeTabName === "MissionDetail") {
    title = activeCategoryLabel ?? "Folder Detail";
  } else if (activeTabName === "Capture") {
    title = "New Lead";
  } else if (activeTabName === "Map") {
    title = "Field Map";
  }

  const canGoBack = navigationReady && navigationRef.isReady() ? navigationRef.canGoBack() : false;
  const showBackButton = canGoBack && title !== "New Lead";
  const queueValueStyle = pendingCount === 0 ? styles.headerQueueValueClear : styles.headerQueueValuePending;
  const networkDotStyle = !queueReady
    ? styles.headerNetworkDotConnecting
    : isOnline
      ? styles.headerNetworkDotOnline
      : styles.headerNetworkDotOffline;

  return (
    <View style={[styles.appHeader, { paddingTop: insets.top + spacing.sm }]}>
      <BlurView
        experimentalBlurMethod={glassBlurMethod}
        intensity={48}
        style={styles.appHeaderGlass}
        tint="light"
      >
        <LinearGradient colors={headerGlassColors} pointerEvents="none" style={styles.headerGlassTone} />
        <View style={styles.appHeaderTopRow}>
          <View style={styles.headerEdge}>
            {showBackButton ? (
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
            ) : null}
            <View style={styles.headerQueuePill}>
              <Text style={[styles.headerQueueValue, queueValueStyle]}>{pendingCount}</Text>
              <Text style={styles.headerQueueLabel}>Q</Text>
            </View>
          </View>

          <View style={styles.headerBrand}>
            <View style={styles.brandMarkPlate}>
              <Image source={require("../../assets/leadit-mark.png")} style={styles.brandMark} />
            </View>
            <Text numberOfLines={1} style={styles.headerPageTitle}>
              {title}
            </Text>
          </View>

          <View style={[styles.headerEdge, styles.headerEdgeRight]}>
            <View style={styles.headerNetworkIndicator}>
              <View style={[styles.headerNetworkDot, networkDotStyle]} />
            </View>
          </View>
        </View>
      </BlurView>
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
        focused && styles.sideTabButtonFocused,
        pressed && styles.sideTabButtonPressed,
      ]}
    >
      <View style={[styles.sideTabIconWrap, focused && styles.sideTabIconWrapActive]}>{icon}</View>
      <Text style={[styles.sideTabLabel, focused && styles.sideTabLabelActive]}>{label}</Text>
      {focused ? <View style={styles.sideTabIndicator} /> : null}
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
      {focused ? <View pointerEvents="none" style={styles.captureTabHalo} /> : null}
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
        <LinearGradient
          colors={captureGradientColors}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.captureTabGradient}
        >
          <Plus color={palette.white} size={24} />
        </LinearGradient>
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
        freezeOnBlur: true,
        headerShown: false,
        contentStyle: {
          backgroundColor: palette.background,
        },
      }}
    >
      <MissionsStackStack.Screen
        component={MissionHubScreen}
        name="MissionHub"
      />
      <MissionsStackStack.Screen
        component={ShopsListScreen}
        name="MissionsList"
        options={{
          animation: "fade_from_bottom",
          animationDuration: 240,
        }}
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
          detachInactiveScreens
          initialRouteName="Capture"
          tabBar={(props) => <CommandTabBar {...props} />}
          screenOptions={{
            freezeOnBlur: true,
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
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: "rgba(244, 238, 230, 0.84)",
  },
  appHeaderGlass: {
    minHeight: 52,
    justifyContent: "center",
    overflow: "hidden",
    borderRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.09)",
    backgroundColor: "rgba(255, 252, 248, 0.72)",
    paddingHorizontal: 7,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 14px 34px rgba(24, 22, 29, 0.11)",
        }
      : {
          shadowColor: "#18161D",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.1,
          shadowRadius: 22,
          elevation: 10,
        }),
  },
  headerGlassTone: {
    ...StyleSheet.absoluteFillObject,
  },
  appHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    minHeight: 46,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 252, 248, 0.76)",
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.1)",
  },
  backButtonPressed: {
    opacity: 0.72,
  },
  headerEdge: {
    width: 108,
    minHeight: 38,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerEdgeRight: {
    justifyContent: "flex-end",
  },
  headerBrand: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  brandMarkPlate: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.08)",
  },
  brandMark: {
    width: 24,
    height: 24,
    borderRadius: 7,
  },
  headerPageTitle: {
    maxWidth: "100%",
    fontSize: 16,
    fontWeight: "900",
    color: palette.ink,
  },
  headerQueuePill: {
    minHeight: 24,
    paddingHorizontal: 8,
    borderRadius: radii.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 252, 248, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.08)",
  },
  headerQueueValue: {
    fontSize: 10,
    fontWeight: "900",
  },
  headerQueueValueClear: {
    color: palette.success,
  },
  headerQueueValuePending: {
    color: palette.mutedInk,
  },
  headerQueueLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: palette.mutedInk,
  },
  headerNetworkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 252, 248, 0.82)",
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.08)",
  },
  headerNetworkDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerNetworkDotConnecting: {
    backgroundColor: "#A6A6A6",
  },
  headerNetworkDotOnline: {
    backgroundColor: palette.success,
  },
  headerNetworkDotOffline: {
    backgroundColor: palette.danger,
  },
  tabBarShell: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  tabBarSurface: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
    overflow: "visible",
    borderRadius: 32,
    borderWidth: 1,
    borderColor: "rgba(24, 22, 29, 0.08)",
    backgroundColor: "rgba(255, 249, 242, 0.98)",
    paddingHorizontal: 10,
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 22px 40px rgba(24, 22, 29, 0.14)",
        }
      : {
          shadowColor: "#18161D",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.14,
          shadowRadius: 28,
          elevation: 10,
        }),
  },
  sideTabButton: {
    flex: 1,
    minHeight: 60,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    gap: 5,
    borderRadius: 24,
    backgroundColor: "transparent",
  },
  sideTabButtonFocused: {
    backgroundColor: "rgba(217, 102, 58, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(217, 102, 58, 0.14)",
  },
  sideTabIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 252, 248, 0.42)",
  },
  sideTabIconWrapActive: {
    backgroundColor: "rgba(255, 252, 248, 0.78)",
  },
  sideTabButtonPressed: {
    opacity: 0.76,
  },
  sideTabLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: palette.mutedInk,
  },
  sideTabLabelActive: {
    color: palette.ink,
  },
  sideTabIndicator: {
    width: 20,
    height: 3,
    borderRadius: 2,
    backgroundColor: palette.accent,
  },
  captureSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  captureTabWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginTop: -30,
  },
  captureTabHalo: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: "rgba(217, 102, 58, 0.18)",
  },
  captureTabButton: {
    width: 70,
    height: 70,
    overflow: "hidden",
    borderRadius: 35,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 6,
    borderColor: "rgba(244, 238, 230, 0.98)",
    ...(Platform.OS === "web"
      ? {
          boxShadow: "0px 20px 34px rgba(24, 22, 29, 0.26)",
        }
      : {
          shadowColor: "#18161D",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.24,
          shadowRadius: 22,
          elevation: 12,
        }),
  },
  captureTabGradient: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
  },
  captureTabButtonActive: {
    borderColor: "rgba(255, 249, 242, 1)",
  },
  captureTabButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
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
