import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Info, Lightbulb, TriangleAlert } from "lucide-react-native";
import { palette, radii, spacing, typography } from "../constants/theme";

type AppTipProps = {
  message: string;
  title?: string;
  tone?: "default" | "info" | "warning";
};

const toneMap: Record<
  NonNullable<AppTipProps["tone"]>,
  { bg: string; border: string; icon: ReactNode; iconColor: string }
> = {
  default: {
    bg: "#FFF7F2",
    border: "#F5D7C7",
    icon: <Lightbulb color="#D55D2F" size={16} />,
    iconColor: "#D55D2F",
  },
  info: {
    bg: "#EEF6FF",
    border: "#C7DBF7",
    icon: <Info color="#2563EB" size={16} />,
    iconColor: "#2563EB",
  },
  warning: {
    bg: "#FFF7E6",
    border: "#F3D59E",
    icon: <TriangleAlert color="#A16207" size={16} />,
    iconColor: "#A16207",
  },
};

export function AppTip({ message, title, tone = "default" }: AppTipProps) {
  const config = toneMap[tone];

  return (
    <View style={[styles.container, { backgroundColor: config.bg, borderColor: config.border }]}>
      <View style={styles.iconWrap}>{config.icon}</View>
      <View style={styles.copy}>
        {title ? <Text style={[styles.title, { color: config.iconColor }]}>{title}</Text> : null}
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconWrap: {
    marginTop: 1,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: typography.label,
    fontWeight: "700",
  },
  message: {
    fontSize: typography.label,
    lineHeight: 20,
    color: palette.ink,
  },
});
