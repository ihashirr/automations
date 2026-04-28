const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.trim() || undefined;

export default {
  expo: {
    name: "Leadit",
    slug: "capture-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#1E1A1D",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.ihash.captureapp",
      softwareKeyboardLayoutMode: "resize",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1E1A1D",
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        "android.permission.RECORD_AUDIO",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.READ_CONTACTS",
        "android.permission.WRITE_CONTACTS",
      ],
    },
    plugins: [
      [
        "expo-image-picker",
        {
          cameraPermission: "Allow Leadit to take shop photos.",
          photosPermission: "Allow Leadit to attach existing shop photos.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow Leadit to pin shop locations while you are working in the field.",
        },
      ],
      [
        "expo-contacts",
        {
          contactsPermission:
            "Allow Leadit to save captured shop contacts to your phone.",
        },
      ],
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      convexUrl: convexUrl ?? null,
      eas: {
        projectId: "55c89b48-19ea-4350-ae7f-6d52340200f7",
      },
    },
  },
};
