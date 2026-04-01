import { NavigationContainer, Theme as NavigationTheme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FolderOpen, Map, Plus } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { palette } from "../constants/theme";
import { playSelectionHaptic } from "../lib/haptics";
import { HomeTabParamList, RootStackParamList } from "../navigation/types";
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
const Tabs = createBottomTabNavigator<HomeTabParamList>();

function CaptureTabButton({
  accessibilityState,
  onPress,
}: {
  accessibilityState?: { selected?: boolean };
  onPress?: (...args: any[]) => void;
}) {
  return (
    <View style={styles.captureTabWrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open capture"
        onPress={(event) => {
          void playSelectionHaptic();
          onPress?.(event);
        }}
        style={({ pressed }) => [
          styles.captureTabButton,
          accessibilityState?.selected && styles.captureTabButtonActive,
          pressed && styles.captureTabButtonPressed,
        ]}
      >
        <Plus color={palette.white} size={24} />
      </Pressable>
      <Text style={styles.captureTabLabel}>Capture</Text>
    </View>
  );
}

function HomeTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: palette.background,
        },
        headerTitleStyle: {
          color: palette.ink,
          fontWeight: "700",
        },
        headerTintColor: palette.ink,
        tabBarActiveTintColor: palette.ink,
        tabBarInactiveTintColor: palette.mutedInk,
        tabBarHideOnKeyboard: true,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: palette.surface,
          borderTopColor: palette.line,
          height: 78,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === "Missions") {
            return <FolderOpen color={color} size={size} />;
          }

          if (route.name === "Map") {
            return <Map color={color} size={size} />;
          }

          return <Plus color={color} size={size} />;
        },
        sceneStyle: {
          backgroundColor: palette.background,
        },
      })}
    >
      <Tabs.Screen
        component={ShopsListScreen}
        name="Missions"
        options={{
          title: "Missions",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        component={CaptureScreen}
        name="Capture"
        options={{
          title: "Capture",
          headerTitle: "Rapid Capture",
          tabBarButton: (props) => <CaptureTabButton {...props} />,
        }}
      />
      <Tabs.Screen
        component={MapScreen}
        name="Map"
        options={{
          title: "Map",
          headerTitle: "Mission Map",
        }}
      />
    </Tabs.Navigator>
  );
}

const styles = StyleSheet.create({
  captureTabWrap: {
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: -20,
    width: 88,
  },
  captureTabButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: palette.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1C1C1E",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  captureTabButtonActive: {
    backgroundColor: palette.accentStrong,
  },
  captureTabButtonPressed: {
    backgroundColor: palette.accentStrong,
  },
  captureTabLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: "700",
    color: palette.ink,
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
