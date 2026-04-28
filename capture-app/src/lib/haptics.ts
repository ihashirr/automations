import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const SELECTION_HAPTIC_MIN_INTERVAL_MS = 45;
let lastSelectionHapticAt = 0;

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function playSelectionHaptic() {
  const now = Date.now();
  if (now - lastSelectionHapticAt < SELECTION_HAPTIC_MIN_INTERVAL_MS) {
    return;
  }

  lastSelectionHapticAt = now;

  try {
    if (Platform.OS === "android" && Haptics.performAndroidHapticsAsync) {
      await Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Segment_Frequent_Tick);
      return;
    }

    await Haptics.selectionAsync();
  } catch {
    // Ignore haptics failures on unsupported platforms.
  }
}

export async function playPinSuccessHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptics failures on unsupported platforms.
  }
}

export async function playMissionAccomplishedHaptic() {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await delay(90);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore haptics failures on unsupported platforms.
  }
}
