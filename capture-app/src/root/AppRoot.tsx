import { ReactNode } from "react";
import { NavigationContainer, Theme as NavigationTheme } from "@react-navigation/native";
import {
  BottomTabBarProps,
  createBottomTabNavigator,
} from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FolderOpen, Map, Plus } from "lucide-react-native";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { palette, radii, spacing } from "../constants/theme";
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
  const { activeCategoryLabel, activeMissionLabel } = useMissionControl();

  return (
    <MissionsStackStack.Navigator
      initialRouteName="MissionHub"
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: palette.background,
        },
        headerTitleStyle: {
          color: palette.ink,
          fontWeight: "700",
        },
        headerTintColor: palette.ink,
        headerTitleAlign: "left",
      }}
    >
      <MissionsStackStack.Screen
        component={MissionHubScreen}
        name="MissionHub"
        options={{
          headerShown: false,
        }}
      />
      <MissionsStackStack.Screen
        component={ShopsListScreen}
        name="MissionsList"
        options={{
          headerTitle: activeMissionLabel,
        }}
      />
      <MissionsStackStack.Screen
        component={ShopsListScreen}
        name="MissionDetail"
        options={{
          headerTitle: () => (
            <View style={styles.breadcrumbTitle}>
              <Text style={styles.breadcrumbRoot}>{activeMissionLabel}</Text>
              <Text style={styles.breadcrumbSeparator}>/</Text>
              <Text numberOfLines={1} style={styles.breadcrumbCurrent}>
                {activeCategoryLabel}
              </Text>
            </View>
          ),
        }}
      />
    </MissionsStackStack.Navigator>
  );
}

function HomeTabs() {
  return (
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
  );
}

const styles = StyleSheet.create({
  breadcrumbTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  breadcrumbRoot: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.mutedInk,
  },
  breadcrumbSeparator: {
    fontSize: 14,
    fontWeight: "600",
    color: palette.line,
  },
  breadcrumbCurrent: {
    fontSize: 17,
    fontWeight: "800",
    color: palette.ink,
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
  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: palette.background,
          },
          headerTitleStyle: {
            color: palette.ink,
            fontWeight: "700",
          },
          headerTintColor: palette.ink,
          contentStyle: {
            backgroundColor: palette.background,
          },
        }}
      >
        <Stack.Screen component={HomeTabs} name="Home" options={{ headerShown: false }} />
        <Stack.Screen
          component={ShopDetailScreen}
          name="ShopDetail"
          options={{
            title: "Lead Detail",
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
