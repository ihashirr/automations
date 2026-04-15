const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL?.trim() || undefined;
const googleMapsApiKey =
  process.env.GOOGLE_MAPS_API_KEY?.trim() ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
  undefined;

export default {
  expo: {
    name: "capture-app",
    slug: "capture-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    newArchEnabled: true,
    splash: {
      image: "./assets/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },
    ios: {
      supportsTablet: true,
    },
    android: {
      package: "com.ihash.captureapp",
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff",
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
          cameraPermission: "Allow Lead Capture to take shop photos.",
          photosPermission: "Allow Lead Capture to attach existing shop photos.",
        },
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Allow Lead Capture to pin shop locations while you are working in the field.",
        },
      ],
      [
        "expo-contacts",
        {
          contactsPermission:
            "Allow Lead Capture to save captured shop contacts to your phone.",
        },
      ],
      ...(googleMapsApiKey
        ? [
            [
              "react-native-maps",
              {
                androidGoogleMapsApiKey: googleMapsApiKey,
                iosGoogleMapsApiKey: googleMapsApiKey,
              },
            ] as const,
          ]
        : []),
    ],
    web: {
      favicon: "./assets/favicon.png",
    },
    extra: {
      convexUrl: convexUrl ?? null,
      googleMapsConfigured: Boolean(googleMapsApiKey),
      eas: {
        projectId: "55c89b48-19ea-4350-ae7f-6d52340200f7",
      },
    },
  },
};
