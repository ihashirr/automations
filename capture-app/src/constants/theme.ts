import { Platform } from "react-native";

export const palette = {
  background: "#FAF5F0",
  backgroundMuted: "#F3EEE3",
  surface: "#FFFFFF",
  surfaceStrong: "#F3EEE3",
  card: "#FFFFFF",
  ink: "#1C1C1E",
  mutedInk: "#6C6C70",
  line: "#E8E3DA",
  accent: "#E96B39",
  accentStrong: "#D55D2F",
  accentSoft: "#FDE3D7",
  success: "#1f8a5b",
  successSoft: "#E8F6EF",
  warning: "#a16207",
  warningSoft: "#FFF3D6",
  danger: "#b42318",
  dangerSoft: "#FDEDEC",
  syncBadge: "#F3EEE3",
  white: "#ffffff",
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  pill: 999,
};

export const typography = {
  overline: 12,
  label: 14,
  body: 16,
  title: 20,
  headline: 30,
};

export const shadows = {
  card:
    Platform.OS === "web"
      ? {
          boxShadow: "0px 8px 16px rgba(28, 28, 30, 0.04)",
        }
      : {
          shadowColor: "#1C1C1E",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.04,
          shadowRadius: 16,
          elevation: 2,
        },
};
