import * as Haptics from "expo-haptics";

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function playSelectionHaptic() {
  try {
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
