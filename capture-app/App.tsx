import "react-native-get-random-values";
import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { CaptureQueueProvider } from "./src/contexts/CaptureQueueContext";
import { MissionControlProvider } from "./src/contexts/MissionControlContext";
import { AppRoot } from "./src/root/AppRoot";
import { ConfigurationScreen } from "./src/screens/ConfigurationScreen";

type ExpoExtra = {
  convexUrl?: string | null;
};

function resolveConvexUrl() {
  const configValue = (Constants.expoConfig?.extra as ExpoExtra | undefined)?.convexUrl;

  if (typeof configValue === "string" && configValue.trim()) {
    return configValue.trim();
  }

  const envValue = process.env.EXPO_PUBLIC_CONVEX_URL;

  if (typeof envValue === "string" && envValue.trim()) {
    return envValue.trim();
  }

  return null;
}

const convexUrl = resolveConvexUrl();
const convexClient = convexUrl
  ? new ConvexReactClient(convexUrl, {
      unsavedChangesWarning: false,
    })
  : null;

export default function App() {
  if (!convexClient) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <ConfigurationScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ConvexProvider client={convexClient}>
        <MissionControlProvider>
          <CaptureQueueProvider>
            <AppRoot />
          </CaptureQueueProvider>
        </MissionControlProvider>
      </ConvexProvider>
    </SafeAreaProvider>
  );
}
