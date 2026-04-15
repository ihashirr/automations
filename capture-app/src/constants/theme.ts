import { Platform } from "react-native";

export const palette = {
  background: "#F4EEE6",
  backgroundMuted: "#EADFD1",
  surface: "#FFF9F2",
  surfaceStrong: "#F3E6D7",
  card: "#FFFCF8",
  ink: "#18161D",
  mutedInk: "#756A5F",
  line: "#D8CBBE",
  accent: "#D9663A",
  accentStrong: "#B9502B",
  accentSoft: "#F7D9CC",
  success: "#1E8F64",
  successSoft: "#E5F7EE",
  warning: "#9F6611",
  warningSoft: "#FFF1D6",
  danger: "#B53B2C",
  dangerSoft: "#FBE5DF",
  syncBadge: "#EFE5D9",
  hero: "#1E1A1D",
  heroSoft: "#2A2428",
  glow: "#F0B58F",
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
  sm: 14,
  md: 22,
  lg: 30,
  pill: 999,
};

export const typography = {
  overline: 11,
  label: 14,
  body: 16,
  title: 22,
  headline: 38,
};

export const shadows = {
  card:
    Platform.OS === "web"
      ? {
          boxShadow: "0px 18px 32px rgba(24, 22, 29, 0.10)",
        }
      : {
          shadowColor: "#18161D",
          shadowOffset: { width: 0, height: 18 },
          shadowOpacity: 0.1,
          shadowRadius: 28,
          elevation: 8,
        },
};
